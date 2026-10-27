package com.shelfy.api.collection;

import com.shelfy.api.collection.dto.EpisodeCommunityResponseDto;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/episodes/community")
@RequiredArgsConstructor
public class EpisodeCommunityController {

  private final EpisodeCommunityService episodeCommunityService;

  @GetMapping
  public ResponseEntity<EpisodeCommunityResponseDto> get(
      @AuthenticationPrincipal UUID userId,
      @RequestParam String provider,
      @RequestParam MediaType mediaType,
      @RequestParam String externalId) {
    return ResponseEntity.ok(episodeCommunityService.get(userId, provider, mediaType, externalId));
  }
}
