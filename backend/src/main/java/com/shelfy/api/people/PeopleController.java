package com.shelfy.api.people;

import com.shelfy.api.collection.MediaType;
import com.shelfy.api.common.Paging;
import com.shelfy.api.common.dto.PagedResponseDto;
import com.shelfy.api.people.dto.FollowedMediaResponseDto;
import com.shelfy.api.people.dto.UserSearchResultResponseDto;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/people")
@RequiredArgsConstructor
public class PeopleController {

  private final PeopleService peopleService;
  private final FollowedMediaService followedMediaService;

  @GetMapping("/media")
  public ResponseEntity<List<FollowedMediaResponseDto>> listFollowedOnMedia(
      @AuthenticationPrincipal UUID userId,
      @RequestParam String provider,
      @RequestParam MediaType mediaType,
      @RequestParam String externalId) {
    return ResponseEntity.ok(
        followedMediaService.getFollowedOnMedia(userId, provider, mediaType, externalId));
  }

  @GetMapping("/search")
  public ResponseEntity<PagedResponseDto<UserSearchResultResponseDto>> search(
      @AuthenticationPrincipal UUID userId,
      @RequestParam String query,
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "20") int size) {
    return ResponseEntity.ok(peopleService.searchUsers(userId, query, Paging.of(page, size)));
  }
}
