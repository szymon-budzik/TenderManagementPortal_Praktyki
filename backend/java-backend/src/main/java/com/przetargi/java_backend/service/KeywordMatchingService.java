package com.przetargi.java_backend.service;

import com.przetargi.java_backend.entity.KeywordCategory;
import com.przetargi.java_backend.entity.Tender;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;

@Service
public class KeywordMatchingService {

    public ScoreEvaluation evaluate(
            String title,
            String description,
            List<KeywordCategory> selectedCategories,
            Map<Long, String> categoryMatchModes,
            String fallbackMode
    ) {
        String combinedText = ((title != null ? title : "") + " " + (description != null ? description : "")).toLowerCase();
        if (containsAnyExcludedWord(combinedText, selectedCategories)) {
            return new ScoreEvaluation(true, 0, List.of());
        }

        int totalScore = 0;
        List<String> categoryBreakdowns = new ArrayList<>();
        for (KeywordCategory cat : selectedCategories) {
            String catMode = (categoryMatchModes != null && categoryMatchModes.containsKey(cat.getId()))
                    ? categoryMatchModes.get(cat.getId()) : fallbackMode;
            boolean requireAllWords = "ALL".equalsIgnoreCase(catMode) || "AND".equalsIgnoreCase(catMode);
            int catScore = calculateCategoryScore(combinedText, cat, requireAllWords);
            if (catScore > 0) {
                totalScore += catScore;
                categoryBreakdowns.add(cat.getName() + ": " + catScore);
            }
        }
        return new ScoreEvaluation(false, totalScore, categoryBreakdowns);
    }

    public List<ParsedKeyword> parseCategoryKeywords(KeywordCategory cat) {
        List<ParsedKeyword> list = new ArrayList<>();
        if (cat == null || cat.getKeywords() == null || cat.getKeywords().isBlank()) return list;
        boolean wholeCatExcluded = Boolean.TRUE.equals(cat.getIsExcluded());
        int fallbackScore = cat.getScore() != null ? cat.getScore() : 50;

        for (String part : cat.getKeywords().split(",")) {
            String trimmed = part.trim();
            if (trimmed.isEmpty()) continue;

            boolean isWildcard = false;
            if (trimmed.toUpperCase().endsWith(":WILDCARD")) {
                isWildcard = true;
                trimmed = trimmed.substring(0, trimmed.length() - ":WILDCARD".length()).trim();
            }

            int colonIdx = trimmed.lastIndexOf(':');
            if (colonIdx > 0) {
                String word = trimmed.substring(0, colonIdx).trim().toLowerCase();
                String suffix = trimmed.substring(colonIdx + 1).trim().toUpperCase();
                if (word.isEmpty()) continue;
                if ("EXCLUDED".equals(suffix) || wholeCatExcluded) {
                    list.add(new ParsedKeyword(word, 0, true, isWildcard));
                } else {
                    try {
                        list.add(new ParsedKeyword(word, Math.max(1, Math.min(100, Integer.parseInt(suffix))), false, isWildcard));
                    } catch (NumberFormatException e) {
                        list.add(new ParsedKeyword(word, fallbackScore, false, isWildcard));
                    }
                }
            } else {
                list.add(new ParsedKeyword(trimmed.toLowerCase(), fallbackScore, wholeCatExcluded, isWildcard));
            }
        }
        return list;
    }

    public boolean matchesKeyword(String text, ParsedKeyword pk) {
        if (text == null || text.isEmpty() || pk == null || pk.word() == null || pk.word().isEmpty()) return false;
        if (pk.wildcard() && pk.word().endsWith("*")) {
            String stem = pk.word().substring(0, pk.word().length() - 1).trim();
            if (stem.isEmpty()) return false;
            String regex = "(?<![\\p{L}\\p{N}_])" + Pattern.quote(stem) + "[\\p{L}\\p{N}]*";
            return Pattern.compile(regex, Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE).matcher(text).find();
        }
        String regex = "(?<![\\p{L}\\p{N}_])" + Pattern.quote(pk.word()) + "(?![\\p{L}\\p{N}_])";
        return Pattern.compile(regex, Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE).matcher(text).find();
    }

    public boolean containsAnyExcludedWord(String text, List<KeywordCategory> categories) {
        if (categories == null) return false;
        for (KeywordCategory cat : categories) {
            for (ParsedKeyword pk : parseCategoryKeywords(cat)) {
                if (pk.excluded() && matchesKeyword(text, pk)) return true;
            }
        }
        return false;
    }

    public int calculateCategoryScore(String text, KeywordCategory cat, boolean requireAllWords) {
        List<ParsedKeyword> positiveWords = new ArrayList<>();
        for (ParsedKeyword pk : parseCategoryKeywords(cat)) {
            if (!pk.excluded()) positiveWords.add(pk);
        }
        if (positiveWords.isEmpty()) return 0;

        int sum = 0;
        int matchedCount = 0;
        for (ParsedKeyword pk : positiveWords) {
            if (matchesKeyword(text, pk)) {
                matchedCount++;
                sum += pk.weight();
            }
        }
        return (requireAllWords && matchedCount < positiveWords.size()) ? 0 : sum;
    }

    public String extractScoreBreakdown(Tender t) {
        if (t != null && t.getDescription() != null) {
            for (String line : t.getDescription().split("\n")) {
                if (line.startsWith("Punktacja kategorii:")) {
                    return line.substring("Punktacja kategorii:".length()).trim();
                }
            }
        }
        return (t != null && t.getScore() != null ? t.getScore() : 0) + " pkt";
    }

    public List<Long> parseIds(String raw) {
        List<Long> res = new ArrayList<>();
        if (raw == null || raw.isBlank()) return res;
        for (String part : raw.split(",")) {
            try {
                res.add(Long.parseLong(part.split(":")[0].trim()));
            } catch (NumberFormatException ignored) {
            }
        }
        return res;
    }

    public Map<Long, String> parseCategoryIdsWithModes(String raw, String fallbackMode) {
        Map<Long, String> map = new LinkedHashMap<>();
        String def = (fallbackMode != null && !fallbackMode.isBlank()) ? fallbackMode : "OR";
        if (raw == null || raw.isBlank()) return map;
        for (String part : raw.split(",")) {
            String trimmed = part.trim();
            if (trimmed.isEmpty()) continue;
            String[] pieces = trimmed.split(":");
            try {
                Long id = Long.parseLong(pieces[0].trim());
                String mode = (pieces.length > 1 && !pieces[1].isBlank()) ? pieces[1].trim().toUpperCase() : def;
                map.put(id, mode);
            } catch (NumberFormatException ignored) {
            }
        }
        return map;
    }

    public record ParsedKeyword(String word, int weight, boolean excluded, boolean wildcard) {}

    public record ScoreEvaluation(boolean excluded, int totalScore, List<String> categoryBreakdowns) {}
}
