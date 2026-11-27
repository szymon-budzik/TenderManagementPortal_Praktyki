package com.przetargi.java_backend.service;

import com.przetargi.java_backend.dto.ShareActionResultDto;
import com.przetargi.java_backend.dto.SharePeerDto;
import com.przetargi.java_backend.dto.ShareReportsRequest;
import com.przetargi.java_backend.dto.ShareTendersRequest;
import com.przetargi.java_backend.entity.*;
import com.przetargi.java_backend.entity.enums.Role;
import com.przetargi.java_backend.entity.enums.TenderStatus;
import com.przetargi.java_backend.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ShareServiceTest {

    @Mock private SharedTenderRepository sharedTenderRepository;
    @Mock private AppGroupRepository groupRepository;
    @Mock private AppGroupMemberRepository groupMemberRepository;
    @Mock private UserRepository userRepository;
    @Mock private TenderRepository tenderRepository;
    @Mock private UserTenderRepository userTenderRepository;
    @Mock private FetchRunRepository fetchRunRepository;
    @Mock private AutomationNotificationService notificationService;
    @Mock private TenderDateService dateService;

    private ShareService service;

    @BeforeEach
    void setUp() {
        service = new ShareService(
                sharedTenderRepository,
                groupRepository,
                groupMemberRepository,
                userRepository,
                tenderRepository,
                userTenderRepository,
                fetchRunRepository,
                notificationService,
                dateService
        );
    }

    @Test
    void eligiblePeersIncludesSameSubgroupAndParentGroupButExcludesOtherDepartments() {
        AppGroup company = new AppGroup();
        company.setId(1L);
        company.setName("Firma Alfa");

        AppGroup it = new AppGroup();
        it.setId(2L);
        it.setName("IT");
        it.setParentId(1L);

        AppGroup hr = new AppGroup();
        hr.setId(3L);
        hr.setName("HR");
        hr.setParentId(1L);

        User jan = User.builder().id(10L).username("jan").email("jan@a.pl").role(Role.ROLE_USER).isActive(true).build();
        User anna = User.builder().id(11L).username("anna").email("anna@a.pl").role(Role.ROLE_USER).isActive(true).build();
        User szef = User.builder().id(12L).username("szef").email("szef@a.pl").role(Role.ROLE_ADMIN).isActive(true).build();
        User marek = User.builder().id(13L).username("marek").email("marek@a.pl").role(Role.ROLE_USER).isActive(true).build();

        AppGroupMember janIt = member(2L, 10L);
        AppGroupMember annaIt = member(2L, 11L);
        AppGroupMember szefRoot = member(1L, 12L);
        AppGroupMember marekHr = member(3L, 13L);

        when(userRepository.findByUsername("jan")).thenReturn(Optional.of(jan));
        when(groupRepository.findAllByOrderByIdAsc()).thenReturn(List.of(company, it, hr));
        when(groupMemberRepository.findAll()).thenReturn(List.of(janIt, annaIt, szefRoot, marekHr));
        when(userRepository.findAll()).thenReturn(List.of(jan, anna, szef, marek));

        List<SharePeerDto> peers = service.getEligiblePeers("jan");

        assertEquals(2, peers.size());
        assertEquals(List.of("anna", "szef"), peers.stream().map(SharePeerDto::username).toList());
        assertEquals(List.of("Firma Alfa → IT"), peers.get(0).sharedGroups());
    }

    @Test
    void shareTendersSavesRecordsAndSendsNotificationToRecipient() {
        AppGroup it = new AppGroup();
        it.setId(2L);
        it.setName("IT");

        User jan = User.builder().id(10L).username("jan").email("jan@a.pl").role(Role.ROLE_USER).isActive(true).build();
        User anna = User.builder().id(11L).username("anna").email("anna@a.pl").role(Role.ROLE_USER).isActive(true).build();
        Tender tender = Tender.builder().id(100L).externalId("EXT-1").title("Dostawa serwerów").status(TenderStatus.NEW).score(80).build();

        when(userRepository.findByUsername("jan")).thenReturn(Optional.of(jan));
        when(groupRepository.findAllByOrderByIdAsc()).thenReturn(List.of(it));
        when(groupMemberRepository.findAll()).thenReturn(List.of(member(2L, 10L), member(2L, 11L)));
        when(userRepository.findAll()).thenReturn(List.of(jan, anna));
        when(tenderRepository.findAllById(List.of(100L))).thenReturn(List.of(tender));
        when(dateService.nowPoland()).thenReturn(OffsetDateTime.now());

        ShareActionResultDto result = service.shareTenders("jan", new ShareTendersRequest(List.of(11L), List.of(100L), "Pilne!"));

        assertEquals(1, result.sharedItemsCount());
        verify(sharedTenderRepository).save(argThat(st ->
                st.getTenderId().equals(100L)
                        && st.getSenderUserId().equals(10L)
                        && st.getRecipientUserId().equals(11L)
                        && "Pilne!".equals(st.getNote())));
        verify(notificationService).notifyUser(
                eq(11L),
                eq("SHARED_TENDER"),
                contains("jan"),
                contains("jan"),
                contains("Pilne!"),
                contains("EXT-1"),
                any()
        );
    }

    @Test
    void shareReportsRejectsUserOutsideGroupAndClonesForPeer() {
        AppGroup it = new AppGroup();
        it.setId(2L);
        it.setName("IT");

        User jan = User.builder().id(10L).username("jan").email("jan@a.pl").role(Role.ROLE_USER).isActive(true).build();
        User anna = User.builder().id(11L).username("anna").email("anna@a.pl").role(Role.ROLE_USER).isActive(true).build();
        User obcy = User.builder().id(99L).username("obcy").email("o@x.pl").role(Role.ROLE_USER).isActive(true).build();

        FetchRun run = new FetchRun();
        run.setId(50L);
        run.setOwnerUserId(10L);
        run.setSourceType("MANUAL");
        run.setSourcesSummary("EZamówienia");
        run.setTotalFetched(5);
        run.setSavedCount(3);
        run.setExcludedCount(1);
        run.setZeroScoreCount(1);

        when(userRepository.findByUsername("jan")).thenReturn(Optional.of(jan));
        when(groupRepository.findAllByOrderByIdAsc()).thenReturn(List.of(it));
        when(groupMemberRepository.findAll()).thenReturn(List.of(member(2L, 10L), member(2L, 11L)));
        when(userRepository.findAll()).thenReturn(List.of(jan, anna, obcy));

        assertThrows(IllegalArgumentException.class, () ->
                service.shareReports("jan", new ShareReportsRequest(List.of(99L), List.of(50L), null)));

        when(fetchRunRepository.findAllById(List.of(50L))).thenReturn(List.of(run));
        when(dateService.nowPoland()).thenReturn(OffsetDateTime.now());

        ShareActionResultDto res = service.shareReports("jan", new ShareReportsRequest(List.of(11L), List.of(50L), "Dla zespołu"));

        assertEquals(1, res.sharedItemsCount());
        verify(fetchRunRepository).save(argThat(copy ->
                copy.getTargetUserId().equals(11L)
                        && "jan".equals(copy.getSharedByUsername())
                        && copy.getSourceType().startsWith("PRZESŁANE")));
        verify(notificationService).notifyUser(
                eq(11L),
                eq("SHARED_REPORT"),
                contains("jan"),
                contains("jan"),
                contains("Dla zespołu"),
                anyString(),
                any()
        );
    }

    private AppGroupMember member(Long groupId, Long userId) {
        AppGroupMember m = new AppGroupMember();
        m.setGroupId(groupId);
        m.setUserId(userId);
        return m;
    }
}
