package com.shelfy.api.people;

import com.shelfy.api.auth.CollectionVisibility;
import com.shelfy.api.auth.UserEntity;
import java.util.UUID;
import org.springframework.stereotype.Component;

@Component
public class VisibilityPolicy {

  public boolean canView(UUID viewerId, UUID ownerId, CollectionVisibility visibility) {
    return ownerId.equals(viewerId) || visibility != CollectionVisibility.PRIVATE;
  }

  public boolean canViewProfile(UUID viewerId, UserEntity owner) {
    return owner.getId().equals(viewerId)
        || owner.getProfileVisibility() == CollectionVisibility.PUBLIC;
  }
}
