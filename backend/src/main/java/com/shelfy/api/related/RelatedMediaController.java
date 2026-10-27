package com.shelfy.api.related;

import com.shelfy.api.collection.MediaType;
import com.shelfy.api.related.dto.RelatedMediaResponseDto;
import com.shelfy.api.related.dto.SimilarMediaResponseDto;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/media/{mediaType}/{externalId}")
@RequiredArgsConstructor
public class RelatedMediaController {

  private final RelatedMediaService relatedMediaService;

  @GetMapping("/related")
  public RelatedMediaResponseDto getRelated(
      @AuthenticationPrincipal UUID userId,
      @PathVariable MediaType mediaType,
      @PathVariable String externalId) {
    return relatedMediaService.getRelated(userId, mediaType, externalId);
  }

  @GetMapping("/similar")
  public SimilarMediaResponseDto getSimilar(
      @AuthenticationPrincipal UUID userId,
      @PathVariable MediaType mediaType,
      @PathVariable String externalId,
      @RequestParam(defaultValue = "1") int page) {
    return relatedMediaService.getSimilar(userId, mediaType, externalId, page);
  }
}
