package com.shelfy.api.lists;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MediaListCollaboratorRepository
    extends JpaRepository<MediaListCollaboratorEntity, UUID> {
  Optional<MediaListCollaboratorEntity> findByListIdAndUserId(UUID listId, UUID userId);

  List<MediaListCollaboratorEntity> findByListIdAndStatus(
      UUID listId, ListCollaboratorStatus status);
}
