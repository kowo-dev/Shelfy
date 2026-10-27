package com.shelfy.api.versus;

import com.shelfy.api.versus.dto.StartVersusSessionResponseDto;
import com.shelfy.api.versus.dto.SubmitPickRequestDto;
import com.shelfy.api.versus.dto.VersusFollowedSessionResponseDto;
import com.shelfy.api.versus.dto.VersusMatchResponseDto;
import com.shelfy.api.versus.dto.VersusSessionResultResponseDto;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/versus/sessions")
@RequiredArgsConstructor
public class VersusSessionController {
  private final VersusSessionService sessionService;
  private final VersusSessionResultService resultService;

  @GetMapping("/current")
  public ResponseEntity<StartVersusSessionResponseDto> getCurrent(
      @AuthenticationPrincipal UUID userId, @RequestParam UUID poolId) {
    return sessionService
        .getCurrentSession(userId, poolId)
        .map(ResponseEntity::ok)
        .orElseGet(() -> ResponseEntity.noContent().build());
  }

  @GetMapping("/following")
  public List<VersusFollowedSessionResponseDto> listFollowing(
      @AuthenticationPrincipal UUID userId, @RequestParam UUID poolId) {
    return resultService.listFollowedSessions(userId, poolId);
  }

  @PostMapping
  public ResponseEntity<StartVersusSessionResponseDto> start(
      @AuthenticationPrincipal UUID userId,
      @Valid @RequestBody StartVersusSessionRequestDto request) {
    return ResponseEntity.status(HttpStatus.CREATED)
        .body(sessionService.startSession(userId, request.poolId()));
  }

  @GetMapping("/{sessionId}")
  public StartVersusSessionResponseDto get(
      @AuthenticationPrincipal UUID userId, @PathVariable UUID sessionId) {
    return sessionService.getSession(userId, sessionId);
  }

  @PostMapping("/{sessionId}/picks")
  public StartVersusSessionResponseDto pick(
      @AuthenticationPrincipal UUID userId,
      @PathVariable UUID sessionId,
      @Valid @RequestBody SubmitPickRequestDto request) {
    return sessionService.submitPick(userId, sessionId, request);
  }

  @PostMapping("/{sessionId}/undo")
  public StartVersusSessionResponseDto undo(
      @AuthenticationPrincipal UUID userId, @PathVariable UUID sessionId) {
    return sessionService.undo(userId, sessionId);
  }

  @GetMapping("/{sessionId}/result")
  public VersusSessionResultResponseDto getResult(
      @AuthenticationPrincipal UUID userId, @PathVariable UUID sessionId) {
    return resultService.getResult(userId, sessionId);
  }

  @GetMapping("/{sessionId}/bracket")
  public List<VersusMatchResponseDto> getBracket(
      @AuthenticationPrincipal UUID userId, @PathVariable UUID sessionId) {
    return sessionService.getBracket(userId, sessionId);
  }

  public record StartVersusSessionRequestDto(@NotNull UUID poolId) {}
}
