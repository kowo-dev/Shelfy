package com.shelfy.api.auth;

import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.time.Instant;
import lombok.AccessLevel;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "password_reset_tokens")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class PasswordResetTokenEntity extends SingleUseTokenEntity {

  public PasswordResetTokenEntity(UserEntity user, String tokenHash, Instant expiresAt) {
    super(user, tokenHash, expiresAt);
  }
}
