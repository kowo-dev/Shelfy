package com.shelfy.api.collection;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.shelfy.api.activity.UserActivityService;
import com.shelfy.api.auth.ViewerPreferences;
import com.shelfy.api.collection.dto.AddToCollectionRequestDto;
import com.shelfy.api.collection.dto.UpdateCollectionItemRequestDto;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.ObjectMapper;

class CollectionServiceTest {

  private final MediaRepository mediaRepository = mock(MediaRepository.class);
  private final UserMediaRepository userMediaRepository = mock(UserMediaRepository.class);
  private final ViewerPreferences viewerPreferences = mock(ViewerPreferences.class);
  private final MediaCatalogService mediaCatalogService = mock(MediaCatalogService.class);
  private final CanonicalWorkService canonicalWorkService = mock(CanonicalWorkService.class);
  private final UserActivityService userActivityService = mock(UserActivityService.class);
  private final UserMediaEpisodeRepository episodeRepository =
      mock(UserMediaEpisodeRepository.class);
  private final EpisodeTotalBackfill episodeTotalBackfill = mock(EpisodeTotalBackfill.class);
  private final EpisodeProgressService episodeProgressService = mock(EpisodeProgressService.class);
  private final WatchLogService watchLogService = mock(WatchLogService.class);
  private final TransactionTemplate transactionTemplate =
      new TransactionTemplate(mock(PlatformTransactionManager.class));
  private final MediaResolver mediaResolver =
      new MediaResolver(
          mediaRepository, mediaCatalogService, canonicalWorkService, transactionTemplate);
  private final RichTextContentValidator richTextContentValidator = new RichTextContentValidator();
  private final ObjectMapper objectMapper = new ObjectMapper();
  private final CollectionService collectionService =
      new CollectionService(
          mediaRepository,
          userMediaRepository,
          viewerPreferences,
          mediaResolver,
          canonicalWorkService,
          userActivityService,
          episodeRepository,
          episodeTotalBackfill,
          episodeProgressService,
          watchLogService,
          richTextContentValidator,
          objectMapper,
          transactionTemplate);

  @Test
  void addItem_createsCanonicalMediaFromTheProvider() {
    UUID userId = UUID.randomUUID();
    AddToCollectionRequestDto request =
        new AddToCollectionRequestDto(
            "42", "tmdb", MediaType.MOVIE, UserMediaStatus.PLANNED, null, Map.of(), null);
    CanonicalMedia canonical =
        new CanonicalMedia(
            "Canonical title",
            "https://provider.example/cover",
            Map.of("rating", 8),
            false,
            Set.of());
    CanonicalWorkEntity canonicalWork = new CanonicalWorkEntity(MediaType.MOVIE);
    when(mediaRepository.findByExternalIdAndProviderAndMediaType("42", "tmdb", MediaType.MOVIE))
        .thenReturn(Optional.empty());
    when(mediaCatalogService.resolve("tmdb", MediaType.MOVIE, "42")).thenReturn(canonical);
    when(canonicalWorkService.resolve(eq(MediaType.MOVIE), any())).thenReturn(canonicalWork);
    when(mediaRepository.saveAndFlush(any(MediaEntity.class)))
        .thenAnswer(invocation -> invocation.getArgument(0));
    when(userMediaRepository.existsByUserIdAndMediaId(eq(userId), any())).thenReturn(false);
    when(userMediaRepository.saveAndFlush(any(UserMediaEntity.class)))
        .thenAnswer(invocation -> invocation.getArgument(0));

    collectionService.addItem(userId, request);

    ArgumentCaptor<MediaEntity> mediaCaptor = ArgumentCaptor.forClass(MediaEntity.class);
    verify(mediaRepository).saveAndFlush(mediaCaptor.capture());
    MediaEntity savedMedia = mediaCaptor.getValue();
    assertEquals("Canonical title", savedMedia.getTitle());
    assertEquals("https://provider.example/cover", savedMedia.getCoverUrl());
    assertEquals(Map.of("rating", 8), savedMedia.getMetadata());
  }

  @Test
  void addItem_whenDone_marksEveryReleasedEpisodeWatched() {
    UUID userId = UUID.randomUUID();
    MediaEntity show = knownMedia("7", MediaType.TV_SHOW);
    when(mediaRepository.findByExternalIdAndProviderAndMediaType("7", "tmdb", MediaType.TV_SHOW))
        .thenReturn(Optional.of(show));
    when(userMediaRepository.saveAndFlush(any(UserMediaEntity.class)))
        .thenAnswer(
            invocation -> {
              UserMediaEntity item = invocation.getArgument(0);
              ReflectionTestUtils.setField(item, "id", UUID.randomUUID());
              return item;
            });

    collectionService.addItem(
        userId,
        new AddToCollectionRequestDto(
            "7", "tmdb", MediaType.TV_SHOW, UserMediaStatus.DONE, null, Map.of(), null));

    verify(episodeProgressService).fillOnCompletion(any(UserMediaEntity.class));
    verify(watchLogService).logCompletion(any(UserMediaEntity.class), any());
  }

  @Test
  void addItem_whenNotDone_leavesEpisodesUntouched() {
    UUID userId = UUID.randomUUID();
    MediaEntity show = knownMedia("8", MediaType.TV_SHOW);
    when(mediaRepository.findByExternalIdAndProviderAndMediaType("8", "tmdb", MediaType.TV_SHOW))
        .thenReturn(Optional.of(show));
    when(userMediaRepository.saveAndFlush(any(UserMediaEntity.class)))
        .thenAnswer(invocation -> invocation.getArgument(0));

    collectionService.addItem(
        userId,
        new AddToCollectionRequestDto(
            "8", "tmdb", MediaType.TV_SHOW, UserMediaStatus.ONGOING, null, Map.of(), null));

    verify(episodeProgressService, never()).fillOnCompletion(any(UserMediaEntity.class));
    verify(watchLogService, never()).logCompletion(any(UserMediaEntity.class), any());
  }

  @Test
  void updateItem_stampsTheReviewDateOnTheFirstNoteOnly() {
    UUID userId = UUID.randomUUID();
    UserMediaEntity item =
        new UserMediaEntity(
            userId, knownMedia("9", MediaType.MOVIE), UserMediaStatus.DONE, null, Map.of());
    UUID itemId = UUID.randomUUID();
    ReflectionTestUtils.setField(item, "id", itemId);
    when(userMediaRepository.findByIdAndUserId(itemId, userId)).thenReturn(Optional.of(item));
    when(userMediaRepository.save(any(UserMediaEntity.class)))
        .thenAnswer(invocation -> invocation.getArgument(0));
    Map<String, Object> note =
        Map.of(
            "type",
            "doc",
            "content",
            List.of(
                Map.of(
                    "type",
                    "paragraph",
                    "content",
                    List.of(Map.of("type", "text", "text", "Hi")))));
    UpdateCollectionItemRequestDto writeNote =
        new UpdateCollectionItemRequestDto(null, null, null, null, note, null, null, null);

    collectionService.updateItem(userId, itemId, writeNote);
    Instant firstReview = item.getReviewedAt();
    collectionService.updateItem(userId, itemId, writeNote);

    assertNotNull(firstReview);
    assertEquals(firstReview, item.getReviewedAt());

    collectionService.updateItem(
        userId,
        itemId,
        new UpdateCollectionItemRequestDto(null, null, null, null, null, true, null, null));

    assertNull(item.getReviewedAt());
  }

  private static MediaEntity knownMedia(String externalId, MediaType type) {
    return new MediaEntity(
        externalId, "tmdb", type, new CanonicalWorkEntity(type), "Show", null, Map.of(), false);
  }

  @Test
  void getStats_returnsCountsByTypeAndStatusWithAverageRating() {
    UUID userId = UUID.randomUUID();
    UserMediaRepository.MediaTypeStatusCount gamesDone =
        mock(UserMediaRepository.MediaTypeStatusCount.class);
    when(gamesDone.getMediaType()).thenReturn(MediaType.GAME);
    when(gamesDone.getStatus()).thenReturn(UserMediaStatus.DONE);
    when(gamesDone.getCount()).thenReturn(2L);
    UserMediaRepository.MediaTypeStatusCount gamesPlanned =
        mock(UserMediaRepository.MediaTypeStatusCount.class);
    when(gamesPlanned.getMediaType()).thenReturn(MediaType.GAME);
    when(gamesPlanned.getStatus()).thenReturn(UserMediaStatus.PLANNED);
    when(gamesPlanned.getCount()).thenReturn(1L);
    UserMediaRepository.MediaTypeStatusCount moviesDone =
        mock(UserMediaRepository.MediaTypeStatusCount.class);
    when(moviesDone.getMediaType()).thenReturn(MediaType.MOVIE);
    when(moviesDone.getStatus()).thenReturn(UserMediaStatus.DONE);
    when(moviesDone.getCount()).thenReturn(4L);
    when(userMediaRepository.countByUserIdGroupByMediaTypeAndStatus(userId))
        .thenReturn(List.of(gamesDone, gamesPlanned, moviesDone));
    when(userMediaRepository.findAverageRating(userId)).thenReturn(8.5);

    var stats = collectionService.getStatsByMediaType(userId);

    assertEquals(Map.of("game", 3L, "movie", 4L), stats.countsByMediaType());
    assertEquals(7L, stats.total());
    assertEquals(Map.of("done", 6L, "planned", 1L), stats.countsByStatus());
    assertEquals(
        Map.of("game", Map.of("done", 2L, "planned", 1L), "movie", Map.of("done", 4L)),
        stats.countsByMediaTypeAndStatus());
    assertEquals(8.5, stats.averageRating());
  }
}
