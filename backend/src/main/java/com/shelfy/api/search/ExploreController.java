package com.shelfy.api.search;

import com.shelfy.api.collection.MediaType;
import com.shelfy.api.search.dto.ExploreOptionResponseDto;
import com.shelfy.api.search.dto.ExploreResponseDto;
import com.shelfy.api.search.dto.ExploreVocabularyResponseDto;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/search")
@RequiredArgsConstructor
public class ExploreController {

  private final ExploreService exploreService;
  private final ExploreOptionsService optionsService;

  @GetMapping("/explore")
  public ExploreResponseDto explore(
      @AuthenticationPrincipal UUID userId,
      @RequestParam(required = false) MediaType type,
      @RequestParam(defaultValue = "") String query,
      @RequestParam(name = "with", required = false) List<String> with,
      @RequestParam(name = "without", required = false) List<String> without,
      @RequestParam(required = false) Integer from,
      @RequestParam(required = false) Integer to,
      @RequestParam(defaultValue = "popular") String sort,
      @RequestParam(defaultValue = "1") int page,
      @RequestParam(defaultValue = "FR") String region) {
    ExploreRequest request =
        new ExploreRequest(
            type,
            query,
            parse(with),
            parse(without),
            from,
            to,
            ExploreSort.fromValue(sort),
            page,
            region);
    return exploreService.explore(userId, request);
  }

  @GetMapping("/vocabulary")
  public ExploreVocabularyResponseDto getVocabulary() {
    return optionsService.getVocabulary();
  }

  @GetMapping("/streaming")
  public List<ExploreOptionResponseDto> listStreamingOptions(
      @RequestParam(defaultValue = "FR") String region) {
    return optionsService.listStreamingServices(region);
  }

  @GetMapping("/facets")
  public List<ExploreOptionResponseDto> listFacets(
      @AuthenticationPrincipal UUID userId,
      @RequestParam MediaType type,
      @RequestParam(defaultValue = "") String query) {
    return optionsService.listCatalogOptions(userId, type, query);
  }

  private static List<ExploreCriterion> parse(List<String> tokens) {
    if (tokens == null) {
      return List.of();
    }
    if (tokens.size() > ExploreRequest.MAX_CRITERIA) {
      throw new IllegalArgumentException("Too many criteria");
    }
    return tokens.stream().map(ExploreCriterion::parse).toList();
  }
}
