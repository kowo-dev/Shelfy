package com.shelfy.api.search;

import com.shelfy.api.collection.MediaType;
import com.shelfy.api.search.dto.SearchResponseDto;
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
public class SearchController {

  private final SearchService searchService;

  @GetMapping
  public SearchResponseDto search(
      @AuthenticationPrincipal UUID userId,
      @RequestParam String query,
      @RequestParam(defaultValue = "1") int page,
      @RequestParam(required = false) MediaType type) {
    return searchService.search(userId, query, page, type);
  }
}
