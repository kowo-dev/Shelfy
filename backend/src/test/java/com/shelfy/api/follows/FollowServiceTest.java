package com.shelfy.api.follows;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.shelfy.api.auth.AvatarStorageService;
import com.shelfy.api.auth.CollectionVisibility;
import com.shelfy.api.auth.UserEntity;
import com.shelfy.api.auth.UserRepository;
import com.shelfy.api.common.exception.ApiException;
import com.shelfy.api.common.exception.ConflictException;
import com.shelfy.api.common.exception.ErrorCode;
import com.shelfy.api.common.exception.ForbiddenException;
import com.shelfy.api.common.exception.ResourceNotFoundException;
import com.shelfy.api.federation.FederatedFollows;
import com.shelfy.api.federation.FederationProperties;
import com.shelfy.api.notifications.NotificationService;
import com.shelfy.api.people.PersonCards;
import com.shelfy.api.people.VisibilityPolicy;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class FollowServiceTest {

  private final FollowRepository followRepository = mock(FollowRepository.class);
  private final UserRepository userRepository = mock(UserRepository.class);
  private final VisibilityPolicy visibilityPolicy = mock(VisibilityPolicy.class);
  private final FollowService followService =
      new FollowService(
          followRepository,
          userRepository,
          visibilityPolicy,
          mock(AvatarStorageService.class),
          mock(FederatedFollows.class),
          mock(FederationProperties.class),
          mock(NotificationService.class),
          mock(PersonCards.class));

  private final UUID follower = UUID.randomUUID();
  private final UUID followed = UUID.randomUUID();

  @Test
  void follow_rejectsSelfFollow() {
    ApiException ex =
        assertThrows(ApiException.class, () -> followService.follow(follower, follower));

    assertEquals(ErrorCode.CANNOT_FOLLOW_SELF, ex.getCode());
    verify(followRepository, never()).save(any());
  }

  @Test
  void follow_rejectsUnknownUser() {
    when(userRepository.findById(followed)).thenReturn(Optional.empty());

    ResourceNotFoundException ex =
        assertThrows(
            ResourceNotFoundException.class, () -> followService.follow(follower, followed));

    assertEquals(ErrorCode.USER_NOT_FOUND, ex.getCode());
    verify(followRepository, never()).save(any());
  }

  @Test
  void follow_rejectsDuplicate() {
    when(userRepository.findById(followed)).thenReturn(Optional.of(new UserEntity()));
    when(followRepository.existsByFollowerIdAndFollowedId(follower, followed)).thenReturn(true);

    ConflictException ex =
        assertThrows(ConflictException.class, () -> followService.follow(follower, followed));

    assertEquals(ErrorCode.ALREADY_FOLLOWING, ex.getCode());
    verify(followRepository, never()).save(any());
  }

  @Test
  void follow_savesNewFollow() {
    when(userRepository.findById(followed)).thenReturn(Optional.of(new UserEntity()));
    when(followRepository.existsByFollowerIdAndFollowedId(follower, followed)).thenReturn(false);

    followService.follow(follower, followed);

    verify(followRepository).save(any(FollowEntity.class));
  }

  @Test
  void requireVisible_allowsOwnProfileWithoutLookup() {
    followService.requireVisible(follower, follower);

    verify(userRepository, never()).findById(any());
  }

  @Test
  void requireVisible_throwsNotFoundForUnknownTarget() {
    when(userRepository.findById(followed)).thenReturn(Optional.empty());

    assertThrows(
        ResourceNotFoundException.class, () -> followService.requireVisible(follower, followed));
  }

  @Test
  void requireVisible_forbidsPrivateProfile() {
    UserEntity target = new UserEntity("t@example.com", "target", "hash");
    target.setId(followed);
    target.setProfileVisibility(CollectionVisibility.PRIVATE);
    when(userRepository.findById(followed)).thenReturn(Optional.of(target));
    when(visibilityPolicy.canViewProfile(follower, target)).thenReturn(false);

    ForbiddenException ex =
        assertThrows(
            ForbiddenException.class, () -> followService.requireVisible(follower, followed));

    assertEquals(ErrorCode.PROFILE_PRIVATE, ex.getCode());
  }

  @Test
  void requireVisible_allowsVisibleProfile() {
    UserEntity target = new UserEntity("t@example.com", "target", "hash");
    target.setId(followed);
    when(userRepository.findById(followed)).thenReturn(Optional.of(target));
    when(visibilityPolicy.canViewProfile(follower, target)).thenReturn(true);

    followService.requireVisible(follower, followed);
  }
}
