package com.shelfy.api.comments;

import com.shelfy.api.comments.dto.CommentResponseDto;
import com.shelfy.api.comments.dto.CommentVoteRequestDto;
import com.shelfy.api.comments.dto.CreateCommentRequestDto;
import com.shelfy.api.common.dto.PagedResponseDto;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;

public abstract class CommentEndpoints {
  private final CommentService commentService;
  private final CommentTargetType target;

  protected CommentEndpoints(CommentService commentService, CommentTargetType target) {
    this.commentService = commentService;
    this.target = target;
  }

  @PostMapping("/{targetId}/comments")
  public ResponseEntity<CommentResponseDto> comment(
      @AuthenticationPrincipal UUID userId,
      @PathVariable("targetId") UUID targetId,
      @Valid @RequestBody CreateCommentRequestDto request) {
    return ResponseEntity.status(HttpStatus.CREATED)
        .body(commentService.create(userId, target, targetId, request));
  }

  @GetMapping("/{targetId}/comments")
  public PagedResponseDto<CommentResponseDto> comments(
      @AuthenticationPrincipal UUID userId,
      @PathVariable("targetId") UUID targetId,
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "10") int size,
      @RequestParam(required = false) String sort) {
    return commentService.list(
        userId, target, targetId, page, size, CommentSortMode.fromParam(sort));
  }

  @PutMapping("/{targetId}/comments/{commentId}/vote")
  public CommentResponseDto vote(
      @AuthenticationPrincipal UUID userId,
      @PathVariable("targetId") UUID targetId,
      @PathVariable("commentId") UUID commentId,
      @Valid @RequestBody CommentVoteRequestDto request) {
    return commentService.vote(userId, target, targetId, commentId, request);
  }

  @DeleteMapping("/{targetId}/comments/{commentId}/vote")
  public CommentResponseDto removeVote(
      @AuthenticationPrincipal UUID userId,
      @PathVariable("targetId") UUID targetId,
      @PathVariable("commentId") UUID commentId) {
    return commentService.removeVote(userId, target, targetId, commentId);
  }

  @PutMapping("/{targetId}/comments/{commentId}")
  public CommentResponseDto updateComment(
      @AuthenticationPrincipal UUID userId,
      @PathVariable("targetId") UUID targetId,
      @PathVariable("commentId") UUID commentId,
      @Valid @RequestBody CreateCommentRequestDto request) {
    return commentService.update(userId, target, targetId, commentId, request);
  }

  @DeleteMapping("/{targetId}/comments/{commentId}")
  public ResponseEntity<Void> deleteComment(
      @AuthenticationPrincipal UUID userId,
      @PathVariable("targetId") UUID targetId,
      @PathVariable("commentId") UUID commentId) {
    commentService.delete(userId, target, targetId, commentId);
    return ResponseEntity.noContent().build();
  }
}
