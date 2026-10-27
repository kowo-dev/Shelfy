package com.shelfy.api.federation;

import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
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
@RequestMapping("/api/v1/admin/federation")
@RequiredArgsConstructor
public class ModerationController {

  public record BlockRequest(@Size(max = 500) String reason) {}

  private final ModerationService moderation;

  @GetMapping("/overview")
  public ModerationService.Overview getOverview(@AuthenticationPrincipal UUID userId) {
    moderation.requireAdmin(userId);
    return moderation.getOverview();
  }

  @GetMapping("/domain-blocks")
  public List<ModerationService.DomainRule> listBlocks(@AuthenticationPrincipal UUID userId) {
    moderation.requireAdmin(userId);
    return moderation.listBlocks();
  }

  @PutMapping("/domain-blocks/{domain}")
  public ResponseEntity<Void> block(
      @AuthenticationPrincipal UUID userId,
      @PathVariable String domain,
      @RequestBody(required = false) BlockRequest request) {
    moderation.requireAdmin(userId);
    moderation.block(domain, request == null ? null : request.reason());
    return ResponseEntity.noContent().build();
  }

  @DeleteMapping("/domain-blocks/{domain}")
  public ResponseEntity<Void> unblock(
      @AuthenticationPrincipal UUID userId, @PathVariable String domain) {
    moderation.requireAdmin(userId);
    moderation.unblock(domain);
    return ResponseEntity.noContent().build();
  }

  public record RetryResponse(int retried) {}

  @PostMapping("/deliveries/{domain}/retry")
  public RetryResponse retryDeliveries(
      @AuthenticationPrincipal UUID userId, @PathVariable String domain) {
    moderation.requireAdmin(userId);
    return new RetryResponse(moderation.retryDeliveries(domain));
  }

  @GetMapping("/domain-allows")
  public List<ModerationService.DomainRule> listAllows(@AuthenticationPrincipal UUID userId) {
    moderation.requireAdmin(userId);
    return moderation.listAllows();
  }

  @PutMapping("/domain-allows/{domain}")
  public ResponseEntity<Void> allow(
      @AuthenticationPrincipal UUID userId, @PathVariable String domain) {
    moderation.requireAdmin(userId);
    moderation.allow(domain);
    return ResponseEntity.noContent().build();
  }

  @DeleteMapping("/domain-allows/{domain}")
  public ResponseEntity<Void> disallow(
      @AuthenticationPrincipal UUID userId, @PathVariable String domain) {
    moderation.requireAdmin(userId);
    moderation.disallow(domain);
    return ResponseEntity.noContent().build();
  }

  @GetMapping("/reports")
  public List<ModerationService.Report> listReports(@AuthenticationPrincipal UUID userId) {
    moderation.requireAdmin(userId);
    return moderation.listReports();
  }
}
