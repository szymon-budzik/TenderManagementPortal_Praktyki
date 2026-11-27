package com.przetargi.java_backend.service;

import com.przetargi.java_backend.entity.KeywordCategory;
import org.springframework.stereotype.Service;

import java.util.*;

/**
 * Parser i ewaluator wyrażeń logicznych na kategoriach słów kluczowych.
 *
 * Przykłady:
 *   IT;OR OR Budowlanka;AND
 *   (Sprzęt IT;OR OR Chmura;OR) AND Bezpieczeństwo;AND
 *   "R&D or Lab";AND OR Usługi;OR
 *
 * Priorytet operatorów: nawiasy () > AND > OR.
 * Brak sufiksu ";OR" / ";AND" przy nazwie kategorii oznacza domyślnie ";OR".
 */
@Service
public class CategoryQueryService {

    private final KeywordMatchingService keywordMatchingService;

    public CategoryQueryService(KeywordMatchingService keywordMatchingService) {
        this.keywordMatchingService = keywordMatchingService;
    }

    public ParsedQuery parse(String rawQuery, List<KeywordCategory> availableCategories) {
        if (rawQuery == null || rawQuery.isBlank()) {
            throw new IllegalArgumentException("Zapytanie kategorii nie może być puste.");
        }

        Map<String, KeywordCategory> byLowerName = new HashMap<>();
        if (availableCategories != null) {
            for (KeywordCategory cat : availableCategories) {
                if (cat != null && cat.getName() != null) {
                    byLowerName.put(cat.getName().trim().toLowerCase(Locale.ROOT), cat);
                }
            }
        }

        List<Token> tokens = tokenize(rawQuery);
        if (tokens.isEmpty()) {
            throw new IllegalArgumentException("Zapytanie kategorii nie może być puste.");
        }

        List<KeywordCategory> referenced = new ArrayList<>();
        Set<Long> referencedIds = new LinkedHashSet<>();

        ParserState state = new ParserState(tokens, byLowerName, referenced, referencedIds);
        QueryNode root = state.parseOr();
        if (state.hasNext()) {
            throw new IllegalArgumentException("Nieoczekiwany fragment zapytania: \"" + state.peek().value() + "\".");
        }

        return new ParsedQuery(root, referenced);
    }

    public KeywordMatchingService.ScoreEvaluation evaluate(
            String title,
            String description,
            ParsedQuery parsedQuery
    ) {
        String combinedText = ((title != null ? title : "") + " " + (description != null ? description : "")).toLowerCase(Locale.ROOT);
        if (keywordMatchingService.containsAnyExcludedWord(combinedText, parsedQuery.referencedCategories())) {
            return new KeywordMatchingService.ScoreEvaluation(true, 0, List.of());
        }

        Map<Long, Integer> matchedScoresByCatId = new LinkedHashMap<>();
        Map<Long, String> catNamesById = new LinkedHashMap<>();

        boolean matched = evaluateNode(parsedQuery.root(), combinedText, matchedScoresByCatId, catNamesById);
        if (!matched) {
            return new KeywordMatchingService.ScoreEvaluation(false, 0, List.of());
        }

        int totalScore = 0;
        List<String> breakdowns = new ArrayList<>();
        for (Map.Entry<Long, Integer> entry : matchedScoresByCatId.entrySet()) {
            if (entry.getValue() > 0) {
                totalScore += entry.getValue();
                breakdowns.add(catNamesById.get(entry.getKey()) + ": " + entry.getValue());
            }
        }

        return new KeywordMatchingService.ScoreEvaluation(false, totalScore, breakdowns);
    }

    private boolean evaluateNode(
            QueryNode node,
            String combinedText,
            Map<Long, Integer> matchedScoresByCatId,
            Map<Long, String> catNamesById
    ) {
        if (node instanceof TermNode term) {
            int score = keywordMatchingService.calculateCategoryScore(
                    combinedText, term.category(), term.requireAllWords());
            if (score > 0) {
                matchedScoresByCatId.merge(term.category().getId(), score, Math::max);
                catNamesById.put(term.category().getId(), term.category().getName());
                return true;
            }
            return false;
        }
        if (node instanceof AndNode andNode) {
            // Ewaluujemy obie gałęzie, żeby przy dopasowaniu uwzględnić punkty ze wszystkich pasujących kategorii
            Map<Long, Integer> leftScores = new LinkedHashMap<>();
            Map<Long, String> leftNames = new LinkedHashMap<>();
            boolean leftOk = evaluateNode(andNode.left(), combinedText, leftScores, leftNames);

            Map<Long, Integer> rightScores = new LinkedHashMap<>();
            Map<Long, String> rightNames = new LinkedHashMap<>();
            boolean rightOk = evaluateNode(andNode.right(), combinedText, rightScores, rightNames);

            if (leftOk && rightOk) {
                leftScores.forEach((id, s) -> {
                    matchedScoresByCatId.merge(id, s, Math::max);
                    catNamesById.put(id, leftNames.get(id));
                });
                rightScores.forEach((id, s) -> {
                    matchedScoresByCatId.merge(id, s, Math::max);
                    catNamesById.put(id, rightNames.get(id));
                });
                return true;
            }
            return false;
        }
        if (node instanceof OrNode orNode) {
            Map<Long, Integer> leftScores = new LinkedHashMap<>();
            Map<Long, String> leftNames = new LinkedHashMap<>();
            boolean leftOk = evaluateNode(orNode.left(), combinedText, leftScores, leftNames);

            Map<Long, Integer> rightScores = new LinkedHashMap<>();
            Map<Long, String> rightNames = new LinkedHashMap<>();
            boolean rightOk = evaluateNode(orNode.right(), combinedText, rightScores, rightNames);

            if (leftOk) {
                leftScores.forEach((id, s) -> {
                    matchedScoresByCatId.merge(id, s, Math::max);
                    catNamesById.put(id, leftNames.get(id));
                });
            }
            if (rightOk) {
                rightScores.forEach((id, s) -> {
                    matchedScoresByCatId.merge(id, s, Math::max);
                    catNamesById.put(id, rightNames.get(id));
                });
            }
            return leftOk || rightOk;
        }
        return false;
    }

    List<Token> tokenize(String raw) {
        List<Token> tokens = new ArrayList<>();
        StringBuilder currentTerm = new StringBuilder();
        boolean inQuotes = false;
        int len = raw.length();
        int i = 0;

        while (i < len) {
            char c = raw.charAt(i);

            if (c == '"') {
                inQuotes = !inQuotes;
                i++;
                continue;
            }

            if (!inQuotes && (c == '(' || c == ')')) {
                flushTerm(currentTerm, tokens);
                tokens.add(new Token(c == '(' ? TokenType.LPAREN : TokenType.RPAREN, String.valueOf(c)));
                i++;
                continue;
            }

            if (!inQuotes) {
                // Sprawdź czy w tym miejscu stoi samodzielny operator AND lub OR (oddzielony granicą słowa/nawiasem)
                String op = matchStandaloneOperator(raw, i);
                if (op != null) {
                    flushTerm(currentTerm, tokens);
                    tokens.add(new Token("AND".equals(op) ? TokenType.AND : TokenType.OR, op));
                    i += op.length();
                    continue;
                }
            }

            currentTerm.append(c);
            i++;
        }

        if (inQuotes) {
            throw new IllegalArgumentException("Niezamknięty cudzysłów w zapytaniu.");
        }

        flushTerm(currentTerm, tokens);
        return tokens;
    }

    private String matchStandaloneOperator(String raw, int pos) {
        boolean prevBoundary = (pos == 0)
                || Character.isWhitespace(raw.charAt(pos - 1))
                || raw.charAt(pos - 1) == '('
                || raw.charAt(pos - 1) == ')';
        if (!prevBoundary) {
            return null;
        }

        if (matchesKeywordAt(raw, pos, "AND")) {
            return "AND";
        }
        if (matchesKeywordAt(raw, pos, "OR")) {
            return "OR";
        }
        return null;
    }

    private boolean matchesKeywordAt(String raw, int pos, String keyword) {
        int end = pos + keyword.length();
        if (end > raw.length()) return false;
        if (!raw.regionMatches(true, pos, keyword, 0, keyword.length())) return false;
        return end == raw.length()
                || Character.isWhitespace(raw.charAt(end))
                || raw.charAt(end) == '('
                || raw.charAt(end) == ')';
    }

    private void flushTerm(StringBuilder currentTerm, List<Token> tokens) {
        String text = currentTerm.toString().trim();
        currentTerm.setLength(0);
        if (!text.isEmpty()) {
            tokens.add(new Token(TokenType.TERM, text));
        }
    }

    private static class ParserState {
        private final List<Token> tokens;
        private final Map<String, KeywordCategory> byLowerName;
        private final List<KeywordCategory> referenced;
        private final Set<Long> referencedIds;
        private int pos = 0;

        ParserState(
                List<Token> tokens,
                Map<String, KeywordCategory> byLowerName,
                List<KeywordCategory> referenced,
                Set<Long> referencedIds
        ) {
            this.tokens = tokens;
            this.byLowerName = byLowerName;
            this.referenced = referenced;
            this.referencedIds = referencedIds;
        }

        boolean hasNext() {
            return pos < tokens.size();
        }

        Token peek() {
            return tokens.get(pos);
        }

        Token consume() {
            return tokens.get(pos++);
        }

        QueryNode parseOr() {
            QueryNode left = parseAnd();
            while (hasNext() && peek().type() == TokenType.OR) {
                consume();
                QueryNode right = parseAnd();
                left = new OrNode(left, right);
            }
            return left;
        }

        QueryNode parseAnd() {
            QueryNode left = parsePrimary();
            while (hasNext() && peek().type() == TokenType.AND) {
                consume();
                QueryNode right = parsePrimary();
                left = new AndNode(left, right);
            }
            return left;
        }

        QueryNode parsePrimary() {
            if (!hasNext()) {
                throw new IllegalArgumentException("Niekompletne zapytanie — oczekiwano nazwy kategorii po operatorze.");
            }
            Token tok = peek();
            if (tok.type() == TokenType.LPAREN) {
                consume();
                QueryNode inner = parseOr();
                if (!hasNext() || peek().type() != TokenType.RPAREN) {
                    throw new IllegalArgumentException("Brak zamykającego nawiasu ')' w zapytaniu.");
                }
                consume();
                return inner;
            }
            if (tok.type() == TokenType.TERM) {
                consume();
                return parseTerm(tok.value());
            }
            throw new IllegalArgumentException("Nieoczekiwany operator \"" + tok.value() + "\" w zapytaniu.");
        }

        private TermNode parseTerm(String rawTerm) {
            String catName = rawTerm.trim();
            boolean requireAll = false;

            int sepIdx = catName.lastIndexOf(';');
            if (sepIdx < 0) {
                // Wspieramy także zapis z dwukropkiem jako fallback, jeśli kończy się na :OR lub :AND
                int colonIdx = catName.lastIndexOf(':');
                if (colonIdx > 0) {
                    String maybeSuffix = catName.substring(colonIdx + 1).trim().toUpperCase(Locale.ROOT);
                    if ("OR".equals(maybeSuffix) || "AND".equals(maybeSuffix) || "ALL".equals(maybeSuffix) || "ANY".equals(maybeSuffix)) {
                        sepIdx = colonIdx;
                    }
                }
            }

            if (sepIdx > 0) {
                String suffix = catName.substring(sepIdx + 1).trim().toUpperCase(Locale.ROOT);
                catName = catName.substring(0, sepIdx).trim();
                if ("AND".equals(suffix) || "ALL".equals(suffix)) {
                    requireAll = true;
                } else if ("OR".equals(suffix) || "ANY".equals(suffix)) {
                    requireAll = false;
                } else {
                    throw new IllegalArgumentException(
                            "Nieznany tryb \"" + suffix + "\" dla kategorii \"" + catName + "\". Użyj ;OR lub ;AND.");
                }
            }

            if (catName.isEmpty()) {
                throw new IllegalArgumentException("Brak nazwy kategorii przed średnikiem w zapytaniu.");
            }

            KeywordCategory cat = byLowerName.get(catName.toLowerCase(Locale.ROOT));
            if (cat == null) {
                throw new IllegalArgumentException("Nie znaleziono kategorii słów kluczowych: \"" + catName + "\".");
            }

            if (cat.getId() != null && referencedIds.add(cat.getId())) {
                referenced.add(cat);
            } else if (cat.getId() == null) {
                referenced.add(cat);
            }

            return new TermNode(cat, requireAll);
        }
    }

    enum TokenType { TERM, AND, OR, LPAREN, RPAREN }
    record Token(TokenType type, String value) {}

    public sealed interface QueryNode permits TermNode, AndNode, OrNode {}
    public record TermNode(KeywordCategory category, boolean requireAllWords) implements QueryNode {}
    public record AndNode(QueryNode left, QueryNode right) implements QueryNode {}
    public record OrNode(QueryNode left, QueryNode right) implements QueryNode {}
    public record ParsedQuery(QueryNode root, List<KeywordCategory> referencedCategories) {}
}
