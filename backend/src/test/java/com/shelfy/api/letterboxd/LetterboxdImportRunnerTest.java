package com.shelfy.api.letterboxd;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.shelfy.api.collection.CanonicalWorkEntity;
import com.shelfy.api.collection.MediaEntity;
import com.shelfy.api.collection.MediaResolver;
import com.shelfy.api.collection.MediaType;
import com.shelfy.api.collection.UserMediaEntity;
import com.shelfy.api.collection.UserMediaRepository;
import com.shelfy.api.collection.UserMediaStatus;
import com.shelfy.api.collection.WatchLogEntity;
import com.shelfy.api.collection.WatchLogRepository;
import com.shelfy.api.common.ImportStatus;
import com.shelfy.api.common.exception.ErrorCode;
import com.shelfy.api.notifications.NotificationService;
import com.shelfy.api.tmdb.TmdbService;
import com.shelfy.api.tmdb.dto.MovieSummaryResponseDto;
import com.shelfy.api.tmdb.dto.TmdbSearchResponseDto;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class LetterboxdImportRunnerTest {

  private final LetterboxdImportJobRepository jobRepository =
      mock(LetterboxdImportJobRepository.class);
  private final LetterboxdImportEntryRepository entryRepository =
      mock(LetterboxdImportEntryRepository.class);
  private final UserMediaRepository userMediaRepository = mock(UserMediaRepository.class);
  private final WatchLogRepository watchLogRepository = mock(WatchLogRepository.class);
  private final MediaResolver mediaResolver = mock(MediaResolver.class);
  private final TmdbService tmdbService = mock(TmdbService.class);
  private final LetterboxdImportRunner runner =
      new LetterboxdImportRunner(
          jobRepository,
          entryRepository,
          userMediaRepository,
          watchLogRepository,
          mediaResolver,
          tmdbService,
          mock(NotificationService.class));

  private final UUID userId = UUID.randomUUID();
  private final UUID jobId = UUID.randomUUID();
  private final LetterboxdImportJobEntity job = new LetterboxdImportJobEntity(userId);
  private final List<LetterboxdImportEntryEntity> entries = new ArrayList<>();
  private final Map<String, UserMediaEntity> savedItems = new HashMap<>();
  private final List<WatchLogEntity> watchLogs = new ArrayList<>();

  @BeforeEach
  void setUp() {
    when(jobRepository.findById(jobId)).thenReturn(Optional.of(job));
    when(entryRepository.save(any()))
        .thenAnswer(
            invocation -> {
              entries.add(invocation.getArgument(0));
              return invocation.getArgument(0);
            });
    when(userMediaRepository.findByUserIdAndMediaId(eq(userId), any()))
        .thenReturn(Optional.empty());
    when(userMediaRepository.save(any(UserMediaEntity.class)))
        .thenAnswer(
            invocation -> {
              UserMediaEntity item = invocation.getArgument(0);
              savedItems.put(item.getMedia().getTitle(), item);
              return item;
            });
    when(watchLogRepository.save(any(WatchLogEntity.class)))
        .thenAnswer(
            invocation -> {
              watchLogs.add(invocation.getArgument(0));
              return invocation.getArgument(0);
            });
    when(tmdbService.searchMovies(anyString(), eq(1), eq(false)))
        .thenReturn(new TmdbSearchResponseDto<>(List.of(), 1, 1, 0));
    when(mediaResolver.findOrCreate(anyString(), eq("tmdb"), eq(MediaType.MOVIE)))
        .thenAnswer(invocation -> media(invocation.getArgument(0)));
  }

  @Test
  void run_mergesDiaryReviewsRatingsAndWatchlist() throws Exception {
    match("Alien", 1979, 348);
    match("Heat", 1995, 949);
    match("Dune", 2021, 438631);

    runner.run(
        jobId,
        userId,
        zip(
            Map.of(
                "diary.csv",
                """
                Date,Name,Year,Letterboxd URI,Rating,Rewatch,Watched Date
                2024-01-02,Alien,1979,https://boxd.it/alien,4,,2024-01-01
                2024-02-02,Alien,1979,https://boxd.it/alien,4.5,Yes,2024-02-01
                """,
                "reviews.csv",
                """
                Date,Name,Year,Letterboxd URI,Rating,Rewatch,Review,Tags,Watched Date,Spoilers
                2024-02-02,Alien,1979,https://boxd.it/alien,4.5,Yes,In space...,,2024-02-01,Yes
                """,
                "ratings.csv",
                """
                Date,Name,Year,Letterboxd URI,Rating
                2023-05-05,Heat,1995,https://boxd.it/heat,5
                """,
                "watchlist.csv",
                """
                Date,Name,Year,Letterboxd URI
                2024-03-03,Dune,2021,https://boxd.it/dune
                """)));

    assertEquals(ImportStatus.COMPLETED, job.getStatus());
    assertEquals(3, job.getEntriesImported());
    UserMediaEntity alien = savedItems.get("348");
    assertEquals(UserMediaStatus.DONE, alien.getStatus());
    assertEquals(9, alien.getRating());
    assertNotNull(alien.getNote());
    assertEquals(true, alien.isContainsSpoilers());
    assertEquals(10, savedItems.get("949").getRating());
    assertEquals(UserMediaStatus.PLANNED, savedItems.get("438631").getStatus());
    assertEquals(
        List.of(LocalDate.of(2023, 5, 5), LocalDate.of(2024, 1, 1), LocalDate.of(2024, 2, 1)),
        watchLogs.stream().map(WatchLogEntity::getOccurredAt).sorted().toList());
  }

  @Test
  void run_skipsFilmsWithoutAMatchAndIsolatesFailures() throws Exception {
    match("Heat", 1995, 949);
    when(tmdbService.searchMovies(eq("Broken"), eq(1), eq(false)))
        .thenThrow(new IllegalStateException("database exploded: secret table name"));

    runner.run(
        jobId,
        userId,
        zip(
            Map.of(
                "watchlist.csv",
                """
                Date,Name,Year,Letterboxd URI
                2024-03-03,Unknown Film,1901,https://boxd.it/unknown
                2024-03-03,Broken,2001,https://boxd.it/broken
                2024-03-03,Heat,1995,https://boxd.it/heat
                """)));

    assertEquals(ImportStatus.COMPLETED, job.getStatus());
    assertEquals(1, job.getEntriesImported());
    assertEquals(2, job.getEntriesSkipped());
    LetterboxdImportEntryEntity broken =
        entries.stream().filter(e -> "Broken".equals(e.getLetterboxdTitle())).findFirst().get();
    assertEquals("processing_error", broken.getReason());
    assertEquals(ErrorCode.INTERNAL_SERVER_ERROR.name(), broken.getReasonDetail());
    LetterboxdImportEntryEntity unknown =
        entries.stream()
            .filter(e -> "Unknown Film".equals(e.getLetterboxdTitle()))
            .findFirst()
            .get();
    assertEquals("no_tmdb_match", unknown.getReason());
  }

  @Test
  void run_rejectsAnArchiveWithAnOversizedEntry() throws Exception {
    runner.run(jobId, userId, zip(Map.of("diary.csv", "x".repeat(10 * 1024 * 1024 + 1))));

    assertEquals(ImportStatus.FAILED, job.getStatus());
    assertEquals(ErrorCode.LETTERBOXD_INVALID_FILE.name(), job.getErrorMessage());
  }

  private void match(String title, int year, long tmdbId) {
    when(tmdbService.searchMovies(eq(title), eq(1), eq(false)))
        .thenReturn(
            new TmdbSearchResponseDto<>(
                List.of(
                    new MovieSummaryResponseDto(
                        tmdbId,
                        title,
                        title,
                        null,
                        null,
                        null,
                        LocalDate.of(year, 6, 1),
                        List.of(),
                        7.5,
                        100,
                        false)),
                1,
                1,
                1));
  }

  private static MediaEntity media(String tmdbId) {
    MediaEntity media =
        new MediaEntity(
            tmdbId,
            "tmdb",
            MediaType.MOVIE,
            new CanonicalWorkEntity(MediaType.MOVIE),
            tmdbId,
            null,
            Map.of(),
            false);
    media.setId(UUID.randomUUID());
    return media;
  }

  private static byte[] zip(Map<String, String> files) throws Exception {
    ByteArrayOutputStream bytes = new ByteArrayOutputStream();
    try (ZipOutputStream zip = new ZipOutputStream(bytes)) {
      for (Map.Entry<String, String> file : files.entrySet()) {
        zip.putNextEntry(new ZipEntry("letterboxd-export/" + file.getKey()));
        zip.write(file.getValue().getBytes(StandardCharsets.UTF_8));
        zip.closeEntry();
      }
    }
    return bytes.toByteArray();
  }
}
