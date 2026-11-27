package com.przetargi.java_backend.service;

import com.przetargi.java_backend.dto.GroupDto;
import com.przetargi.java_backend.dto.GroupRequest;
import com.przetargi.java_backend.entity.AppGroup;
import com.przetargi.java_backend.entity.AppGroupMember;
import com.przetargi.java_backend.entity.User;
import com.przetargi.java_backend.entity.enums.Role;
import com.przetargi.java_backend.repository.AppGroupMemberRepository;
import com.przetargi.java_backend.repository.AppGroupRepository;
import com.przetargi.java_backend.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class GroupServiceTest {

    @Mock
    private AppGroupRepository groupRepository;

    @Mock
    private AppGroupMemberRepository memberRepository;

    @Mock
    private UserRepository userRepository;

    private GroupService service;

    @BeforeEach
    void setUp() {
        service = new GroupService(groupRepository, memberRepository, userRepository);
    }

    @Test
    void listHierarchyBuildsParentGroupsWithSubgroupsAndMembers() {
        AppGroup company = new AppGroup();
        company.setId(1L);
        company.setName("Firma Alfa");

        AppGroup deptIt = new AppGroup();
        deptIt.setId(2L);
        deptIt.setName("Dział IT");
        deptIt.setParentId(1L);

        User jan = User.builder().id(10L).username("jan").email("jan@alfa.pl").role(Role.ROLE_USER).isActive(true).build();
        User anna = User.builder().id(11L).username("anna").email("anna@alfa.pl").role(Role.ROLE_USER).isActive(true).build();

        AppGroupMember mRoot = new AppGroupMember();
        mRoot.setGroupId(1L);
        mRoot.setUserId(10L);

        AppGroupMember mSub = new AppGroupMember();
        mSub.setGroupId(2L);
        mSub.setUserId(11L);

        when(groupRepository.findAllByOrderByIdAsc()).thenReturn(List.of(company, deptIt));
        when(memberRepository.findAll()).thenReturn(List.of(mRoot, mSub));
        when(userRepository.findAll()).thenReturn(List.of(jan, anna));

        List<GroupDto> hierarchy = service.listHierarchy();

        assertEquals(1, hierarchy.size());
        assertEquals("Firma Alfa", hierarchy.get(0).name());
        assertEquals(1, hierarchy.get(0).members().size());
        assertEquals("jan", hierarchy.get(0).members().get(0).username());
        assertEquals(1, hierarchy.get(0).subgroups().size());
        assertEquals("Dział IT", hierarchy.get(0).subgroups().get(0).name());
        assertEquals("anna", hierarchy.get(0).subgroups().get(0).members().get(0).username());
    }

    @Test
    void createGroupRejectsSubgroupUnderSubgroup() {
        AppGroup subgroup = new AppGroup();
        subgroup.setId(2L);
        subgroup.setName("Dział IT");
        subgroup.setParentId(1L);

        when(groupRepository.findById(2L)).thenReturn(Optional.of(subgroup));

        assertThrows(IllegalArgumentException.class, () ->
                service.createGroup(new GroupRequest("Zespół Dev", null, 2L)));
    }

    @Test
    void createGroupRejectsDuplicateNameUnderSameParent() {
        when(groupRepository.existsByParentIdIsNullAndNameIgnoreCase("Firma Alfa")).thenReturn(true);

        assertThrows(IllegalArgumentException.class, () ->
                service.createGroup(new GroupRequest("Firma Alfa", null, null)));
    }

    @Test
    void setGroupMembersAddsNewAndRemovesOldMembers() {
        AppGroup dept = new AppGroup();
        dept.setId(2L);
        dept.setName("Dział IT");
        dept.setParentId(1L);

        User u1 = User.builder().id(10L).username("jan").email("jan@x.pl").role(Role.ROLE_USER).isActive(true).build();
        User u2 = User.builder().id(11L).username("anna").email("anna@x.pl").role(Role.ROLE_USER).isActive(true).build();

        AppGroupMember oldMember = new AppGroupMember();
        oldMember.setId(100L);
        oldMember.setGroupId(2L);
        oldMember.setUserId(10L);

        when(groupRepository.findById(2L)).thenReturn(Optional.of(dept));
        when(userRepository.findAllById(any())).thenReturn(List.of(u2));
        when(memberRepository.findByGroupId(2L))
                .thenReturn(List.of(oldMember))
                .thenReturn(List.of());

        service.setGroupMembers(2L, List.of(11L));

        verify(memberRepository).delete(oldMember);
        verify(memberRepository).save(argThat(m -> m.getGroupId().equals(2L) && m.getUserId().equals(11L)));
        assertNotNull(u1);
    }
}
