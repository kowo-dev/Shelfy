package com.shelfy.api.collaboration;

import com.shelfy.api.lists.ListCollaboratorStatus;
import com.shelfy.api.people.VisibilityPolicy;
import java.util.Optional;
import java.util.UUID;

public abstract class CollaborativeAccess<P extends Collaborative> {

  private final VisibilityPolicy visibilityPolicy;

  protected CollaborativeAccess(VisibilityPolicy visibilityPolicy) {
    this.visibilityPolicy = visibilityPolicy;
  }

  protected abstract Optional<? extends CollaboratorEntity> findCollaborator(
      UUID parentId, UUID userId);

  public boolean canView(UUID viewerId, P parent) {
    return visibilityPolicy.canView(viewerId, parent.getUserId(), parent.getVisibility())
        || membership(viewerId, parent).isPresent();
  }

  public boolean canEditItems(UUID viewerId, P parent) {
    return parent.getUserId().equals(viewerId)
        || membership(viewerId, parent)
            .filter(c -> c.getStatus() == ListCollaboratorStatus.ACCEPTED)
            .isPresent();
  }

  private Optional<? extends CollaboratorEntity> membership(UUID viewerId, P parent) {
    return viewerId == null ? Optional.empty() : findCollaborator(parent.getId(), viewerId);
  }
}
