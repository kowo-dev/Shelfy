package com.shelfy.api.auth;

import jakarta.persistence.Column;
import jakarta.persistence.MappedSuperclass;
import java.time.Instant;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@MappedSuperclass
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public abstract class SingleUseTokenEntity extends TokenEntity {

  @Column(nullable = false)
  private boolean used;

  protected SingleUseTokenEntity(UserEntity user, String tokenHash, Instant expiresAt) {
    super(user, tokenHash, expiresAt);
  }
}
