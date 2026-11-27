package com.przetargi.java_backend.service;

import com.przetargi.java_backend.dto.GroupDto;
import com.przetargi.java_backend.dto.GroupMemberDto;
import com.przetargi.java_backend.dto.GroupRequest;
import com.przetargi.java_backend.entity.AppGroup;
import com.przetargi.java_backend.entity.AppGroupMember;
import com.przetargi.java_backend.entity.User;
import com.przetargi.java_backend.repository.AppGroupMemberRepository;
import com.przetargi.java_backend.repository.AppGroupRepository;
import com.przetargi.java_backend.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class GroupService {

    private final AppGroupRepository groupRepository;
    private final AppGroupMemberRepository memberRepository;
    private final UserRepository userRepository;

    public GroupService(
            AppGroupRepository groupRepository,
            AppGroupMemberRepository memberRepository,
            UserRepository userRepository
    ) {
        this.groupRepository = groupRepository;
        this.memberRepository = memberRepository;
        this.userRepository = userRepository;
    }

    @Transactional(readOnly = true)
    public List<GroupDto> listHierarchy() {
        List<AppGroup> allGroups = groupRepository.findAllByOrderByIdAsc();
        List<AppGroupMember> allMembers = memberRepository.findAll();
        Map<Long, User> usersById = userRepository.findAll().stream()
                .collect(Collectors.toMap(User::getId, Function.identity()));

        Map<Long, List<GroupMemberDto>> membersByGroup = new HashMap<>();
        for (AppGroupMember gm : allMembers) {
            User u = usersById.get(gm.getUserId());
            if (u != null) {
                membersByGroup
                        .computeIfAbsent(gm.getGroupId(), k -> new ArrayList<>())
                        .add(toMemberDto(u));
            }
        }
        membersByGroup.values().forEach(list ->
                list.sort(Comparator.comparing(GroupMemberDto::username, String.CASE_INSENSITIVE_ORDER)));

        Map<Long, List<AppGroup>> childrenByParent = new HashMap<>();
        List<AppGroup> roots = new ArrayList<>();
        for (AppGroup g : allGroups) {
            if (g.getParentId() == null) {
                roots.add(g);
            } else {
                childrenByParent.computeIfAbsent(g.getParentId(), k -> new ArrayList<>()).add(g);
            }
        }

        roots.sort(Comparator.comparing(AppGroup::getName, String.CASE_INSENSITIVE_ORDER));

        return roots.stream()
                .map(root -> {
                    List<GroupDto> subs = childrenByParent
                            .getOrDefault(root.getId(), List.of())
                            .stream()
                            .sorted(Comparator.comparing(AppGroup::getName, String.CASE_INSENSITIVE_ORDER))
                            .map(sub -> new GroupDto(
                                    sub.getId(),
                                    sub.getName(),
                                    sub.getDescription(),
                                    sub.getParentId(),
                                    membersByGroup.getOrDefault(sub.getId(), List.of()),
                                    List.of(),
                                    sub.getCreatedAt(),
                                    sub.getUpdatedAt()
                            ))
                            .toList();

                    return new GroupDto(
                            root.getId(),
                            root.getName(),
                            root.getDescription(),
                            null,
                            membersByGroup.getOrDefault(root.getId(), List.of()),
                            subs,
                            root.getCreatedAt(),
                            root.getUpdatedAt()
                    );
                })
                .toList();
    }

    @Transactional(readOnly = true)
    public List<GroupMemberDto> listAssignableUsers() {
        return userRepository.findAll().stream()
                .map(this::toMemberDto)
                .sorted(Comparator.comparing(GroupMemberDto::username, String.CASE_INSENSITIVE_ORDER))
                .toList();
    }

    @Transactional
    public GroupDto createGroup(GroupRequest req) {
        String name = validateName(req.name());
        String description = trimOrNull(req.description());
        Long parentId = req.parentId();

        if (parentId != null) {
            AppGroup parent = groupRepository.findById(parentId)
                    .orElseThrow(() -> new IllegalArgumentException("Nie znaleziono grupy głównej o id=" + parentId));
            if (parent.getParentId() != null) {
                throw new IllegalArgumentException("Podgrupy można tworzyć wyłącznie wewnątrz grupy głównej.");
            }
            if (groupRepository.existsByParentIdAndNameIgnoreCase(parentId, name)) {
                throw new IllegalArgumentException("Podgrupa o nazwie \"" + name + "\" już istnieje w tej grupie.");
            }
        } else {
            if (groupRepository.existsByParentIdIsNullAndNameIgnoreCase(name)) {
                throw new IllegalArgumentException("Grupa główna o nazwie \"" + name + "\" już istnieje.");
            }
        }

        AppGroup group = new AppGroup();
        group.setName(name);
        group.setDescription(description);
        group.setParentId(parentId);
        AppGroup saved = groupRepository.save(group);

        return new GroupDto(
                saved.getId(),
                saved.getName(),
                saved.getDescription(),
                saved.getParentId(),
                List.of(),
                List.of(),
                saved.getCreatedAt(),
                saved.getUpdatedAt()
        );
    }

    @Transactional
    public GroupDto updateGroup(Long id, GroupRequest req) {
        AppGroup group = groupRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Nie znaleziono grupy o id=" + id));

        String name = validateName(req.name());
        String description = trimOrNull(req.description());

        boolean nameChanged = !group.getName().equalsIgnoreCase(name);
        if (nameChanged) {
            if (group.getParentId() == null) {
                if (groupRepository.existsByParentIdIsNullAndNameIgnoreCase(name)) {
                    throw new IllegalArgumentException("Grupa główna o nazwie \"" + name + "\" już istnieje.");
                }
            } else {
                if (groupRepository.existsByParentIdAndNameIgnoreCase(group.getParentId(), name)) {
                    throw new IllegalArgumentException("Podgrupa o nazwie \"" + name + "\" już istnieje w tej grupie.");
                }
            }
        }

        group.setName(name);
        group.setDescription(description);
        AppGroup saved = groupRepository.save(group);

        return buildSingleGroupDto(saved);
    }

    @Transactional
    public void deleteGroup(Long id) {
        if (!groupRepository.existsById(id)) {
            return;
        }
        List<AppGroup> children = groupRepository.findByParentIdOrderByIdAsc(id);
        for (AppGroup child : children) {
            memberRepository.deleteByGroupId(child.getId());
            groupRepository.deleteById(child.getId());
        }
        memberRepository.deleteByGroupId(id);
        groupRepository.deleteById(id);
    }

    @Transactional
    public GroupDto setGroupMembers(Long groupId, List<Long> userIds) {
        AppGroup group = groupRepository.findById(groupId)
                .orElseThrow(() -> new IllegalArgumentException("Nie znaleziono grupy o id=" + groupId));

        Set<Long> targetIds = userIds == null
                ? Set.of()
                : userIds.stream().filter(Objects::nonNull).collect(Collectors.toCollection(LinkedHashSet::new));

        if (!targetIds.isEmpty()) {
            List<User> foundUsers = userRepository.findAllById(targetIds);
            Set<Long> foundIds = foundUsers.stream().map(User::getId).collect(Collectors.toSet());
            for (Long uid : targetIds) {
                if (!foundIds.contains(uid)) {
                    throw new IllegalArgumentException("Nie znaleziono użytkownika o id=" + uid);
                }
            }
        }

        List<AppGroupMember> existing = memberRepository.findByGroupId(groupId);
        Set<Long> existingIds = existing.stream().map(AppGroupMember::getUserId).collect(Collectors.toSet());

        for (AppGroupMember gm : existing) {
            if (!targetIds.contains(gm.getUserId())) {
                memberRepository.delete(gm);
            }
        }

        for (Long uid : targetIds) {
            if (!existingIds.contains(uid)) {
                AppGroupMember gm = new AppGroupMember();
                gm.setGroupId(groupId);
                gm.setUserId(uid);
                memberRepository.save(gm);
            }
        }

        return buildSingleGroupDto(group);
    }

    @Transactional
    public GroupDto addMember(Long groupId, Long userId) {
        AppGroup group = groupRepository.findById(groupId)
                .orElseThrow(() -> new IllegalArgumentException("Nie znaleziono grupy o id=" + groupId));
        if (!userRepository.existsById(userId)) {
            throw new IllegalArgumentException("Nie znaleziono użytkownika o id=" + userId);
        }

        if (!memberRepository.existsByGroupIdAndUserId(groupId, userId)) {
            AppGroupMember gm = new AppGroupMember();
            gm.setGroupId(groupId);
            gm.setUserId(userId);
            memberRepository.save(gm);
        }

        return buildSingleGroupDto(group);
    }

    @Transactional
    public GroupDto removeMember(Long groupId, Long userId) {
        AppGroup group = groupRepository.findById(groupId)
                .orElseThrow(() -> new IllegalArgumentException("Nie znaleziono grupy o id=" + groupId));
        memberRepository.deleteByGroupIdAndUserId(groupId, userId);
        return buildSingleGroupDto(group);
    }

    private GroupDto buildSingleGroupDto(AppGroup group) {
        List<Long> memberUserIds = memberRepository.findByGroupId(group.getId()).stream()
                .map(AppGroupMember::getUserId)
                .toList();

        List<GroupMemberDto> members = memberUserIds.isEmpty()
                ? List.of()
                : userRepository.findAllById(memberUserIds).stream()
                .map(this::toMemberDto)
                .sorted(Comparator.comparing(GroupMemberDto::username, String.CASE_INSENSITIVE_ORDER))
                .toList();

        return new GroupDto(
                group.getId(),
                group.getName(),
                group.getDescription(),
                group.getParentId(),
                members,
                List.of(),
                group.getCreatedAt(),
                group.getUpdatedAt()
        );
    }

    private GroupMemberDto toMemberDto(User user) {
        return new GroupMemberDto(
                user.getId(),
                user.getUsername(),
                user.getEmail(),
                Boolean.TRUE.equals(user.getIsActive())
        );
    }

    private String validateName(String name) {
        if (name == null || name.isBlank()) {
            throw new IllegalArgumentException("Nazwa grupy jest wymagana.");
        }
        String trimmed = name.trim();
        if (trimmed.length() > 120) {
            throw new IllegalArgumentException("Nazwa grupy może mieć maksymalnie 120 znaków.");
        }
        return trimmed;
    }

    private String trimOrNull(String value) {
        return (value == null || value.isBlank()) ? null : value.trim();
    }
}
