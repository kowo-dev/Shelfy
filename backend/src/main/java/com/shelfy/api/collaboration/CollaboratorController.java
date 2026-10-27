package com.shelfy.api.collaboration;

import com.shelfy.api.lists.dto.InviteCollaboratorRequestDto;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;

public abstract class CollaboratorController<R> {
  private final CollaboratorService<?, ?, R> service;

  protected CollaboratorController(CollaboratorService<?, ?, R> service) {
    this.service = service;
  }

  @PostMapping
  public ResponseEntity<R> invite(
      @AuthenticationPrincipal UUID userId,
      @PathVariable("parentId") UUID parentId,
      @Valid @RequestBody InviteCollaboratorRequestDto request) {
    return ResponseEntity.status(HttpStatus.CREATED)
        .body(service.invite(userId, parentId, request.userId()));
  }

  @PutMapping("/accept")
  public R accept(@AuthenticationPrincipal UUID userId, @PathVariable("parentId") UUID parentId) {
    return service.accept(userId, parentId);
  }

  @PutMapping("/decline")
  public ResponseEntity<Void> decline(
      @AuthenticationPrincipal UUID userId, @PathVariable("parentId") UUID parentId) {
    service.decline(userId, parentId);
    return ResponseEntity.noContent().build();
  }

  @DeleteMapping("/{userId}")
  public ResponseEntity<Void> remove(
      @AuthenticationPrincipal UUID currentUserId,
      @PathVariable("parentId") UUID parentId,
      @PathVariable("userId") UUID userId) {
    service.remove(currentUserId, parentId, userId);
    return ResponseEntity.noContent().build();
  }
}
