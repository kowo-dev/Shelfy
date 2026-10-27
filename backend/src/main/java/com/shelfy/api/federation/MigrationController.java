package com.shelfy.api.federation;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBooleanProperty;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/federation/migration")
@ConditionalOnBooleanProperty("app.federation.enabled")
@RequiredArgsConstructor
public class MigrationController {

  public record HandleRequest(@NotBlank @Size(max = 320) String handle) {}

  private final AccountMigration migration;

  @GetMapping
  public AccountMigration.Status getStatus(@AuthenticationPrincipal UUID userId) {
    return migration.status(userId);
  }

  @PutMapping("/alias")
  public AccountMigration.Status setAlias(
      @AuthenticationPrincipal UUID userId,
      @RequestBody @jakarta.validation.Valid HandleRequest request) {
    return migration.setAlias(userId, request.handle());
  }

  @DeleteMapping("/alias")
  public AccountMigration.Status clearAlias(@AuthenticationPrincipal UUID userId) {
    return migration.clearAlias(userId);
  }

  @PostMapping("/move")
  public AccountMigration.Status move(
      @AuthenticationPrincipal UUID userId,
      @RequestBody @jakarta.validation.Valid HandleRequest request) {
    return migration.moveTo(userId, request.handle());
  }
}
