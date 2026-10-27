package com.shelfy.api.auth;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PasswordResetTokenRepository
    extends JpaRepository<PasswordResetTokenEntity, UUID> {

  Optional<PasswordResetTokenEntity> findByTokenHash(String tokenHash);

  boolean existsByUserIdAndCreatedAtAfter(UUID userId, Instant after);

  @Modifying
  @Query(
      "update PasswordResetTokenEntity token set token.used = true where token.user.id = :userId")
  int markAllUsedByUserId(@Param("userId") UUID userId);

  @Modifying
  @Query("delete from PasswordResetTokenEntity token where token.expiresAt < :cutoff")
  int deleteExpiredBefore(@Param("cutoff") Instant cutoff);
}
