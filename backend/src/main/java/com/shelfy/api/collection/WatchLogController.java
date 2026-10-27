package com.shelfy.api.collection;

import com.shelfy.api.collection.dto.UpsertWatchLogRequestDto;
import com.shelfy.api.collection.dto.WatchLogResponseDto;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/collection/items/{itemId}/watch-log")
@RequiredArgsConstructor
public class WatchLogController {

  private final WatchLogService watchLogService;

  @GetMapping
  public ResponseEntity<List<WatchLogResponseDto>> list(
      @AuthenticationPrincipal UUID userId, @PathVariable UUID itemId) {
    return ResponseEntity.ok(watchLogService.list(userId, itemId));
  }

  @PostMapping
  public ResponseEntity<WatchLogResponseDto> create(
      @AuthenticationPrincipal UUID userId,
      @PathVariable UUID itemId,
      @Valid @RequestBody UpsertWatchLogRequestDto request) {
    WatchLogResponseDto response = watchLogService.create(userId, itemId, request);
    return ResponseEntity.status(HttpStatus.CREATED).body(response);
  }

  @PutMapping("/{logId}")
  public ResponseEntity<WatchLogResponseDto> update(
      @AuthenticationPrincipal UUID userId,
      @PathVariable UUID itemId,
      @PathVariable UUID logId,
      @Valid @RequestBody UpsertWatchLogRequestDto request) {
    return ResponseEntity.ok(watchLogService.update(userId, itemId, logId, request));
  }

  @DeleteMapping("/{logId}")
  public ResponseEntity<Void> delete(
      @AuthenticationPrincipal UUID userId, @PathVariable UUID itemId, @PathVariable UUID logId) {
    watchLogService.delete(userId, itemId, logId);
    return ResponseEntity.noContent().build();
  }
}
