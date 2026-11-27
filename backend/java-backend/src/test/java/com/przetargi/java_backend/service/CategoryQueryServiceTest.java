package com.przetargi.java_backend.service;

import com.przetargi.java_backend.entity.KeywordCategory;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class CategoryQueryServiceTest {

    private CategoryQueryService queryService;
    private List<KeywordCategory> categories;

    @BeforeEach
    void setUp() {
        queryService = new CategoryQueryService(new KeywordMatchingService());

        KeywordCategory it = new KeywordCategory();
        it.setId(1L);
        it.setName("IT");
        it.setKeywords("serwer:40, chmura:30");

        KeywordCategory security = new KeywordCategory();
        security.setId(2L);
        security.setName("Bezpieczeństwo IT");
        security.setKeywords("firewall:50, audyt:50");

        KeywordCategory budowlanka = new KeywordCategory();
        budowlanka.setId(3L);
        budowlanka.setName("Budowlanka");
        budowlanka.setKeywords("droga:60, most:40, katering:EXCLUDED");

        categories = List.of(it, security, budowlanka);
    }

    @Test
    void evaluatesOrBetweenCategoriesWithPerCategoryAndMode() {
        var parsed = queryService.parse("IT;OR OR Budowlanka;AND", categories);

        var evalOnlyServer = queryService.evaluate("Zakup serwer", "opis", parsed);
        assertFalse(evalOnlyServer.excluded());
        assertEquals(40, evalOnlyServer.totalScore());

        var evalOnlyDroga = queryService.evaluate("Budowa droga", "opis", parsed);
        assertEquals(0, evalOnlyDroga.totalScore());

        var evalDrogaAndMost = queryService.evaluate("Budowa droga oraz most", "opis", parsed);
        assertEquals(100, evalDrogaAndMost.totalScore());
    }

    @Test
    void evaluatesAndBetweenCategoriesWithMultiWordCategoryNames() {
        var parsed = queryService.parse("IT;OR AND Bezpieczeństwo IT;AND", categories);

        var missingSecond = queryService.evaluate("Zakup serwer i firewall", "bez drugiego slowa", parsed);
        assertEquals(0, missingSecond.totalScore());

        var bothMatched = queryService.evaluate("Zakup serwer", "wymagany firewall oraz audyt", parsed);
        assertEquals(140, bothMatched.totalScore());
        assertEquals(2, bothMatched.categoryBreakdowns().size());
    }

    @Test
    void evaluatesParenthesesAndOperatorPrecedence() {
        var parsed = queryService.parse("(IT;OR OR Budowlanka;OR) AND Bezpieczeństwo IT;OR", categories);

        var onlyIt = queryService.evaluate("serwer", "", parsed);
        assertEquals(0, onlyIt.totalScore());

        var budPlusSec = queryService.evaluate("droga", "wymagany audyt", parsed);
        assertEquals(110, budPlusSec.totalScore());
    }

    @Test
    void respectsExcludedWordsAcrossReferencedCategories() {
        var parsed = queryService.parse("IT;OR OR Budowlanka;OR", categories);

        var excluded = queryService.evaluate("serwer oraz katering", "", parsed);
        assertTrue(excluded.excluded());
        assertEquals(0, excluded.totalScore());
    }

    @Test
    void rejectsUnknownCategoryOrBrokenSyntax() {
        assertThrows(IllegalArgumentException.class, () -> queryService.parse("Nieistniejaca;OR", categories));
        assertThrows(IllegalArgumentException.class, () -> queryService.parse("IT;OR AND", categories));
        assertThrows(IllegalArgumentException.class, () -> queryService.parse("(IT;OR", categories));
        assertThrows(IllegalArgumentException.class, () -> queryService.parse("IT;INVALID", categories));
    }
}
