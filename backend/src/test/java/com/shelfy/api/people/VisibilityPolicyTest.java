package com.shelfy.api.people;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.shelfy.api.auth.CollectionVisibility;
import com.shelfy.api.auth.UserEntity;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

class VisibilityPolicyTest {

  private final VisibilityPolicy policy = new VisibilityPolicy();
  private final UUID owner = UUID.randomUUID();
  private final UUID stranger = UUID.randomUUID();

  @Test
  void ownerSeesEverything() {
    for (CollectionVisibility visibility : CollectionVisibility.values()) {
      assertTrue(policy.canView(owner, owner, visibility));
    }
  }

  @Test
  void publicIsOpenToEveryoneIncludingAnonymousViewers() {
    assertTrue(policy.canView(stranger, owner, CollectionVisibility.PUBLIC));
    assertTrue(policy.canView(null, owner, CollectionVisibility.PUBLIC));
  }

  @Test
  void linkIsOpenToAnyoneHoldingTheAddress() {
    assertTrue(policy.canView(stranger, owner, CollectionVisibility.LINK));
    assertTrue(policy.canView(null, owner, CollectionVisibility.LINK));
  }

  @Test
  void privateIsOwnerOnly() {
    assertFalse(policy.canView(stranger, owner, CollectionVisibility.PRIVATE));
    assertFalse(policy.canView(null, owner, CollectionVisibility.PRIVATE));
  }

  @Test
  void profileIsVisibleOnlyWhenPublicOrOwn() {
    UserEntity user = new UserEntity("owner@example.com", "owner", "hash");
    ReflectionTestUtils.setField(user, "id", owner);

    user.setProfileVisibility(CollectionVisibility.PUBLIC);
    assertTrue(policy.canViewProfile(null, user));

    user.setProfileVisibility(CollectionVisibility.PRIVATE);
    assertFalse(policy.canViewProfile(stranger, user));
    assertTrue(policy.canViewProfile(owner, user));
  }
}
