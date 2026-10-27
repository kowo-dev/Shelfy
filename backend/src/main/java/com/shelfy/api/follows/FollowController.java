package com.shelfy.api.follows;

import com.shelfy.api.common.Paging;
import com.shelfy.api.common.dto.PagedResponseDto;
import com.shelfy.api.follows.dto.FollowUserResponseDto;
import com.shelfy.api.follows.dto.PopularUserResponseDto;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/follows")
@RequiredArgsConstructor
public class FollowController {

  private final FollowService followService;

  @GetMapping("/following")
  public ResponseEntity<PagedResponseDto<FollowUserResponseDto>> listFollowing(
      @AuthenticationPrincipal UUID userId,
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "20") int size) {
    return ResponseEntity.ok(
        followService.listFollowing(
            userId,
            userId,
            Paging.of(
                page,
                size,
                Sort.by(Sort.Direction.DESC, "favorite", "createdAt").and(Sort.by("followedId")))));
  }

  @GetMapping("/favorites")
  public ResponseEntity<PagedResponseDto<FollowUserResponseDto>> listFavorites(
      @AuthenticationPrincipal UUID userId,
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "20") int size) {
    return ResponseEntity.ok(
        followService.listFavorites(userId, pageable(page, size, "followedId")));
  }

  @PutMapping("/{userId}/favorite")
  public ResponseEntity<Void> favorite(
      @AuthenticationPrincipal UUID currentUserId, @PathVariable UUID userId) {
    followService.setFavorite(currentUserId, userId, true);
    return ResponseEntity.noContent().build();
  }

  @DeleteMapping("/{userId}/favorite")
  public ResponseEntity<Void> unfavorite(
      @AuthenticationPrincipal UUID currentUserId, @PathVariable UUID userId) {
    followService.setFavorite(currentUserId, userId, false);
    return ResponseEntity.noContent().build();
  }

  @GetMapping("/popular")
  public ResponseEntity<PagedResponseDto<PopularUserResponseDto>> listPopular(
      @AuthenticationPrincipal UUID userId,
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "20") int size) {
    return ResponseEntity.ok(followService.listPopular(userId, Paging.of(page, size)));
  }

  @GetMapping("/followers")
  public ResponseEntity<PagedResponseDto<FollowUserResponseDto>> listFollowers(
      @AuthenticationPrincipal UUID userId,
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "20") int size,
      @RequestParam(required = false) String q) {
    return ResponseEntity.ok(
        followService.listFollowers(userId, userId, q, pageable(page, size, "followerId")));
  }

  @GetMapping("/{userId}/following")
  public ResponseEntity<PagedResponseDto<FollowUserResponseDto>> listFollowingOf(
      @AuthenticationPrincipal UUID callerId,
      @PathVariable UUID userId,
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "20") int size) {
    followService.requireVisible(callerId, userId);
    return ResponseEntity.ok(
        followService.listFollowing(callerId, userId, pageable(page, size, "followedId")));
  }

  @GetMapping("/{userId}/followers")
  public ResponseEntity<PagedResponseDto<FollowUserResponseDto>> listFollowersOf(
      @AuthenticationPrincipal UUID callerId,
      @PathVariable UUID userId,
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "20") int size) {
    followService.requireVisible(callerId, userId);
    return ResponseEntity.ok(
        followService.listFollowers(callerId, userId, null, pageable(page, size, "followerId")));
  }

  @PostMapping("/{userId}")
  public ResponseEntity<Void> follow(
      @AuthenticationPrincipal UUID currentUserId, @PathVariable UUID userId) {
    followService.follow(currentUserId, userId);
    return ResponseEntity.status(HttpStatus.CREATED).build();
  }

  @DeleteMapping("/{userId}")
  public ResponseEntity<Void> unfollow(
      @AuthenticationPrincipal UUID currentUserId, @PathVariable UUID userId) {
    followService.unfollow(currentUserId, userId);
    return ResponseEntity.noContent().build();
  }

  private Pageable pageable(int page, int size, String tieBreaker) {
    return Paging.of(
        page, size, Sort.by(Sort.Direction.DESC, "createdAt").and(Sort.by(tieBreaker)));
  }
}
