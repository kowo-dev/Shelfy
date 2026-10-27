package com.shelfy.api.auth;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.time.Instant;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "email_change_tokens")
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class EmailChangeTokenEntity extends SingleUseTokenEntity {

  @Column(name = "new_email", nullable = false)
  private String newEmail;

  public EmailChangeTokenEntity(
      UserEntity user, String newEmail, String tokenHash, Instant expiresAt) {
    super(user, tokenHash, expiresAt);
    this.newEmail = newEmail;
  }
}
