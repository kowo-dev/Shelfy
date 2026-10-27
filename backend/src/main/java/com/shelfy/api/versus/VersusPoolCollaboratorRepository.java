package com.shelfy.api.versus;

import com.shelfy.api.lists.ListCollaboratorStatus;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface VersusPoolCollaboratorRepository
    extends JpaRepository<VersusPoolCollaboratorEntity, UUID> {
  Optional<VersusPoolCollaboratorEntity> findByPoolIdAndUserId(UUID poolId, UUID userId);

  List<VersusPoolCollaboratorEntity> findByPoolIdAndStatus(
      UUID poolId, ListCollaboratorStatus status);
}
