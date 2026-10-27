package com.shelfy.api.auth;

import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.time.Instant;
import lombok.AccessLevel;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "email_verification_tokens")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class EmailVerificationTokenEntity extends SingleUseTokenEntity {

  public EmailVerificationTokenEntity(UserEntity user, String tokenHash, Instant expiresAt) {
    super(user, tokenHash, expiresAt);
  }
}
