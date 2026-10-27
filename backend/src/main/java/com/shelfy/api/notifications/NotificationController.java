package com.shelfy.api.notifications;

import com.shelfy.api.common.Paging;
import com.shelfy.api.common.dto.PagedResponseDto;
import com.shelfy.api.notifications.dto.NotificationPreferencesResponseDto;
import com.shelfy.api.notifications.dto.NotificationResponseDto;
import com.shelfy.api.notifications.dto.NotificationSummaryResponseDto;
import com.shelfy.api.notifications.dto.UpdateNotificationPreferencesRequestDto;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/notifications")
@RequiredArgsConstructor
public class NotificationController {
  private final NotificationService service;

  @GetMapping
  public PagedResponseDto<NotificationResponseDto> list(
      @AuthenticationPrincipal UUID userId,
      @RequestParam(required = false) NotificationFamily family,
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "20") int size) {
    return service.list(userId, family, Paging.of(page, size));
  }

  @GetMapping("/requests")
  public List<NotificationResponseDto> listRequests(@AuthenticationPrincipal UUID userId) {
    return service.openRequests(userId);
  }

  @GetMapping("/summary")
  public NotificationSummaryResponseDto getSummary(@AuthenticationPrincipal UUID userId) {
    return service.getSummary(userId);
  }

  @PutMapping("/{id}/read")
  public void markRead(@AuthenticationPrincipal UUID userId, @PathVariable UUID id) {
    service.markRead(userId, id);
  }

  @PutMapping("/read-all")
  public void markAllRead(@AuthenticationPrincipal UUID userId) {
    service.markAllRead(userId);
  }

  @DeleteMapping("/{id}")
  public void clear(@AuthenticationPrincipal UUID userId, @PathVariable UUID id) {
    service.clear(userId, id);
  }

  @DeleteMapping
  public void clearAll(@AuthenticationPrincipal UUID userId) {
    service.clearAll(userId);
  }

  @GetMapping("/preferences")
  public NotificationPreferencesResponseDto getPreferences(@AuthenticationPrincipal UUID userId) {
    return service.getPreferences(userId);
  }

  @PutMapping("/preferences")
  public NotificationPreferencesResponseDto updatePreferences(
      @AuthenticationPrincipal UUID userId,
      @RequestBody UpdateNotificationPreferencesRequestDto request) {
    return service.updatePreferences(userId, request);
  }
}
