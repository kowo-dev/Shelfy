package com.shelfy.api.auth;

import jakarta.persistence.LockModeType;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface RefreshTokenRepository extends JpaRepository<RefreshTokenEntity, UUID> {

  Optional<RefreshTokenEntity> findByTokenHash(String tokenHash);

  @Lock(LockModeType.PESSIMISTIC_WRITE)
  @Query(
      "select token from RefreshTokenEntity token join fetch token.user "
          + "where token.tokenHash = :tokenHash")
  Optional<RefreshTokenEntity> findByTokenHashForUpdate(@Param("tokenHash") String tokenHash);

  @Modifying
  @Query(
      "update RefreshTokenEntity token set token.revoked = true where token.familyId = :familyId")
  int revokeAllByFamilyId(@Param("familyId") UUID familyId);

  @Modifying
  @Query("update RefreshTokenEntity token set token.revoked = true where token.user.id = :userId")
  int revokeAllByUserId(@Param("userId") UUID userId);

  @Modifying
  @Query("delete from RefreshTokenEntity token where token.expiresAt < :cutoff")
  int deleteExpiredBefore(@Param("cutoff") Instant cutoff);
}
