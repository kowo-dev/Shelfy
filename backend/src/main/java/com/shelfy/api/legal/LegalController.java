package com.shelfy.api.legal;

import com.shelfy.api.auth.RegistrationProperties;
import com.shelfy.api.federation.FederationProperties;
import com.shelfy.api.legal.dto.LegalInfoResponseDto;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/legal")
@RequiredArgsConstructor
public class LegalController {

  private final LegalProperties legalProperties;
  private final FederationProperties federationProperties;
  private final RegistrationProperties registrationProperties;

  @GetMapping("/info")
  public ResponseEntity<LegalInfoResponseDto> getInfo() {
    return ResponseEntity.ok(
        new LegalInfoResponseDto(
            legalProperties.controllerName(),
            legalProperties.contactEmail(),
            legalProperties.jurisdiction(),
            legalProperties.hostingProviderName(),
            legalProperties.hostingProviderAddress(),
            federationProperties.enabled(),
            registrationProperties.open()));
  }
}
