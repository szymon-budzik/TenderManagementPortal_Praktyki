package com.przetargi.java_backend.service;

import com.przetargi.java_backend.entity.Tender;
import com.przetargi.java_backend.entity.TenderUpdate;
import com.przetargi.java_backend.entity.enums.TenderStatus;
import com.przetargi.java_backend.repository.ApiEndpointRepository;
import com.przetargi.java_backend.repository.TenderRepository;
import com.przetargi.java_backend.repository.TenderUpdateRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ObservedTenderUpdateServiceTest {

    @Mock
    private TenderRepository tenderRepository;
    @Mock
    private TenderUpdateRepository tenderUpdateRepository;
    @Mock
    private ApiEndpointRepository endpointRepository;

    private ObservedTenderUpdateService updateService;
    private TenderDateService dateService;

    @BeforeEach
    void setUp() {
        dateService = new TenderDateService();
        TenderSourceFetchService sourceFetchService = new TenderSourceFetchService(dateService);
        updateService = new ObservedTenderUpdateService(
                tenderRepository,
                tenderUpdateRepository,
                endpointRepository,
                sourceFetchService,
                dateService
        );
    }

    @Test
    void findMatchingObservedTenderMatchesByExternalIdOrNormalizedTitle() {
        Tender observed = Tender.builder()
                .id(10L)
                .externalId("BZP-001")
                .title("Dostawa systemu informatycznego dla gminy")
                .status(TenderStatus.INTERESTED)
                .build();

        Optional<Tender> byExtId = updateService.findMatchingObservedTender(
                List.of(observed), "bzp-001", null, "Inny tytuł"
        );
        assertTrue(byExtId.isPresent());
        assertEquals(10L, byExtId.get().getId());

        Optional<Tender> byTitle = updateService.findMatchingObservedTender(
                List.of(observed), "BZP-999", null, "Dostawa systemu informatycznego dla gminy!"
        );
        assertTrue(byTitle.isPresent());
        assertEquals(10L, byTitle.get().getId());
    }

    @Test
    void recordObservedUpdateIfChangedSavesNewVersionAndMarksUnread() {
        OffsetDateTime oldDeadline = OffsetDateTime.parse("2026-12-10T10:00:00+01:00");
        OffsetDateTime newDeadline = OffsetDateTime.parse("2026-12-15T12:00:00+01:00");
        OffsetDateTime now = OffsetDateTime.parse("2026-11-25T09:00:00+01:00");

        Tender observed = Tender.builder()
                .id(42L)
                .externalId("EXT-42")
                .title("Budowa portalu e-usług")
                .description("Punktacja kategorii: IT: 50\nŹródło: BZP\nSzczegóły v1")
                .submissionDeadline(oldDeadline)
                .status(TenderStatus.INTERESTED)
                .hasUnreadUpdate(false)
                .build();

        when(tenderUpdateRepository.findByTenderIdOrderByVersionNumberDesc(42L)).thenReturn(List.of());

        boolean recorded = updateService.recordObservedUpdateIfChanged(
                observed,
                "EXT-42",
                "Budowa portalu e-usług",
                "Źródło: BZP\nSzczegóły v1",
                newDeadline,
                "GRP:42",
                now
        );

        assertTrue(recorded);
        assertTrue(observed.getHasUnreadUpdate());
        assertEquals(now, observed.getLastUpdatedAt());

        ArgumentCaptor<TenderUpdate> captor = ArgumentCaptor.forClass(TenderUpdate.class);
        verify(tenderUpdateRepository).save(captor.capture());
        TenderUpdate savedUpdate = captor.getValue();
        assertEquals(42L, savedUpdate.getTenderId());
        assertEquals(1, savedUpdate.getVersionNumber());
        assertEquals(newDeadline, savedUpdate.getSubmissionDeadline());
        assertTrue(savedUpdate.getChangeSummary().contains("Zmiana terminu składania ofert"));
        verify(tenderRepository).save(observed);
    }

    @Test
    void recordObservedUpdateIfChangedSkipsWhenNothingChanged() {
        OffsetDateTime deadline = OffsetDateTime.parse("2026-12-10T10:00:00+01:00");
        OffsetDateTime now = OffsetDateTime.parse("2026-11-25T09:00:00+01:00");

        Tender observed = Tender.builder()
                .id(42L)
                .externalId("EXT-42")
                .title("Budowa portalu e-usług")
                .description("Punktacja kategorii: IT: 50\nŹródło: BZP\nTreść bez zmian")
                .submissionDeadline(deadline)
                .groupKey("GRP:42")
                .status(TenderStatus.INTERESTED)
                .hasUnreadUpdate(false)
                .build();

        when(tenderUpdateRepository.findByTenderIdOrderByVersionNumberDesc(42L)).thenReturn(List.of());

        boolean recorded = updateService.recordObservedUpdateIfChanged(
                observed,
                "EXT-42",
                "Budowa portalu e-usług",
                "Źródło: BZP\nTreść bez zmian",
                deadline,
                "GRP:42",
                now
        );

        assertFalse(recorded);
        verify(tenderUpdateRepository, never()).save(any());
        verify(tenderRepository, never()).save(any());
    }
}
