package com.shelfy.api.lists;

import com.shelfy.api.collaboration.CollaborativeAccess;
import com.shelfy.api.people.VisibilityPolicy;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Component;

@Component
public class MediaListAccess extends CollaborativeAccess<MediaListEntity> {

  private final MediaListCollaboratorRepository collaboratorRepository;

  public MediaListAccess(
      VisibilityPolicy visibilityPolicy, MediaListCollaboratorRepository collaboratorRepository) {
    super(visibilityPolicy);
    this.collaboratorRepository = collaboratorRepository;
  }

  @Override
  protected Optional<MediaListCollaboratorEntity> findCollaborator(UUID listId, UUID userId) {
    return collaboratorRepository.findByListIdAndUserId(listId, userId);
  }
}
