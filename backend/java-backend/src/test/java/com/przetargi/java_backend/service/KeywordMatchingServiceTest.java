package com.przetargi.java_backend.service;

import com.przetargi.java_backend.entity.KeywordCategory;
import com.przetargi.java_backend.entity.Tender;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class KeywordMatchingServiceTest {

    private KeywordMatchingService service;

    @BeforeEach
    void setUp() {
        service = new KeywordMatchingService();
    }

    private KeywordCategory category(Long id, String name, String keywords, Integer score, Boolean excluded) {
        KeywordCategory cat = new KeywordCategory();
        cat.setId(id);
        cat.setName(name);
        cat.setKeywords(keywords);
        cat.setScore(score);
        cat.setIsExcluded(excluded);
        return cat;
    }

    @Test
    void parseCategoryKeywordsHandlesWeightsClampingExcludedAndWildcards() {
        KeywordCategory cat = category(
                1L,
                "IT",
                "java:80, chmur*:40:WILDCARD, drukark*:EXCLUDED:WILDCARD, spring:500, legacy",
                25,
                false
        );

        List<KeywordMatchingService.ParsedKeyword> parsed = service.parseCategoryKeywords(cat);

        assertEquals(5, parsed.size());
        assertEquals(new KeywordMatchingService.ParsedKeyword("java", 80, false, false), parsed.get(0));
        assertEquals(new KeywordMatchingService.ParsedKeyword("chmur*", 40, false, true), parsed.get(1));
        assertEquals(new KeywordMatchingService.ParsedKeyword("drukark*", 0, true, true), parsed.get(2));
        assertEquals(new KeywordMatchingService.ParsedKeyword("spring", 100, false, false), parsed.get(3));
        assertEquals(new KeywordMatchingService.ParsedKeyword("legacy", 25, false, false), parsed.get(4));
    }

    @Test
    void evaluateMatchesWildcardAndRespectsOrVsAndModes() {
        KeywordCategory itCat = category(1L, "IT", "java:60, chmur*:40:WILDCARD", 50, false);

        KeywordMatchingService.ScoreEvaluation orEval = service.evaluate(
                "Rozwój usług chmurowych",
                "Infrastruktura dla urzędu",
                List.of(itCat),
                Map.of(1L, "OR"),
                "OR"
        );
        assertFalse(orEval.excluded());
        assertEquals(40, orEval.totalScore());
        assertEquals(List.of("IT: 40"), orEval.categoryBreakdowns());

        KeywordMatchingService.ScoreEvaluation andEvalMissingWord = service.evaluate(
                "Rozwój usług chmurowych",
                "Infrastruktura dla urzędu",
                List.of(itCat),
                Map.of(1L, "AND"),
                "OR"
        );
        assertFalse(andEvalMissingWord.excluded());
        assertEquals(0, andEvalMissingWord.totalScore());
        assertTrue(andEvalMissingWord.categoryBreakdowns().isEmpty());

        KeywordMatchingService.ScoreEvaluation andEvalAllMatched = service.evaluate(
                "Rozwój usług chmurowych w języku Java",
                "Wdrożenie systemu",
                List.of(itCat),
                Map.of(1L, "AND"),
                "OR"
        );
        assertFalse(andEvalAllMatched.excluded());
        assertEquals(100, andEvalAllMatched.totalScore());
    }

    @Test
    void evaluateShortCircuitsWhenExcludedKeywordMatches() {
        KeywordCategory itCat = category(1L, "IT", "oprogramowanie:70, drukark*:EXCLUDED:WILDCARD", 50, false);

        KeywordMatchingService.ScoreEvaluation eval = service.evaluate(
                "Oprogramowanie i dostawa drukarki",
                "Pakiet biurowy",
                List.of(itCat),
                Map.of(),
                "OR"
        );

        assertTrue(eval.excluded());
        assertEquals(0, eval.totalScore());
        assertTrue(eval.categoryBreakdowns().isEmpty());
    }

    @Test
    void matchesKeywordUsesWholeWordBoundaries() {
        KeywordMatchingService.ParsedKeyword exact = new KeywordMatchingService.ParsedKeyword("java", 50, false, false);
        assertTrue(service.matchesKeyword("programista java backend", exact));
        assertFalse(service.matchesKeyword("programista javascript frontend", exact));
    }

    @Test
    void extractScoreBreakdownReadsLineOrFallsBackToScore() {
        Tender withBreakdown = Tender.builder()
                .score(90)
                .description("Punktacja kategorii: IT: 60 / Cloud: 30\nŹródło: BZP")
                .build();
        assertEquals("IT: 60 / Cloud: 30", service.extractScoreBreakdown(withBreakdown));

        Tender withoutBreakdown = Tender.builder()
                .score(45)
                .description("Źródło: BZP")
                .build();
        assertEquals("45 pkt", service.extractScoreBreakdown(withoutBreakdown));
    }

    @Test
    void parseIdsAndCategoryModesHandleMalformedEntriesGracefully() {
        assertEquals(List.of(1L, 3L, 7L), service.parseIds("1, 3:AND, invalid, 7:OR"));

        Map<Long, String> modes = service.parseCategoryIdsWithModes("1:and, 2, bad, 5:OR", "OR");
        assertEquals(Map.of(1L, "AND", 2L, "OR", 5L, "OR"), modes);
    }
}
