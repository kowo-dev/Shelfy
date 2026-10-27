package com.shelfy.api.users;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.shelfy.api.activity.UserActivityService;
import com.shelfy.api.auth.AvatarStorageService;
import com.shelfy.api.auth.CollectionVisibility;
import com.shelfy.api.auth.UserEntity;
import com.shelfy.api.auth.UserRepository;
import com.shelfy.api.auth.ViewerPreferences;
import com.shelfy.api.collection.CollectionService;
import com.shelfy.api.collection.MediaRepository;
import com.shelfy.api.collection.UserMediaEntity;
import com.shelfy.api.collection.UserMediaRepository;
import com.shelfy.api.collection.WatchLogService;
import com.shelfy.api.collection.dto.CollectionFilter;
import com.shelfy.api.collection.dto.WatchLogResponseDto;
import com.shelfy.api.comments.CommentService;
import com.shelfy.api.common.Paging;
import com.shelfy.api.common.exception.BadRequestException;
import com.shelfy.api.common.exception.ErrorCode;
import com.shelfy.api.common.exception.ForbiddenException;
import com.shelfy.api.common.exception.ResourceNotFoundException;
import com.shelfy.api.essentials.EssentialsService;
import com.shelfy.api.federation.InteractionPublisher;
import com.shelfy.api.federation.RemoteActorService;
import com.shelfy.api.follows.FollowService;
import com.shelfy.api.notifications.NotificationService;
import com.shelfy.api.people.VisibilityPolicy;
import com.shelfy.api.users.dto.UserProfileResponseDto;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class UserProfileServiceTest {

  private static final CollectionFilter NO_FILTER =
      new CollectionFilter(null, null, null, null, null, null, null);

  private final UserRepository userRepository = mock(UserRepository.class);
  private final CollectionService collectionService = mock(CollectionService.class);
  private final EssentialsService essentialsService = mock(EssentialsService.class);
  private final UserMediaRepository userMediaRepository = mock(UserMediaRepository.class);
  private final AvatarStorageService avatarStorageService = mock(AvatarStorageService.class);
  private final FollowService followService = mock(FollowService.class);
  private final MediaRepository mediaRepository = mock(MediaRepository.class);
  private final UserActivityService userActivityService = mock(UserActivityService.class);
  private final ReviewLikeRepository reviewLikeRepository = mock(ReviewLikeRepository.class);
  private final CommentService commentService = mock(CommentService.class);
  private final WatchLogService watchLogService = mock(WatchLogService.class);
  private final UserProfileService userProfileService =
      new UserProfileService(
          userRepository,
          new VisibilityPolicy(),
          collectionService,
          essentialsService,
          userMediaRepository,
          avatarStorageService,
          followService,
          mediaRepository,
          userActivityService,
          reviewLikeRepository,
          commentService,
          mock(ViewerPreferences.class),
          mock(RemoteActorService.class),
          mock(InteractionPublisher.class),
          mock(NotificationService.class),
          watchLogService);

  @Test
  void getReviewWatchLog_listsTheAuthorsViewings() {
    UserEntity author = new UserEntity("a@example.com", "Author", "hash");
    author.setId(UUID.randomUUID());
    UserMediaEntity review = review(author);
    List<WatchLogResponseDto> viewings = List.of(mock(WatchLogResponseDto.class));
    when(watchLogService.list(author.getId(), review.getId())).thenReturn(viewings);

    assertEquals(viewings, userProfileService.getReviewWatchLog(null, review.getId()));
  }

  @Test
  void getReviewWatchLog_privateAuthorIsNotFound() {
    UserEntity author = new UserEntity("p@example.com", "Hidden", "hash");
    author.setId(UUID.randomUUID());
    author.setProfileVisibility(CollectionVisibility.PRIVATE);
    UserMediaEntity review = review(author);

    assertThrows(
        ResourceNotFoundException.class,
        () -> userProfileService.getReviewWatchLog(UUID.randomUUID(), review.getId()));
    verify(watchLogService, never()).list(any(), any());
  }

  private UserMediaEntity review(UserEntity author) {
    UserMediaEntity review = mock(UserMediaEntity.class);
    UUID id = UUID.randomUUID();
    when(review.getId()).thenReturn(id);
    when(review.getUserId()).thenReturn(author.getId());
    when(review.getNote()).thenReturn(Map.of("type", "doc"));
    when(userMediaRepository.findById(id)).thenReturn(Optional.of(review));
    when(userRepository.findById(author.getId())).thenReturn(Optional.of(author));
    return review;
  }

  @Test
  void getProfile_findsUsernameIgnoringCase() {
    UUID userId = UUID.randomUUID();
    UserEntity user = new UserEntity("user@example.com", "ShelfMaster", "hash");
    user.setId(userId);
    when(userRepository.findByUsernameIgnoreCase("shelfmaster")).thenReturn(Optional.of(user));

    UserProfileResponseDto profile = userProfileService.getProfile(userId, "shelfmaster");

    assertEquals("ShelfMaster", profile.username());
    verify(userRepository).findByUsernameIgnoreCase("shelfmaster");
  }

  @Test
  void getProfile_unknownUsernameIsNotFound() {
    when(userRepository.findByUsernameIgnoreCase("ghost")).thenReturn(Optional.empty());

    ResourceNotFoundException ex =
        assertThrows(
            ResourceNotFoundException.class,
            () -> userProfileService.getProfile(UUID.randomUUID(), "ghost"));

    assertEquals(ErrorCode.USER_NOT_FOUND, ex.getCode());
  }

  @Test
  void getProfile_privateProfileIsForbiddenForOthersAndGuests() {
    UserEntity target = new UserEntity("p@example.com", "Hidden", "hash");
    target.setId(UUID.randomUUID());
    target.setProfileVisibility(CollectionVisibility.PRIVATE);
    when(userRepository.findByUsernameIgnoreCase("hidden")).thenReturn(Optional.of(target));

    ForbiddenException other =
        assertThrows(
            ForbiddenException.class,
            () -> userProfileService.getProfile(UUID.randomUUID(), "hidden"));
    ForbiddenException guest =
        assertThrows(ForbiddenException.class, () -> userProfileService.getProfile(null, "hidden"));

    assertEquals(ErrorCode.PROFILE_PRIVATE, other.getCode());
    assertEquals(ErrorCode.PROFILE_PRIVATE, guest.getCode());
  }

  @Test
  void getEssentials_privateProfileIsForbidden() {
    UserEntity target = new UserEntity("p@example.com", "Hidden", "hash");
    target.setId(UUID.randomUUID());
    target.setProfileVisibility(CollectionVisibility.PRIVATE);
    when(userRepository.findByUsernameIgnoreCase("hidden")).thenReturn(Optional.of(target));

    ForbiddenException ex =
        assertThrows(
            ForbiddenException.class,
            () -> userProfileService.getEssentials(UUID.randomUUID(), "hidden"));

    assertEquals(ErrorCode.PROFILE_PRIVATE, ex.getCode());
  }

  @Test
  void getCommonCollection_unknownUsernameIsNotFound() {
    when(userRepository.findByUsernameIgnoreCase("ghost")).thenReturn(Optional.empty());

    ResourceNotFoundException ex =
        assertThrows(
            ResourceNotFoundException.class,
            () ->
                userProfileService.getCommonCollection(
                    UUID.randomUUID(), "ghost", NO_FILTER, Paging.of(0, 24)));

    assertEquals(ErrorCode.USER_NOT_FOUND, ex.getCode());
  }

  @Test
  void getCommonCollection_privateProfileIsForbidden() {
    UserEntity target = new UserEntity("p@example.com", "Hidden", "hash");
    target.setId(UUID.randomUUID());
    target.setProfileVisibility(CollectionVisibility.PRIVATE);
    when(userRepository.findByUsernameIgnoreCase("hidden")).thenReturn(Optional.of(target));

    ForbiddenException ex =
        assertThrows(
            ForbiddenException.class,
            () ->
                userProfileService.getCommonCollection(
                    UUID.randomUUID(), "hidden", NO_FILTER, Paging.of(0, 24)));

    assertEquals(ErrorCode.PROFILE_PRIVATE, ex.getCode());
  }

  @Test
  void getCommonCollection_comparingWithYourselfIsRejected() {
    UUID userId = UUID.randomUUID();
    UserEntity me = new UserEntity("me@example.com", "Me", "hash");
    me.setId(userId);
    when(userRepository.findByUsernameIgnoreCase("me")).thenReturn(Optional.of(me));

    BadRequestException ex =
        assertThrows(
            BadRequestException.class,
            () ->
                userProfileService.getCommonCollection(userId, "me", NO_FILTER, Paging.of(0, 24)));

    assertEquals(ErrorCode.COMPARE_WITH_SELF, ex.getCode());
  }
}
