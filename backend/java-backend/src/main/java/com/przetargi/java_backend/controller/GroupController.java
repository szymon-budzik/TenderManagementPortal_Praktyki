package com.przetargi.java_backend.controller;

import com.przetargi.java_backend.dto.GroupDto;
import com.przetargi.java_backend.dto.GroupMemberDto;
import com.przetargi.java_backend.dto.GroupMembersUpdateRequest;
import com.przetargi.java_backend.dto.GroupRequest;
import com.przetargi.java_backend.service.GroupService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/groups")
public class GroupController {

    private final GroupService groupService;

    public GroupController(GroupService groupService) {
        this.groupService = groupService;
    }

    @GetMapping
    public List<GroupDto> listHierarchy() {
        return groupService.listHierarchy();
    }

    @GetMapping("/users")
    public List<GroupMemberDto> listAssignableUsers() {
        return groupService.listAssignableUsers();
    }

    @PostMapping
    public ResponseEntity<GroupDto> createGroup(@RequestBody GroupRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(groupService.createGroup(request));
    }

    @PutMapping("/{id}")
    public GroupDto updateGroup(@PathVariable Long id, @RequestBody GroupRequest request) {
        return groupService.updateGroup(id, request);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteGroup(@PathVariable Long id) {
        groupService.deleteGroup(id);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/{id}/members")
    public GroupDto setMembers(@PathVariable Long id, @RequestBody GroupMembersUpdateRequest request) {
        return groupService.setGroupMembers(id, request == null ? List.of() : request.userIds());
    }

    @PostMapping("/{id}/members/{userId}")
    public GroupDto addMember(@PathVariable Long id, @PathVariable Long userId) {
        return groupService.addMember(id, userId);
    }

    @DeleteMapping("/{id}/members/{userId}")
    public GroupDto removeMember(@PathVariable Long id, @PathVariable Long userId) {
        return groupService.removeMember(id, userId);
    }

    @ExceptionHandler({IllegalArgumentException.class, IllegalStateException.class})
    public ResponseEntity<ErrorMessage> handleError(RuntimeException ex) {
        return ResponseEntity.badRequest().body(new ErrorMessage(ex.getMessage()));
    }

    public record ErrorMessage(String message) {}
}
