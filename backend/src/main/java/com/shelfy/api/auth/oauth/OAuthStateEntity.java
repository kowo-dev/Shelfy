package com.shelfy.api.auth.oauth;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "oauth_states")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class OAuthStateEntity {

  @Id @GeneratedValue private UUID id;

  @Column(name = "user_id", nullable = false)
  private UUID userId;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false)
  private OAuthProvider provider;

  @Column(name = "state_hash", nullable = false, unique = true)
  private String stateHash;

  @Column(name = "browser_token_hash", nullable = false)
  private String browserTokenHash;

  @Column(name = "expires_at", nullable = false)
  private Instant expiresAt;

  @Column(name = "used_at")
  private Instant usedAt;

  @Column(name = "created_at", nullable = false, updatable = false)
  private Instant createdAt;

  public OAuthStateEntity(
      UUID userId,
      OAuthProvider provider,
      String stateHash,
      String browserTokenHash,
      Instant expiresAt) {
    this.userId = userId;
    this.provider = provider;
    this.stateHash = stateHash;
    this.browserTokenHash = browserTokenHash;
    this.expiresAt = expiresAt;
  }

  @PrePersist
  void onCreate() {
    createdAt = Instant.now();
  }
}
