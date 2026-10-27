package com.shelfy.api.versus;

import com.shelfy.api.collaboration.CollaborativeAccess;
import com.shelfy.api.people.VisibilityPolicy;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Component;

@Component
public class VersusPoolAccess extends CollaborativeAccess<VersusPoolEntity> {

  private final VersusPoolCollaboratorRepository collaboratorRepository;

  public VersusPoolAccess(
      VisibilityPolicy visibilityPolicy, VersusPoolCollaboratorRepository collaboratorRepository) {
    super(visibilityPolicy);
    this.collaboratorRepository = collaboratorRepository;
  }

  @Override
  protected Optional<VersusPoolCollaboratorEntity> findCollaborator(UUID poolId, UUID userId) {
    return collaboratorRepository.findByPoolIdAndUserId(poolId, userId);
  }
}
