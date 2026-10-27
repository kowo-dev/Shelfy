package com.shelfy.api.feed;

import com.shelfy.api.feed.dto.FeedPageResponseDto;
import com.shelfy.api.feed.dto.FeedUnreadResponseDto;
import java.time.Instant;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/feed")
@RequiredArgsConstructor
public class FeedController {

  private final FeedService feedService;

  @GetMapping
  public FeedPageResponseDto getFeed(
      @AuthenticationPrincipal UUID userId,
      @RequestParam(required = false) Instant before,
      @RequestParam(defaultValue = "20") int size) {
    return feedService.getCircleFeed(userId, before, size);
  }

  @GetMapping("/unread")
  public FeedUnreadResponseDto getUnread(
      @AuthenticationPrincipal UUID userId, @RequestParam(required = false) Instant since) {
    return feedService.getUnread(userId, since);
  }
}
