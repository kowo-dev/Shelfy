package com.shelfy.api.versus;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.shelfy.api.auth.AvatarStorageProperties;
import com.shelfy.api.auth.AvatarStorageService;
import com.shelfy.api.auth.CollectionVisibility;
import com.shelfy.api.auth.UserRepository;
import com.shelfy.api.auth.ViewerPreferences;
import com.shelfy.api.collection.CanonicalWorkEntity;
import com.shelfy.api.collection.MediaEntity;
import com.shelfy.api.collection.MediaResolver;
import com.shelfy.api.collection.MediaType;
import com.shelfy.api.collection.dto.MediaReferenceDto;
import com.shelfy.api.comments.CommentService;
import com.shelfy.api.common.ContributorDirectory;
import com.shelfy.api.common.exception.ConflictException;
import com.shelfy.api.common.exception.ErrorCode;
import com.shelfy.api.common.exception.ForbiddenException;
import com.shelfy.api.common.exception.ResourceNotFoundException;
import com.shelfy.api.federation.CollectionPublisher;
import com.shelfy.api.federation.InteractionPublisher;
import com.shelfy.api.notifications.NotificationService;
import com.shelfy.api.people.VisibilityPolicy;
import com.shelfy.api.versus.dto.AddVersusClipRequestDto;
import com.shelfy.api.versus.dto.UpdateVersusClipRequestDto;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

class VersusPoolServiceTest {

  private final VersusPoolRepository repository = mock(VersusPoolRepository.class);
  private final MediaResolver mediaResolver = mock(MediaResolver.class);
  private final UserRepository userRepository = mock(UserRepository.class);
  private final AvatarStorageService avatarStorageService = mock(AvatarStorageService.class);
  private final VersusPoolLikeRepository likeRepository = mock(VersusPoolLikeRepository.class);
  private final CommentService commentService = mock(CommentService.class);
  private final ClipResolver clipResolver = mock(ClipResolver.class);
  private final VersusSessionRepository sessionRepository = mock(VersusSessionRepository.class);
  private final VersusPoolService service =
      new VersusPoolService(
          repository,
          mediaResolver,
          new TransactionTemplate(mock(PlatformTransactionManager.class)),
          new VisibilityPolicy(),
          userRepository,
          avatarStorageService,
          likeRepository,
          commentService,
          clipResolver,
          new VersusEntryMapper(new AvatarStorageProperties("/tmp", "http://api", 1)),
          sessionRepository,
          mock(ViewerPreferences.class),
          new VersusPoolAccess(
              new VisibilityPolicy(), mock(VersusPoolCollaboratorRepository.class)),
          mock(VersusPoolCollaboratorService.class),
          mock(VersusPoolCollaboratorRepository.class),
          mock(NotificationService.class),
          new ContributorDirectory(userRepository, avatarStorageService),
          mock(CollectionPublisher.class),
          mock(InteractionPublisher.class));
  private final UUID ownerId = UUID.randomUUID();
  private final UUID otherId = UUID.randomUUID();

  @Test
  void get_whenPoolNotFound_throwsResourceNotFound() {
    UUID poolId = UUID.randomUUID();
    when(repository.findById(poolId)).thenReturn(Optional.empty());

    ResourceNotFoundException exception =
        assertThrows(ResourceNotFoundException.class, () -> service.get(ownerId, poolId));
    assertEquals(ErrorCode.VERSUS_POOL_NOT_FOUND, exception.getCode());
  }

  @Test
  void get_whenPrivateAndViewerIsNotOwner_throwsResourceNotFoundToAvoidLeakingExistence() {
    VersusPoolEntity pool = pool(CollectionVisibility.PRIVATE);
    when(repository.findById(poolId(pool))).thenReturn(Optional.of(pool));

    ResourceNotFoundException exception =
        assertThrows(ResourceNotFoundException.class, () -> service.get(otherId, poolId(pool)));
    assertEquals(ErrorCode.VERSUS_POOL_NOT_FOUND, exception.getCode());
  }

  @Test
  void get_whenPublic_isVisibleToAnyone() {
    VersusPoolEntity pool = pool(CollectionVisibility.PUBLIC);
    when(repository.findById(poolId(pool))).thenReturn(Optional.of(pool));

    var response = service.get(otherId, poolId(pool));
    assertEquals(pool.getId(), response.id());
  }

  @Test
  void get_whenLinkOnly_isVisibleToAnyoneWithTheAddress() {
    VersusPoolEntity pool = pool(CollectionVisibility.LINK);
    when(repository.findById(poolId(pool))).thenReturn(Optional.of(pool));

    var response = service.get(otherId, poolId(pool));
    assertEquals(pool.getId(), response.id());
  }

  @Test
  void addItem_whenViewerIsNotOwner_throwsForbidden() {
    VersusPoolEntity pool = pool(CollectionVisibility.PUBLIC);
    when(repository.findById(poolId(pool))).thenReturn(Optional.of(pool));

    ForbiddenException exception =
        assertThrows(
            ForbiddenException.class,
            () ->
                service.addItem(
                    otherId, poolId(pool), new MediaReferenceDto("tmdb", MediaType.MOVIE, "1")));
    assertEquals(ErrorCode.UNAUTHORIZED, exception.getCode());
  }

  @Test
  void addItem_whenMediaAlreadyInPool_throwsConflict() {
    VersusPoolEntity pool = pool(CollectionVisibility.PUBLIC);
    MediaEntity media = media("1");
    pool.appendItem(media);
    when(repository.findById(poolId(pool))).thenReturn(Optional.of(pool));
    when(mediaResolver.findOrCreate("1", "tmdb", MediaType.MOVIE)).thenReturn(media);

    ConflictException exception =
        assertThrows(
            ConflictException.class,
            () ->
                service.addItem(
                    ownerId, poolId(pool), new MediaReferenceDto("tmdb", MediaType.MOVIE, "1")));
    assertEquals(ErrorCode.VERSUS_ITEM_ALREADY_EXISTS, exception.getCode());
  }

  @Test
  void removeItem_whenItemNotInPool_throwsResourceNotFound() {
    VersusPoolEntity pool = pool(CollectionVisibility.PUBLIC);
    when(repository.findById(poolId(pool))).thenReturn(Optional.of(pool));

    ResourceNotFoundException exception =
        assertThrows(
            ResourceNotFoundException.class,
            () -> service.removeItem(ownerId, poolId(pool), UUID.randomUUID()));
    assertEquals(ErrorCode.VERSUS_ITEM_NOT_FOUND, exception.getCode());
  }

  @Test
  void removeItem_dropsTheBracketsStillBeingPlayed() {
    VersusPoolEntity pool = pool(CollectionVisibility.PUBLIC);
    VersusPoolItemEntity entry = pool.appendItem(media("1"));
    ReflectionTestUtils.setField(entry, "id", UUID.randomUUID());
    when(repository.findById(poolId(pool))).thenReturn(Optional.of(pool));
    when(repository.save(pool)).thenReturn(pool);

    service.removeItem(ownerId, poolId(pool), entry.getId());

    assertTrue(pool.getItems().isEmpty());
    verify(sessionRepository)
        .deleteByPoolIdAndStatus(poolId(pool), VersusSessionStatus.IN_PROGRESS);
  }

  @Test
  void addClip_whenClipAlreadyInPool_throwsConflict() {
    VersusPoolEntity pool = pool(CollectionVisibility.PUBLIC);
    ClipInfo clip = new ClipInfo(ClipProvider.YOUTUBE, "dQw4w9WgXcQ", "Song", "Artist", null, null);
    pool.appendClip(clip, null, null);
    when(repository.findById(poolId(pool))).thenReturn(Optional.of(pool));
    when(clipResolver.resolve("https://youtu.be/dQw4w9WgXcQ")).thenReturn(clip);

    ConflictException exception =
        assertThrows(
            ConflictException.class,
            () ->
                service.addClip(
                    ownerId,
                    poolId(pool),
                    new AddVersusClipRequestDto("https://youtu.be/dQw4w9WgXcQ", null, null)));
    assertEquals(ErrorCode.VERSUS_ITEM_ALREADY_EXISTS, exception.getCode());
  }

  @Test
  void addClip_unlinked_showsTheClipTitleAndProxiedThumbnail() {
    VersusPoolEntity pool = pool(CollectionVisibility.PUBLIC);
    ClipInfo clip =
        new ClipInfo(
            ClipProvider.YOUTUBE,
            "dQw4w9WgXcQ",
            "Track",
            "Artist",
            "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
            null);
    when(repository.findById(poolId(pool))).thenReturn(Optional.of(pool));
    when(repository.save(pool)).thenReturn(pool);
    when(clipResolver.resolve("https://youtu.be/dQw4w9WgXcQ")).thenReturn(clip);

    var response =
        service.addClip(
            ownerId,
            poolId(pool),
            new AddVersusClipRequestDto("https://youtu.be/dQw4w9WgXcQ", 30, null));

    var entry = response.entries().get(0);
    assertEquals("Track", entry.title());
    assertEquals(30, entry.clip().startSeconds());
    assertNull(entry.media());
    assertEquals(
        "http://api/api/v1/versus/clips/thumbnail?src=https%3A%2F%2Fi.ytimg.com%2Fvi%2FdQw4w9WgXcQ%2Fhq720.jpg",
        entry.coverUrl());
  }

  @Test
  void addClip_linked_keepsItsTitleWithTheLinkedPoster() {
    VersusPoolEntity pool = pool(CollectionVisibility.PUBLIC);
    ClipInfo clip =
        new ClipInfo(
            ClipProvider.YOUTUBE,
            "dQw4w9WgXcQ",
            "Trailer",
            "Studio",
            "https://i.ytimg.com/a.jpg",
            null);
    MediaEntity movie = media("42");
    ReflectionTestUtils.setField(movie, "coverUrl", "https://image.tmdb.org/poster.jpg");
    when(repository.findById(poolId(pool))).thenReturn(Optional.of(pool));
    when(repository.save(pool)).thenReturn(pool);
    when(clipResolver.resolve("https://youtu.be/dQw4w9WgXcQ")).thenReturn(clip);
    when(mediaResolver.findOrCreate("42", "tmdb", MediaType.MOVIE)).thenReturn(movie);

    var entry =
        service
            .addClip(
                ownerId,
                poolId(pool),
                new AddVersusClipRequestDto(
                    "https://youtu.be/dQw4w9WgXcQ",
                    null,
                    new MediaReferenceDto("tmdb", MediaType.MOVIE, "42")))
            .entries()
            .get(0);

    assertEquals("Trailer", entry.title());
    assertEquals("https://image.tmdb.org/poster.jpg", entry.coverUrl());
    assertEquals("Title", entry.media().title());
  }

  @Test
  void updateClip_changesStartAndLinkButKeepsTheEntry() {
    VersusPoolEntity pool = pool(CollectionVisibility.PUBLIC);
    VersusPoolItemEntity entry =
        pool.appendClip(
            new ClipInfo(ClipProvider.YOUTUBE, "dQw4w9WgXcQ", "Song", null, null, null), 10, null);
    UUID entryId = UUID.randomUUID();
    ReflectionTestUtils.setField(entry, "id", entryId);
    MediaEntity movie = media("42");
    when(repository.findById(poolId(pool))).thenReturn(Optional.of(pool));
    when(repository.save(pool)).thenReturn(pool);
    when(mediaResolver.findOrCreate("42", "tmdb", MediaType.MOVIE)).thenReturn(movie);

    var updated =
        service
            .updateClip(
                ownerId,
                poolId(pool),
                entryId,
                new UpdateVersusClipRequestDto(
                    90, new MediaReferenceDto("tmdb", MediaType.MOVIE, "42")))
            .entries()
            .get(0);

    assertEquals(entryId, updated.id());
    assertEquals(90, updated.clip().startSeconds());
    assertEquals("Song", updated.title());
    assertEquals("Title", updated.media().title());
  }

  @Test
  void addItems_addsAllInOneSaveAndSkipsThoseAlreadyThere() {
    VersusPoolEntity pool = pool(CollectionVisibility.PUBLIC);
    MediaEntity existing = media("1");
    pool.appendItem(existing);
    when(repository.findById(poolId(pool))).thenReturn(Optional.of(pool));
    when(repository.save(pool)).thenReturn(pool);
    when(mediaResolver.findOrCreateAll(anyList()))
        .thenReturn(List.of(existing, media("2"), media("3")));

    service.addItems(
        ownerId,
        poolId(pool),
        List.of(
            new MediaReferenceDto("tmdb", MediaType.MOVIE, "1"),
            new MediaReferenceDto("tmdb", MediaType.MOVIE, "2"),
            new MediaReferenceDto("tmdb", MediaType.MOVIE, "3")));

    assertEquals(3, pool.getItems().size());
    verify(repository, times(1)).save(pool);
  }

  @Test
  void update_whenViewerIsNotOwner_throwsForbidden() {
    VersusPoolEntity pool = pool(CollectionVisibility.PUBLIC);
    when(repository.findById(poolId(pool))).thenReturn(Optional.of(pool));

    assertThrows(
        ForbiddenException.class,
        () ->
            service.update(
                otherId,
                poolId(pool),
                new com.shelfy.api.versus.dto.CreateVersusPoolRequestDto(
                    "New name", null, CollectionVisibility.PUBLIC)));
  }

  private VersusPoolEntity pool(CollectionVisibility visibility) {
    VersusPoolEntity pool = new VersusPoolEntity(ownerId, "Pool", null, visibility);
    ReflectionTestUtils.setField(pool, "id", UUID.randomUUID());
    return pool;
  }

  private UUID poolId(VersusPoolEntity pool) {
    return pool.getId();
  }

  private MediaEntity media(String externalId) {
    MediaEntity media =
        new MediaEntity(
            externalId,
            "tmdb",
            MediaType.MOVIE,
            new CanonicalWorkEntity(MediaType.MOVIE),
            "Title",
            null,
            Map.of(),
            false);
    media.setId(UUID.randomUUID());
    return media;
  }
}
