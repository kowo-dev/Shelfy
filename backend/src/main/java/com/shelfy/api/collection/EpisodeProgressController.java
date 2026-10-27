package com.shelfy.api.collection;

import com.shelfy.api.collection.dto.EpisodeProgressResponseDto;
import com.shelfy.api.collection.dto.MarkAllEpisodesRequestDto;
import com.shelfy.api.collection.dto.RateEpisodeRequestDto;
import com.shelfy.api.collection.dto.UpdateEpisodeProgressRequestDto;
import jakarta.validation.Valid;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/collection/items/{itemId}/episodes")
@RequiredArgsConstructor
public class EpisodeProgressController {

  private final EpisodeProgressService episodeProgressService;

  @GetMapping
  public ResponseEntity<EpisodeProgressResponseDto> get(
      @AuthenticationPrincipal UUID userId, @PathVariable UUID itemId) {
    return ResponseEntity.ok(episodeProgressService.get(userId, itemId));
  }

  @PutMapping
  public ResponseEntity<EpisodeProgressResponseDto> update(
      @AuthenticationPrincipal UUID userId,
      @PathVariable UUID itemId,
      @Valid @RequestBody UpdateEpisodeProgressRequestDto request) {
    return ResponseEntity.ok(episodeProgressService.update(userId, itemId, request));
  }

  @PutMapping("/rating")
  public ResponseEntity<EpisodeProgressResponseDto> rate(
      @AuthenticationPrincipal UUID userId,
      @PathVariable UUID itemId,
      @Valid @RequestBody RateEpisodeRequestDto request) {
    return ResponseEntity.ok(episodeProgressService.rate(userId, itemId, request));
  }

  @PutMapping("/all")
  public ResponseEntity<EpisodeProgressResponseDto> markAll(
      @AuthenticationPrincipal UUID userId,
      @PathVariable UUID itemId,
      @RequestBody MarkAllEpisodesRequestDto request) {
    return ResponseEntity.ok(episodeProgressService.markAll(userId, itemId, request));
  }
}
