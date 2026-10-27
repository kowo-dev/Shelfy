package com.shelfy.api.auth;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "refresh_tokens")
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class RefreshTokenEntity extends TokenEntity {

  @Column(name = "family_id", nullable = false)
  private UUID familyId;

  @Column(nullable = false)
  private boolean revoked;

  @Column(nullable = false)
  private boolean replaced;

  @Column(name = "replaced_at")
  private Instant replacedAt;

  public RefreshTokenEntity(UserEntity user, String tokenHash, Instant expiresAt, UUID familyId) {
    super(user, tokenHash, expiresAt);
    this.familyId = familyId;
  }
}
