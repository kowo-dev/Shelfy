package com.shelfy.api.essentials;

import com.shelfy.api.auth.ViewerPreferences;
import com.shelfy.api.essentials.dto.EssentialEntryResponseDto;
import com.shelfy.api.essentials.dto.UpdateEssentialsRequestDto;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/essentials")
@RequiredArgsConstructor
public class EssentialsController {

  private final EssentialsService essentialsService;
  private final ViewerPreferences viewerPreferences;

  @PutMapping
  public ResponseEntity<List<EssentialEntryResponseDto>> replace(
      @AuthenticationPrincipal UUID userId,
      @Valid @RequestBody UpdateEssentialsRequestDto request) {
    return ResponseEntity.ok(
        essentialsService.replace(
            userId, request.userMediaIds(), viewerPreferences.allowsAdultContent(userId)));
  }
}
