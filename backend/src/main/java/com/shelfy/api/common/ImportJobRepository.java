package com.shelfy.api.common;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.NoRepositoryBean;
import org.springframework.data.repository.query.Param;

@NoRepositoryBean
public interface ImportJobRepository<J extends ImportJobEntity> extends JpaRepository<J, UUID> {
  Optional<J> findFirstByUserIdOrderByCreatedAtDesc(UUID userId);

  Optional<J> findByIdAndUserId(UUID id, UUID userId);

  List<J> findAllByUserIdOrderByCreatedAtDesc(UUID userId);

  @Modifying
  @Query(
      "update #{#entityName} j set j.status = com.shelfy.api.common.ImportStatus.FAILED, "
          + "j.errorMessage = 'Interrupted by a server restart', j.completedAt = :now "
          + "where j.status in (com.shelfy.api.common.ImportStatus.PENDING, "
          + "com.shelfy.api.common.ImportStatus.PROCESSING)")
  int failActiveJobs(@Param("now") Instant now);
}
