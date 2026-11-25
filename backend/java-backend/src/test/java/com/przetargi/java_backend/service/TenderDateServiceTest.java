package com.przetargi.java_backend.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class TenderDateServiceTest {

    private TenderDateService dateService;

    @BeforeEach
    void setUp() {
        dateService = new TenderDateService();
    }

    @Test
    void resolveDynamicTokensReplacesDatePlaceholdersInPolandZone() {
        LocalDate today = LocalDate.now(TenderDateService.POLAND_ZONE);
        String expectedToday = today.format(DateTimeFormatter.ISO_LOCAL_DATE);
        String expectedWeekAgoCompact = today.minusDays(7).format(DateTimeFormatter.BASIC_ISO_DATE);
        String expectedYesterdayStart = today.minusDays(1).format(DateTimeFormatter.ISO_LOCAL_DATE) + "T00:00:00";

        String resolved = dateService.resolveDynamicTokens(
                "https://api.example.com?from={YESTERDAY_START}&to={TODAY}&compact={TODAY-7D_COMPACT}"
        );

        assertEquals(
                "https://api.example.com?from=" + expectedYesterdayStart
                        + "&to=" + expectedToday
                        + "&compact=" + expectedWeekAgoCompact,
                resolved
        );
    }

    @Test
    void resolveDynamicTokensReturnsOriginalWhenNoBraces() {
        String plain = "https://api.example.com/tenders?limit=50";
        assertEquals(plain, dateService.resolveDynamicTokens(plain));
        assertNull(dateService.resolveDynamicTokens(null));
    }

    @Test
    void parseFlexibleDateTimeParsesIsoAndPolishFormats() {
        OffsetDateTime iso = dateService.parseFlexibleDateTime("2026-11-30T12:30:00+01:00");
        assertNotNull(iso);
        assertEquals(2026, iso.getYear());
        assertEquals(11, iso.getMonthValue());
        assertEquals(30, iso.getDayOfMonth());
        assertEquals(12, iso.getHour());
        assertEquals(30, iso.getMinute());

        OffsetDateTime plDt = dateService.parseFlexibleDateTime("15.12.2026, godz. 10:15");
        assertNotNull(plDt);
        assertEquals("2026-12-15 10:15", dateService.formatPolandDateTime(plDt));

        OffsetDateTime dateOnly = dateService.parseFlexibleDateTime("20.12.2026");
        assertNotNull(dateOnly);
        assertEquals("2026-12-20 23:59", dateService.formatPolandDateTime(dateOnly));

        assertNull(dateService.parseFlexibleDateTime("brak terminu"));
    }

    @Test
    void extractDeadlineFromDescriptionSkipsPublicationDateAndReadsDeadlineLine() {
        String desc = """
                Źródło: BZP
                publicationDate: 2026-11-01 08:00
                Termin składania ofert: 18.12.2026 11:00
                """;

        OffsetDateTime deadline = dateService.extractDeadlineFromDescription(desc);
        assertNotNull(deadline);
        assertEquals("2026-12-18 11:00", dateService.formatPolandDateTime(deadline));
    }

    @Test
    void sameInstantComparesAcrossOffsets() {
        OffsetDateTime utc = OffsetDateTime.parse("2026-11-30T10:00:00Z");
        OffsetDateTime plusOne = OffsetDateTime.parse("2026-11-30T11:00:00+01:00");
        OffsetDateTime different = OffsetDateTime.parse("2026-11-30T12:00:00+01:00");

        assertTrue(dateService.sameInstant(utc, plusOne));
        assertTrue(dateService.sameInstant(null, null));
        assertFalse(dateService.sameInstant(utc, different));
        assertFalse(dateService.sameInstant(utc, null));
    }
}
