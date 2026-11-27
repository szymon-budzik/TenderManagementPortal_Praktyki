package com.przetargi.java_backend.service;

import com.przetargi.java_backend.dto.AutomationProfileRequest;
import com.przetargi.java_backend.dto.ObservedBadgeDto;
import com.przetargi.java_backend.dto.TenderResponseDto;
import com.przetargi.java_backend.dto.TenderStatsDto;
import com.przetargi.java_backend.entity.ApiEndpoint;
import com.przetargi.java_backend.entity.AutomationNotification;
import com.przetargi.java_backend.entity.AutomationProfile;
import com.przetargi.java_backend.entity.FetchRun;
import com.przetargi.java_backend.entity.KeywordCategory;
import com.przetargi.java_backend.entity.Tender;
import com.przetargi.java_backend.entity.TenderUpdate;
import com.przetargi.java_backend.entity.User;
import com.przetargi.java_backend.entity.UserTender;
import com.przetargi.java_backend.entity.enums.Role;
import com.przetargi.java_backend.entity.enums.TenderStatus;
import com.przetargi.java_backend.repository.ApiEndpointRepository;
import com.przetargi.java_backend.repository.AutomationNotificationRepository;
import com.przetargi.java_backend.repository.AutomationProfileRepository;
import com.przetargi.java_backend.repository.FetchRunRepository;
import com.przetargi.java_backend.repository.KeywordCategoryRepository;
import com.przetargi.java_backend.repository.SharedTenderRepository;
import com.przetargi.java_backend.repository.TenderRepository;
import com.przetargi.java_backend.repository.TenderUpdateRepository;
import com.przetargi.java_backend.repository.UserRepository;
import com.przetargi.java_backend.repository.UserTenderRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.security.access.AccessDeniedException;

import java.time.OffsetDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicLong;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class WorkspaceIsolationServiceTest {

    @Mock private ApiEndpointRepository endpointRepository;
    @Mock private KeywordCategoryRepository keywordCategoryRepository;
    @Mock private TenderRepository tenderRepository;
    @Mock private UserTenderRepository userTenderRepository;
    @Mock private SharedTenderRepository sharedTenderRepository;
    @Mock private TenderUpdateRepository tenderUpdateRepository;
    @Mock private FetchRunRepository fetchRunRepository;
    @Mock private AutomationProfileRepository profileRepository;
    @Mock private AutomationNotificationRepository notificationRepository;
    @Mock private UserRepository userRepository;
    @Mock private TenderSourceFetchService sourceFetchService;
    @Mock private ReportExportService reportExportService;
    @Mock private ReportEmailService reportEmailService;

    private TenderDateService dateService;
    private KeywordMatchingService keywordMatchingService;
    private CategoryQueryService categoryQueryService;
    private CurrentUserService currentUserService;
    private AutomationNotificationService notificationService;
    private ObservedTenderUpdateService observedUpdateService;
    private TenderExecutionService executionService;
    private TenderService tenderService;
    private AutomationService automationService;
    private AnalyticsService analyticsService;

    @BeforeEach
    void setUp() {
        dateService = new TenderDateService();
        keywordMatchingService = new KeywordMatchingService();
        categoryQueryService = new CategoryQueryService(keywordMatchingService);
        currentUserService = new CurrentUserService(userRepository);
        notificationService = new AutomationNotificationService(notificationRepository, userRepository);
        observedUpdateService = new ObservedTenderUpdateService(
                tenderRepository,
                userTenderRepository,
                tenderUpdateRepository,
                endpointRepository,
                sourceFetchService,
                dateService
        );
        executionService = new TenderExecutionService(
                endpointRepository,
                keywordCategoryRepository,
                tenderRepository,
                userTenderRepository,
                fetchRunRepository,
                profileRepository,
                dateService,
                sourceFetchService,
                keywordMatchingService,
                categoryQueryService,
                observedUpdateService,
                reportExportService,
                reportEmailService,
                notificationService,
                currentUserService
        );
        tenderService = new TenderService(
                tenderRepository,
                userTenderRepository,
                sharedTenderRepository,
                tenderUpdateRepository,
                dateService,
                observedUpdateService,
                reportExportService,
                currentUserService
        );
        automationService = new AutomationService(
                profileRepository,
                fetchRunRepository,
                executionService,
                reportExportService,
                reportEmailService,
                userRepository,
                keywordCategoryRepository,
                categoryQueryService
        );
        analyticsService = new AnalyticsService(userTenderRepository, currentUserService);
    }

    @Test
    @SuppressWarnings("unchecked")
    void newUserStartsWithCompletelyEmptyWorkspaceAndZeroedAnalytics() {
        User newUser = User.builder().id(20L).username("nowy").email("nowy@a.pl").role(Role.ROLE_USER).isActive(true).build();
        when(userRepository.findByUsername("nowy")).thenReturn(Optional.of(newUser));
        when(userTenderRepository.findAll(any(Specification.class), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of()));
        when(userTenderRepository.findByUserIdAndStatusOrderByIdAsc(20L, TenderStatus.INTERESTED))
                .thenReturn(List.of());
        when(userTenderRepository.countByUserIdAndStatus(20L, TenderStatus.INTERESTED)).thenReturn(0L);
        when(userTenderRepository.countByUserIdAndStatusAndHasUnreadUpdateTrue(20L, TenderStatus.INTERESTED)).thenReturn(0L);
        when(profileRepository.findByOwnerUserIdOrderByIdAsc(20L)).thenReturn(List.of());
        when(fetchRunRepository.findByOwnerUserIdOrTargetUserIdOrderByCreatedAtDesc(20L, 20L)).thenReturn(List.of());
        when(notificationRepository.findTop50ByRecipientUserIdOrderByCreatedAtDesc(20L)).thenReturn(List.of());
        when(userTenderRepository.countByUserId(20L)).thenReturn(0L);
        when(userTenderRepository.calculateAverageScoreByUserId(20L)).thenReturn(0.0);
        when(userTenderRepository.countByUserIdAndScoreGreaterThanEqual(20L, 30)).thenReturn(0L);
        when(userTenderRepository.countByUserIdGroupByStatus(20L)).thenReturn(List.of());

        Page<TenderResponseDto> tenders = tenderService.getTendersPageForUser(20L, null, null, null, PageRequest.of(0, 20));
        assertTrue(tenders.isEmpty());
        assertTrue(tenderService.getObservedTendersForUser(20L).isEmpty());
        ObservedBadgeDto badge = tenderService.getObservedBadgeForUser(20L);
        assertEquals(0L, badge.observedCount());
        assertEquals(0L, badge.unreadCount());
        assertTrue(automationService.getProfiles("nowy").isEmpty());
        assertTrue(automationService.getRuns("nowy").isEmpty());
        assertTrue(notificationService.getLatestNotifications("nowy").isEmpty());

        TenderStatsDto stats = analyticsService.getTenderStatisticsForUser(20L);
        assertEquals(0L, stats.getTotalTenders());
        assertEquals(0.0, stats.getAverageScore());
        assertEquals(0L, stats.getHighPriorityCount());
        assertEquals(0L, stats.getCountByStatus().get(TenderStatus.NEW));
        assertEquals(0L, stats.getCountByStatus().get(TenderStatus.INTERESTED));
    }

    @Test
    void twoUsersFetchingSameTenderCreateOneCatalogRecordAndTwoIndependentUserTenders() throws Exception {
        ApiEndpoint ep = new ApiEndpoint();
        ep.setId(1L);
        ep.setName("EZamówienia");

        KeywordCategory cat = new KeywordCategory();
        cat.setId(5L);
        cat.setName("IT");
        cat.setKeywords("serwer*:50:WILDCARD");
        cat.setScore(50);
        cat.setIsExcluded(false);

        TenderSourceFetchService.RawItem rawItem = new TenderSourceFetchService.RawItem(
                "EXT-SHARED-1",
                "Zakup serwerów dla urzędu",
                "Źródło: EZamówienia\nDostawa serwerów rack",
                null,
                "GRP-1"
        );

        // Symulacja deduplikowanego katalogu tenders oraz niezależnej tabeli user_tenders w pamięci
        Map<String, Tender> catalogByExtId = new HashMap<>();
        Map<String, UserTender> userTendersByKey = new HashMap<>();
        AtomicLong tenderIdSeq = new AtomicLong(100L);
        AtomicLong utIdSeq = new AtomicLong(1L);
        AtomicLong runIdSeq = new AtomicLong(500L);

        when(endpointRepository.findAllById(List.of(1L))).thenReturn(List.of(ep));
        when(keywordCategoryRepository.findAllById(List.of(5L))).thenReturn(List.of(cat));
        when(sourceFetchService.fetchItems(ep)).thenReturn(List.of(rawItem));
        when(sourceFetchService.normalizeExternalId("EXT-SHARED-1", "Zakup serwerów dla urzędu", 1L))
                .thenReturn("EXT-SHARED-1");
        when(sourceFetchService.normalizeGroupKey("GRP-1", "Zakup serwerów dla urzędu"))
                .thenReturn("GRP-1");
        when(tenderRepository.findByExternalId("EXT-SHARED-1"))
                .thenAnswer(inv -> Optional.ofNullable(catalogByExtId.get("EXT-SHARED-1")));
        when(tenderRepository.save(any(Tender.class))).thenAnswer(inv -> {
            Tender t = inv.getArgument(0);
            if (t.getId() == null) {
                t.setId(tenderIdSeq.getAndIncrement());
            }
            catalogByExtId.put(t.getExternalId(), t);
            return t;
        });
        when(userTenderRepository.findByUserIdAndStatusOrderByIdAsc(any(), eq(TenderStatus.INTERESTED)))
                .thenAnswer(inv -> {
                    Long uid = inv.getArgument(0);
                    return userTendersByKey.values().stream()
                            .filter(ut -> ut.getUserId().equals(uid) && ut.getStatus() == TenderStatus.INTERESTED)
                            .toList();
                });
        when(userTenderRepository.findByTenderIdAndStatus(any(), eq(TenderStatus.INTERESTED)))
                .thenAnswer(inv -> {
                    Long tid = inv.getArgument(0);
                    return userTendersByKey.values().stream()
                            .filter(ut -> ut.getTender().getId().equals(tid) && ut.getStatus() == TenderStatus.INTERESTED)
                            .toList();
                });
        when(userTenderRepository.findByUserIdAndTenderId(any(), any())).thenAnswer(inv -> {
            Long uid = inv.getArgument(0);
            Long tid = inv.getArgument(1);
            return Optional.ofNullable(userTendersByKey.get(uid + ":" + tid));
        });
        when(userTenderRepository.save(any(UserTender.class))).thenAnswer(inv -> {
            UserTender ut = inv.getArgument(0);
            if (ut.getId() == null) {
                ut.setId(utIdSeq.getAndIncrement());
            }
            userTendersByKey.put(ut.getUserId() + ":" + ut.getTender().getId(), ut);
            return ut;
        });
        when(fetchRunRepository.save(any(FetchRun.class))).thenAnswer(inv -> {
            FetchRun r = inv.getArgument(0);
            r.setId(runIdSeq.getAndIncrement());
            return r;
        });

        // 1. Użytkownik A (id=10) pobiera przetarg -> 1 rekord w tenders + 1 rekord w user_tenders
        TenderExecutionService.ExecutionSummary sumA = executionService.executeSearch(
                List.of(1L), List.of(5L), "OR", null, null, "MANUAL", 10L);
        assertEquals(1, sumA.newSavedCount());
        assertEquals(0, sumA.existingUpdatedCount());
        assertEquals(1, catalogByExtId.size());
        assertEquals(1, userTendersByKey.size());

        // 2. Użytkownik B (id=20) pobiera ten sam przetarg -> NADAL 1 rekord w tenders, ale 2 niezależne w user_tenders
        TenderExecutionService.ExecutionSummary sumB = executionService.executeSearch(
                List.of(1L), List.of(5L), "OR", null, null, "MANUAL", 20L);
        assertEquals(1, sumB.newSavedCount());
        assertEquals(0, sumB.existingUpdatedCount());
        assertEquals(1, catalogByExtId.size());
        assertEquals(2, userTendersByKey.size());

        Long sharedTenderId = catalogByExtId.get("EXT-SHARED-1").getId();

        // 3. Zmiana statusu u użytkownika A na INTERESTED nie wpływa na status u użytkownika B
        when(tenderUpdateRepository.findByTenderIdOrderByVersionNumberDesc(sharedTenderId)).thenReturn(List.of());
        Optional<TenderResponseDto> updatedA = tenderService.updateStatusForUser(10L, sharedTenderId, TenderStatus.INTERESTED);
        assertTrue(updatedA.isPresent());
        assertEquals(TenderStatus.INTERESTED, updatedA.get().getStatus());
        assertEquals(TenderStatus.INTERESTED, userTendersByKey.get("10:" + sharedTenderId).getStatus());
        assertEquals(TenderStatus.NEW, userTendersByKey.get("20:" + sharedTenderId).getStatus());

        // 4. Ponowne wyszukanie u użytkownika A nie nadpisuje jego statusu INTERESTED z powrotem na NEW
        TenderExecutionService.ExecutionSummary sumA2 = executionService.executeSearch(
                List.of(1L), List.of(5L), "OR", null, null, "MANUAL", 10L);
        assertEquals(0, sumA2.newSavedCount());
        assertEquals(1, sumA2.existingUpdatedCount());
        assertEquals(TenderStatus.INTERESTED, userTendersByKey.get("10:" + sharedTenderId).getStatus());

        // 5. Usunięcie przetargu u użytkownika B usuwa tylko jego wpis w user_tenders, nie katalog tenders
        boolean deletedB = tenderService.deleteTenderForUser(20L, sharedTenderId);
        assertTrue(deletedB);
        verify(userTenderRepository).delete(userTendersByKey.get("20:" + sharedTenderId));
        verify(tenderRepository, never()).deleteById(any());
        verify(tenderRepository, never()).delete(any(Tender.class));
    }

    @Test
    void userCannotEditDeleteOrTriggerOtherUsersProfileOrAccessPrivateReportOrNotification() {
        User userA = User.builder().id(10L).username("userA").email("a@a.pl").role(Role.ROLE_USER).isActive(true).build();
        AutomationProfile profileOfB = new AutomationProfile();
        profileOfB.setId(5L);
        profileOfB.setName("Profil B");
        profileOfB.setOwnerUserId(20L);

        FetchRun runOfB = new FetchRun();
        runOfB.setId(77L);
        runOfB.setOwnerUserId(20L);
        runOfB.setSourceType("MANUAL");

        AutomationNotification notifOfB = new AutomationNotification();
        notifOfB.setId(99L);
        notifOfB.setRecipientUserId(20L);

        when(userRepository.findByUsername("userA")).thenReturn(Optional.of(userA));
        when(profileRepository.findById(5L)).thenReturn(Optional.of(profileOfB));
        when(fetchRunRepository.findById(77L)).thenReturn(Optional.of(runOfB));
        when(notificationRepository.findById(99L)).thenReturn(Optional.of(notifOfB));

        AutomationProfileRequest req = new AutomationProfileRequest(
                "Zmieniona", true, "DAILY", "08:00", 60, "1,2,3,4,5", null, "OR", "1", "1", "", true, null, false
        );

        assertThrows(AccessDeniedException.class, () -> automationService.updateProfile(5L, req, "userA"));
        assertThrows(AccessDeniedException.class, () -> automationService.deleteProfile(5L, "userA"));
        assertThrows(AccessDeniedException.class, () -> automationService.triggerProfileNow(5L, "userA"));
        assertThrows(AccessDeniedException.class, () -> automationService.deleteRun(77L, "userA"));
        assertThrows(AccessDeniedException.class, () -> automationService.exportRunsToExcel(List.of(77L), "userA"));
        assertThrows(AccessDeniedException.class, () -> automationService.sendRunsByEmail(List.of(77L), "test@a.pl", 1L, "userA"));
        assertThrows(AccessDeniedException.class, () -> notificationService.markAsRead(99L, "userA"));
        assertThrows(AccessDeniedException.class, () -> notificationService.deleteNotification(99L, "userA"));

        verify(profileRepository, never()).deleteById(any());
        verify(fetchRunRepository, never()).deleteById(any());
        verify(notificationRepository, never()).deleteById(any());
    }

    @Test
    void observedUpdateCheckFetchesSharedObservedTenderOnceAndNotifiesAllObservingUsers() throws Exception {
        OffsetDateTime oldDeadline = OffsetDateTime.parse("2026-12-10T10:00:00+01:00");
        OffsetDateTime newDeadline = OffsetDateTime.parse("2026-12-20T14:00:00+01:00");

        Tender sharedTender = Tender.builder()
                .id(42L)
                .externalId("EXT-42")
                .title("Modernizacja sieci LAN")
                .description("Źródło: BZP\nOpis pierwotny")
                .submissionDeadline(oldDeadline)
                .groupKey("GRP-42")
                .status(TenderStatus.INTERESTED)
                .hasUnreadUpdate(false)
                .build();

        UserTender utUserA = new UserTender();
        utUserA.setId(1L);
        utUserA.setUserId(10L);
        utUserA.setTender(sharedTender);
        utUserA.setStatus(TenderStatus.INTERESTED);
        utUserA.setHasUnreadUpdate(false);
        utUserA.setLastReadUpdateVersion(0);

        UserTender utUserB = new UserTender();
        utUserB.setId(2L);
        utUserB.setUserId(20L);
        utUserB.setTender(sharedTender);
        utUserB.setStatus(TenderStatus.INTERESTED);
        utUserB.setHasUnreadUpdate(false);
        utUserB.setLastReadUpdateVersion(0);

        ApiEndpoint ep = new ApiEndpoint();
        ep.setId(1L);
        ep.setName("BZP");
        ep.setIsActive(true);

        TenderSourceFetchService.RawItem updatedItem = new TenderSourceFetchService.RawItem(
                "EXT-42",
                "Modernizacja sieci LAN",
                "Źródło: BZP\nOpis zaktualizowany",
                newDeadline,
                "GRP-42"
        );

        when(userTenderRepository.findDistinctTendersByStatus(TenderStatus.INTERESTED))
                .thenReturn(List.of(sharedTender));
        when(endpointRepository.findByIsActiveTrue()).thenReturn(List.of(ep));
        when(sourceFetchService.fetchItems(ep)).thenReturn(List.of(updatedItem));
        when(sourceFetchService.normalizeExternalId("EXT-42", "Modernizacja sieci LAN", 1L)).thenReturn("EXT-42");
        when(sourceFetchService.normalizeGroupKey("GRP-42", "Modernizacja sieci LAN")).thenReturn("GRP-42");
        when(sourceFetchService.truncateString("EXT-42", 150)).thenReturn("EXT-42");
        when(tenderUpdateRepository.findByTenderIdOrderByVersionNumberDesc(42L)).thenReturn(List.of());
        when(userTenderRepository.findByTenderIdAndStatus(42L, TenderStatus.INTERESTED))
                .thenReturn(List.of(utUserA, utUserB));

        TenderExecutionService.ObservedCheckSummary summary = observedUpdateService.checkUpdatesForObservedTenders();

        // Portal odpytany dokładnie RAZ, zapisana dokładnie 1 aktualizacja, obaj obserwujący dostają badge (bez powiadomienia w dzwonku)
        assertEquals(1, summary.checkedEndpoints());
        assertEquals(1, summary.observedTendersCount());
        assertEquals(1, summary.updatesFound());
        verify(sourceFetchService, times(1)).fetchItems(ep);
        verify(tenderUpdateRepository, times(1)).save(any(TenderUpdate.class));
        assertTrue(utUserA.getHasUnreadUpdate());
        assertTrue(utUserB.getHasUnreadUpdate());
        verify(userTenderRepository).saveAll(List.of(utUserA, utUserB));
        verify(notificationRepository, never()).save(any(AutomationNotification.class));

        // Oznaczenie jako przeczytane u użytkownika A nie czyści flagi u użytkownika B
        TenderUpdate v1 = new TenderUpdate();
        v1.setId(1L);
        v1.setTenderId(42L);
        v1.setVersionNumber(1);
        when(userTenderRepository.findByUserIdAndTenderId(10L, 42L)).thenReturn(Optional.of(utUserA));
        when(tenderUpdateRepository.findByTenderIdOrderByVersionNumberDesc(42L)).thenReturn(List.of(v1));

        assertTrue(tenderService.markTenderUpdatesReadForUser(10L, 42L));
        assertFalse(utUserA.getHasUnreadUpdate());
        assertEquals(1, utUserA.getLastReadUpdateVersion());
        assertTrue(utUserB.getHasUnreadUpdate());
        assertEquals(0, utUserB.getLastReadUpdateVersion());
    }

    @Test
    void recipientOfSharedTenderCanAddToObservedWithoutDuplicatingCatalogTender() {
        Tender catalogTender = Tender.builder()
                .id(42L)
                .externalId("EXT-42")
                .title("Dostawa laptopów")
                .description("Punktacja kategorii: IT: 60\nSzczegóły")
                .score(60)
                .status(TenderStatus.NEW)
                .build();

        when(userTenderRepository.findByUserIdAndTenderId(20L, 42L)).thenReturn(Optional.empty());
        when(sharedTenderRepository.existsByRecipientUserIdAndTenderId(20L, 42L)).thenReturn(true);
        when(tenderRepository.findById(42L)).thenReturn(Optional.of(catalogTender));
        when(tenderUpdateRepository.findByTenderIdOrderByVersionNumberDesc(42L)).thenReturn(List.of());
        when(userTenderRepository.save(any(UserTender.class))).thenAnswer(inv -> inv.getArgument(0));

        Optional<TenderResponseDto> res = tenderService.updateStatusForUser(20L, 42L, TenderStatus.INTERESTED);

        assertTrue(res.isPresent());
        assertEquals(TenderStatus.INTERESTED, res.get().getStatus());
        assertNotNull(res.get().getId());
        assertEquals(42L, res.get().getId());
        verify(tenderRepository, never()).save(any());
        verify(userTenderRepository, times(1)).save(any(UserTender.class));
    }
}
