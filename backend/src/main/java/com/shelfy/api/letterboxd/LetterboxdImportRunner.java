package com.shelfy.api.letterboxd;

import com.shelfy.api.collection.MediaEntity;
import com.shelfy.api.collection.MediaResolver;
import com.shelfy.api.collection.MediaType;
import com.shelfy.api.collection.UserMediaEntity;
import com.shelfy.api.collection.UserMediaRepository;
import com.shelfy.api.collection.UserMediaStatus;
import com.shelfy.api.collection.WatchLogEntity;
import com.shelfy.api.collection.WatchLogRepository;
import com.shelfy.api.common.ImportEntryStatus;
import com.shelfy.api.common.ImportJobTracker;
import com.shelfy.api.common.exception.ErrorCode;
import com.shelfy.api.notifications.NotificationService;
import com.shelfy.api.notifications.NotificationType;
import com.shelfy.api.tmdb.TmdbService;
import com.shelfy.api.tmdb.dto.MovieSummaryResponseDto;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.format.DateTimeParseException;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;

@Component
public class LetterboxdImportRunner {

  private static final Logger LOG = LoggerFactory.getLogger(LetterboxdImportRunner.class);

  private static final int MAX_CSV_BYTES = 10 * 1024 * 1024;
  private static final int MAX_ARCHIVE_BYTES = 4 * MAX_CSV_BYTES;
  private static final Set<String> TARGET_FILES =
      Set.of("diary.csv", "reviews.csv", "ratings.csv", "watchlist.csv");

  private final ImportJobTracker<LetterboxdImportJobEntity> jobs;
  private final LetterboxdImportEntryRepository entryRepository;
  private final UserMediaRepository userMediaRepository;
  private final WatchLogRepository watchLogRepository;
  private final MediaResolver mediaResolver;
  private final TmdbService tmdbService;
  private final NotificationService notificationService;

  public LetterboxdImportRunner(
      LetterboxdImportJobRepository jobRepository,
      LetterboxdImportEntryRepository entryRepository,
      UserMediaRepository userMediaRepository,
      WatchLogRepository watchLogRepository,
      MediaResolver mediaResolver,
      TmdbService tmdbService,
      NotificationService notificationService) {
    this.jobs = new ImportJobTracker<>(jobRepository);
    this.entryRepository = entryRepository;
    this.userMediaRepository = userMediaRepository;
    this.watchLogRepository = watchLogRepository;
    this.mediaResolver = mediaResolver;
    this.tmdbService = tmdbService;
    this.notificationService = notificationService;
  }

  @Async("letterboxdImportExecutor")
  public void run(UUID jobId, UUID userId, byte[] zipBytes) {
    try {
      doRun(jobId, userId, zipBytes);
    } catch (IOException ex) {
      LOG.warn("Letterboxd import {} rejected an invalid archive", jobId, ex);
      jobs.fail(jobId, ErrorCode.LETTERBOXD_INVALID_FILE.name());
      notifyFailure(userId, ErrorCode.LETTERBOXD_INVALID_FILE.name());
    } catch (Exception ex) {
      LOG.error("Letterboxd import {} failed", jobId, ex);
      jobs.fail(jobId, ErrorCode.of(ex).name());
      notifyFailure(userId, ErrorCode.of(ex).name());
    }
  }

  private void doRun(UUID jobId, UUID userId, byte[] zipBytes) throws IOException {
    jobs.start(jobId);

    Map<String, byte[]> csvFiles = extractCsvFiles(zipBytes);
    Map<String, LetterboxdFilmImport> films = new HashMap<>();

    mergeDiary(films, csvFiles.get("diary.csv"));
    mergeReviews(films, csvFiles.get("reviews.csv"));
    mergeRatings(films, csvFiles.get("ratings.csv"));
    mergeWatchlist(films, csvFiles.get("watchlist.csv"));

    List<LetterboxdFilmImport> filmList = List.copyOf(films.values());
    jobs.total(jobId, filmList.size());

    int imported = 0;
    int skipped = 0;
    for (LetterboxdFilmImport film : filmList) {
      LetterboxdImportEntryEntity entry;
      try {
        entry = importOne(jobId, userId, film);
      } catch (Exception ex) {
        LOG.warn("Letterboxd import {} could not import {}", jobId, film.letterboxdUri, ex);
        entry =
            skippedEntry(
                jobId, userId, film, "processing_error", ErrorCode.of(ex).name(), null, null);
      }
      entryRepository.save(entry);
      if (entry.getStatus() == ImportEntryStatus.IMPORTED) {
        imported++;
      } else {
        skipped++;
      }
      jobs.progress(jobId, imported, skipped);
    }

    jobs.complete(jobId);
    notificationService.create(
        userId,
        null,
        NotificationType.IMPORT_FINISHED,
        null,
        null,
        Map.of("source", "LETTERBOXD", "imported", imported, "skipped", skipped));
  }

  LetterboxdImportEntryEntity importOne(UUID jobId, UUID userId, LetterboxdFilmImport film) {
    MovieSummaryResponseDto match = matchTmdb(film.title, film.year);
    if (match == null) {
      return skippedEntry(jobId, userId, film, "no_tmdb_match", null, null, null);
    }

    MediaEntity media =
        mediaResolver.findOrCreate(String.valueOf(match.id()), "tmdb", MediaType.MOVIE);

    upsertUserMedia(userId, media, film);

    return new LetterboxdImportEntryEntity(
        jobId,
        userId,
        film.title,
        film.year,
        film.letterboxdUri,
        ImportEntryStatus.IMPORTED,
        null,
        null,
        media.getId(),
        match.id());
  }

  private void upsertUserMedia(UUID userId, MediaEntity media, LetterboxdFilmImport film) {
    UserMediaEntity userMedia =
        userMediaRepository
            .findByUserIdAndMediaId(userId, media.getId())
            .orElseGet(
                () -> new UserMediaEntity(userId, media, UserMediaStatus.PLANNED, null, Map.of()));

    if (!film.watches.isEmpty()) {
      userMedia.setStatus(UserMediaStatus.DONE);

      LetterboxdWatchEntry latestRated =
          film.watches.stream()
              .filter(w -> w.rating() != null)
              .max(Comparator.comparing(LetterboxdWatchEntry::watchedAt))
              .orElse(null);
      if (latestRated != null) {
        userMedia.setRating(toShelfyRating(latestRated.rating()));
      }

      LetterboxdWatchEntry latestReview =
          film.watches.stream()
              .filter(w -> w.reviewText() != null && !w.reviewText().isBlank())
              .max(Comparator.comparing(LetterboxdWatchEntry::watchedAt))
              .orElse(null);
      if (latestReview != null) {
        userMedia.setNote(toRichTextDocument(latestReview.reviewText()));
        userMedia.setReviewedAt(latestReview.watchedAt().atStartOfDay(ZoneOffset.UTC).toInstant());
        userMedia.setContainsSpoilers(latestReview.containsSpoilers());
      }
    } else if (film.onWatchlist && userMedia.getId() == null) {
      userMedia.setStatus(UserMediaStatus.PLANNED);
    }

    UserMediaEntity saved = userMediaRepository.save(userMedia);

    Set<LocalDate> existingLogDates =
        watchLogRepository.findByUserMediaIdOrderByOccurredAtAsc(saved.getId()).stream()
            .map(WatchLogEntity::getOccurredAt)
            .collect(Collectors.toSet());

    for (LetterboxdWatchEntry watch : film.watches) {
      if (watch.watchedAt() != null && !existingLogDates.contains(watch.watchedAt())) {
        WatchLogEntity entry =
            new WatchLogEntity(saved, watch.watchedAt(), watch.isRewatch(), "letterboxd_import");
        if (watch.rating() != null) {
          entry.setRating(toShelfyRating(watch.rating()));
        }
        if (watch.reviewText() != null && !watch.reviewText().isBlank()) {
          entry.setReview(toRichTextDocument(watch.reviewText()));
          entry.setContainsSpoilers(watch.containsSpoilers());
        }
        watchLogRepository.save(entry);
        existingLogDates.add(watch.watchedAt());
      }
    }
  }

  private int toShelfyRating(double letterboxdRating) {
    long doubled = Math.round(letterboxdRating * 2);
    return (int) Math.max(0, Math.min(10, doubled));
  }

  private Map<String, Object> toRichTextDocument(String text) {
    return Map.of(
        "type",
        "doc",
        "content",
        List.of(
            Map.of("type", "paragraph", "content", List.of(Map.of("type", "text", "text", text)))));
  }

  private MovieSummaryResponseDto matchTmdb(String title, Integer year) {
    List<MovieSummaryResponseDto> results = tmdbService.searchMovies(title, 1, false).results();
    if (results.isEmpty()) {
      return null;
    }
    if (year == null) {
      return results.get(0);
    }
    return results.stream()
        .filter(m -> m.releaseDate() != null && Math.abs(m.releaseDate().getYear() - year) <= 1)
        .findFirst()
        .orElse(null);
  }

  private LetterboxdImportEntryEntity skippedEntry(
      UUID jobId,
      UUID userId,
      LetterboxdFilmImport film,
      String reason,
      String reasonDetail,
      UUID mediaId,
      Long tmdbId) {
    return new LetterboxdImportEntryEntity(
        jobId,
        userId,
        film.title,
        film.year,
        film.letterboxdUri,
        ImportEntryStatus.SKIPPED,
        reason,
        reasonDetail,
        mediaId,
        tmdbId);
  }

  private Map<String, byte[]> extractCsvFiles(byte[] zipBytes) throws IOException {
    Map<String, byte[]> files = new HashMap<>();
    int extractedBytes = 0;
    try (ZipInputStream zis = new ZipInputStream(new ByteArrayInputStream(zipBytes))) {
      ZipEntry entry;
      while ((entry = zis.getNextEntry()) != null) {
        byte[] content = zis.readNBytes(MAX_CSV_BYTES + 1);
        if (content.length > MAX_CSV_BYTES) {
          throw new IOException("Export archive contains an entry that is too large");
        }
        extractedBytes += content.length;
        if (extractedBytes > MAX_ARCHIVE_BYTES) {
          throw new IOException("Export archive is too large");
        }
        String name = entry.getName().toLowerCase(Locale.ROOT);
        for (String target : TARGET_FILES) {
          if (name.equals(target) || name.endsWith("/" + target)) {
            files.put(target, content);
          }
        }
      }
    }
    return files;
  }

  private void mergeDiary(Map<String, LetterboxdFilmImport> films, byte[] csv) throws IOException {
    if (csv == null) {
      return;
    }
    for (Map<String, String> row : LetterboxdCsvReader.read(csv)) {
      LetterboxdFilmImport film = filmFor(films, row);
      LocalDate watchedAt = parseDate(firstNonBlank(row.get("watched date"), row.get("date")));
      film.watches.add(
          new LetterboxdWatchEntry(
              watchedAt,
              parseBoolean(row.get("rewatch")),
              parseRating(row.get("rating")),
              null,
              false));
    }
  }

  private void mergeReviews(Map<String, LetterboxdFilmImport> films, byte[] csv)
      throws IOException {
    if (csv == null) {
      return;
    }
    for (Map<String, String> row : LetterboxdCsvReader.read(csv)) {
      LetterboxdFilmImport film = filmFor(films, row);
      LocalDate watchedAt = parseDate(firstNonBlank(row.get("watched date"), row.get("date")));
      String review = row.get("review");
      boolean spoiler = parseBoolean(spoilerValue(row));
      Double rating = parseRating(row.get("rating"));
      boolean rewatch = parseBoolean(row.get("rewatch"));

      int existingIndex = -1;
      for (int i = 0; i < film.watches.size(); i++) {
        LetterboxdWatchEntry existing = film.watches.get(i);
        if (Objects.equals(existing.watchedAt(), watchedAt)) {
          existingIndex = i;
          break;
        }
      }
      LetterboxdWatchEntry merged =
          new LetterboxdWatchEntry(watchedAt, rewatch, rating, review, spoiler);
      if (existingIndex >= 0) {
        film.watches.set(existingIndex, merged);
      } else {
        film.watches.add(merged);
      }
    }
  }

  private void mergeRatings(Map<String, LetterboxdFilmImport> films, byte[] csv)
      throws IOException {
    if (csv == null) {
      return;
    }
    for (Map<String, String> row : LetterboxdCsvReader.read(csv)) {
      LetterboxdFilmImport film = filmFor(films, row);
      if (!film.watches.isEmpty()) {
        continue;
      }
      LocalDate ratedAt = parseDate(row.get("date"));
      Double rating = parseRating(row.get("rating"));
      if (rating != null) {
        film.watches.add(new LetterboxdWatchEntry(ratedAt, false, rating, null, false));
      }
    }
  }

  private void mergeWatchlist(Map<String, LetterboxdFilmImport> films, byte[] csv)
      throws IOException {
    if (csv == null) {
      return;
    }
    for (Map<String, String> row : LetterboxdCsvReader.read(csv)) {
      LetterboxdFilmImport film = filmFor(films, row);
      film.onWatchlist = true;
    }
  }

  private LetterboxdFilmImport filmFor(
      Map<String, LetterboxdFilmImport> films, Map<String, String> row) {
    String uri = row.get("letterboxd uri");
    String name = row.get("name");
    Integer year = parseYear(row.get("year"));
    String key = uri != null && !uri.isBlank() ? uri : name + "|" + year;
    return films.computeIfAbsent(key, k -> new LetterboxdFilmImport(name, year, uri));
  }

  private String spoilerValue(Map<String, String> row) {
    return row.entrySet().stream()
        .filter(e -> e.getKey().contains("spoiler"))
        .map(Map.Entry::getValue)
        .findFirst()
        .orElse(null);
  }

  private String firstNonBlank(String a, String b) {
    return a != null && !a.isBlank() ? a : b;
  }

  private LocalDate parseDate(String value) {
    if (value == null || value.isBlank()) {
      return null;
    }
    try {
      return LocalDate.parse(value.trim());
    } catch (DateTimeParseException ex) {
      return null;
    }
  }

  private Integer parseYear(String value) {
    if (value == null || value.isBlank()) {
      return null;
    }
    try {
      return Integer.parseInt(value.trim());
    } catch (NumberFormatException ex) {
      return null;
    }
  }

  private Double parseRating(String value) {
    if (value == null || value.isBlank()) {
      return null;
    }
    try {
      return Double.parseDouble(value.trim());
    } catch (NumberFormatException ex) {
      return null;
    }
  }

  private boolean parseBoolean(String value) {
    if (value == null) {
      return false;
    }
    String normalized = value.trim().toLowerCase(Locale.ROOT);
    return normalized.equals("yes") || normalized.equals("true") || normalized.equals("x");
  }

  private void notifyFailure(UUID userId, String code) {
    notificationService.create(
        userId,
        null,
        NotificationType.IMPORT_FAILED,
        null,
        null,
        Map.of("source", "LETTERBOXD", "code", code));
  }
}
