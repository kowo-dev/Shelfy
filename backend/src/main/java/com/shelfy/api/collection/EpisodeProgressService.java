package com.shelfy.api.collection;

import com.shelfy.api.activity.ActivityType;
import com.shelfy.api.activity.UserActivityService;
import com.shelfy.api.anilist.AniListService;
import com.shelfy.api.anilist.dto.AnimeDetailResponseDto;
import com.shelfy.api.collection.dto.EpisodeProgressResponseDto;
import com.shelfy.api.collection.dto.EpisodeProgressResponseDto.SeasonProgressDto;
import com.shelfy.api.collection.dto.MarkAllEpisodesRequestDto;
import com.shelfy.api.collection.dto.RateEpisodeRequestDto;
import com.shelfy.api.collection.dto.UpdateEpisodeProgressRequestDto;
import com.shelfy.api.common.exception.ApiException;
import com.shelfy.api.common.exception.ErrorCode;
import com.shelfy.api.common.exception.ResourceNotFoundException;
import com.shelfy.api.tmdb.TmdbService;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.TreeMap;
import java.util.TreeSet;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

@Service
@RequiredArgsConstructor
public class EpisodeProgressService {

  private static final Logger LOG = LoggerFactory.getLogger(EpisodeProgressService.class);

  private final MediaRepository mediaRepository;
  private final UserMediaRepository userMediaRepository;
  private final UserMediaEpisodeRepository episodeRepository;
  private final TmdbService tmdbService;
  private final AniListService aniListService;
  private final UserActivityService userActivityService;
  private final TransactionTemplate transactionTemplate;

  record Season(int number, int episodeCount, boolean hasAired, int airedCount) {
    Season(int number, int episodeCount, boolean aired) {
      this(number, episodeCount, aired, aired ? episodeCount : 0);
    }
  }

  public EpisodeProgressResponseDto get(UUID userId, UUID itemId) {
    List<Season> catalog = catalog(getTrackableItem(userId, itemId).getMedia());
    return transactionTemplate.execute(
        status -> {
          UserMediaEntity item = getTrackableItem(userId, itemId);
          syncTotal(item.getMedia(), catalog);
          return toResponse(item, catalog);
        });
  }

  public EpisodeProgressResponseDto update(
      UUID userId, UUID itemId, UpdateEpisodeProgressRequestDto request) {
    List<Season> catalog = catalog(getTrackableItem(userId, itemId).getMedia());
    validate(catalog, request.season(), request.episodes());
    return transactionTemplate.execute(status -> applyUpdate(userId, itemId, request, catalog));
  }

  public EpisodeProgressResponseDto rate(UUID userId, UUID itemId, RateEpisodeRequestDto request) {
    MediaEntity media = getTrackableItem(userId, itemId).getMedia();
    List<Season> catalog = catalog(media);
    validate(catalog, request.season(), List.of(request.episode()));
    if (request.rating() != null
        && !hasAired(media, catalog, request.season(), request.episode())) {
      throw new ApiException(
          HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_FAILED, "Episode has not aired yet");
    }
    return transactionTemplate.execute(
        status -> {
          UserMediaEntity item = getTrackableItem(userId, itemId);
          syncTotal(item.getMedia(), catalog);
          Optional<UserMediaEpisodeEntity> existing =
              episodeRepository.findByUserMediaIdAndSeasonAndEpisode(
                  item.getId(), request.season(), request.episode());
          if (existing.isEmpty() && request.rating() == null) {
            return toResponse(item, catalog);
          }
          UserMediaEpisodeEntity episode =
              existing.orElseGet(
                  () -> new UserMediaEpisodeEntity(item, request.season(), request.episode()));
          episode.setRating(request.rating());
          episodeRepository.save(episode);
          if (existing.isEmpty()) {
            syncStatus(item, catalog, watchedBySeason(item.getId()), true);
          }
          return toResponse(item, catalog);
        });
  }

  public EpisodeProgressResponseDto markAll(
      UUID userId, UUID itemId, MarkAllEpisodesRequestDto request) {
    List<Season> catalog = catalog(getTrackableItem(userId, itemId).getMedia());
    return transactionTemplate.execute(
        status -> {
          UserMediaEntity item = getTrackableItem(userId, itemId);
          syncTotal(item.getMedia(), catalog);
          if (request.isWatched()) {
            fillReleased(item, catalog);
          } else {
            episodeRepository.deleteAll(episodeRepository.findByUserMediaId(item.getId()));
          }
          syncStatus(item, catalog, watchedBySeason(item.getId()), request.isWatched());
          return toResponse(item, catalog);
        });
  }

  public void fillOnCompletion(UserMediaEntity item) {
    if (!isTrackable(item.getMedia())) {
      return;
    }
    try {
      fillReleased(item, catalog(item.getMedia()));
    } catch (RuntimeException ex) {
      LOG.warn("Could not mark episodes of item {} watched: {}", item.getId(), ex.getMessage());
    }
  }

  private void fillReleased(UserMediaEntity item, List<Season> catalog) {
    Map<Integer, Set<Integer>> watched = watchedBySeason(item.getId());
    for (Season season : catalog) {
      if (season.number() == 0) {
        continue;
      }
      Set<Integer> seen = watched.getOrDefault(season.number(), Set.of());
      for (int episode = 1; episode <= season.airedCount(); episode++) {
        if (!seen.contains(episode)) {
          episodeRepository.save(new UserMediaEpisodeEntity(item, season.number(), episode));
        }
      }
    }
  }

  private EpisodeProgressResponseDto applyUpdate(
      UUID userId, UUID itemId, UpdateEpisodeProgressRequestDto request, List<Season> catalog) {
    UserMediaEntity item = getTrackableItem(userId, itemId);
    syncTotal(item.getMedia(), catalog);
    List<UserMediaEpisodeEntity> stored = episodeRepository.findByUserMediaId(item.getId());
    Map<Integer, Set<Integer>> watched = watchedBySeason(stored);
    Set<Integer> seasonWatched = watched.computeIfAbsent(request.season(), s -> new TreeSet<>());
    if (request.isWatched()) {
      for (int episode : new TreeSet<>(request.episodes())) {
        if (seasonWatched.add(episode)) {
          episodeRepository.save(new UserMediaEpisodeEntity(item, request.season(), episode));
        }
      }
    } else {
      episodeRepository.deleteAll(
          stored.stream()
              .filter(e -> e.getSeason() == request.season())
              .filter(e -> request.episodes().contains(e.getEpisode()))
              .toList());
      request.episodes().forEach(seasonWatched::remove);
    }

    syncStatus(item, catalog, watched, request.isWatched());
    return toResponse(item, catalog);
  }

  private List<Season> catalog(MediaEntity media) {
    if (media.getMediaType() == MediaType.TV_SHOW) {
      LocalDate today = LocalDate.now();
      return tmdbService.getTvShow(Long.parseLong(media.getExternalId())).seasons().stream()
          .map(
              s ->
                  new Season(
                      s.seasonNumber(),
                      s.episodeCount(),
                      s.seasonNumber() > 0 && s.airDate() != null && !s.airDate().isAfter(today)))
          .toList();
    }
    AnimeDetailResponseDto anime = aniListService.getAnime(Long.parseLong(media.getExternalId()));
    boolean finished = "FINISHED".equals(anime.status());
    int aired =
        finished && anime.episodes() != null
            ? anime.episodes()
            : anime.airedEpisodes() != null ? anime.airedEpisodes() : 0;
    Integer total = anime.episodes() != null ? anime.episodes() : aired > 0 ? aired : null;
    if (total == null) {
      return List.of();
    }
    return List.of(new Season(1, total, finished, Math.min(aired, total)));
  }

  public void fillMissingTotal(UUID mediaId) {
    mediaRepository
        .findById(mediaId)
        .filter(
            media -> !(media.getMetadata().get(CollectionService.EPISODE_TOTAL) instanceof Number))
        .ifPresent(media -> syncTotal(media, catalog(media)));
  }

  private void syncTotal(MediaEntity media, List<Season> catalog) {
    int total =
        catalog.stream()
            .filter(s -> s.number() > 0 && s.hasAired())
            .mapToInt(Season::episodeCount)
            .sum();
    Object stored = media.getMetadata().get(CollectionService.EPISODE_TOTAL);
    if (total > 0 && !(stored instanceof Number n && n.intValue() == total)) {
      Map<String, Object> metadata = new HashMap<>(media.getMetadata());
      metadata.put(CollectionService.EPISODE_TOTAL, total);
      media.setMetadata(metadata);
      mediaRepository.save(media);
    }
  }

  private boolean hasAired(MediaEntity media, List<Season> catalog, int season, int episode) {
    Season known = catalog.stream().filter(s -> s.number() == season).findFirst().orElse(null);
    if (known == null) {
      return catalog.isEmpty();
    }
    if (media.getMediaType() == MediaType.ANIME) {
      return known.hasAired() || episode <= known.airedCount();
    }
    if (!known.hasAired()) {
      return false;
    }
    LocalDate today = LocalDate.now();
    return tmdbService
        .getTvSeason(Long.parseLong(media.getExternalId()), season)
        .episodes()
        .stream()
        .filter(e -> e.episodeNumber() == episode)
        .findFirst()
        .map(e -> e.airDate() != null && !e.airDate().isAfter(today))
        .orElse(false);
  }

  private void validate(List<Season> catalog, int season, List<Integer> episodes) {
    if (catalog.isEmpty()) {
      return;
    }
    int max =
        catalog.stream()
            .filter(s -> s.number() == season)
            .mapToInt(Season::episodeCount)
            .findFirst()
            .orElse(0);
    if (episodes.stream().anyMatch(e -> e > max)) {
      throw new ApiException(
          HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_FAILED, "Episode out of range");
    }
  }

  private void syncStatus(
      UserMediaEntity item,
      List<Season> catalog,
      Map<Integer, Set<Integer>> watched,
      boolean added) {
    UserMediaStatus previous = item.getStatus();
    if (isCompleted(catalog, watched)) {
      item.setStatus(UserMediaStatus.DONE);
    } else if (added && previous != UserMediaStatus.DONE) {
      item.setStatus(UserMediaStatus.ONGOING);
    } else if (!added && previous == UserMediaStatus.DONE) {
      item.setStatus(UserMediaStatus.ONGOING);
    }
    if (item.getStatus() != previous) {
      userMediaRepository.save(item);
      userActivityService.record(
          item, ActivityType.STATUS_CHANGED, Map.of("status", item.getStatus().getValue()));
    }
  }

  static boolean isCompleted(List<Season> catalog, Map<Integer, Set<Integer>> watched) {
    List<Season> regular = catalog.stream().filter(s -> s.number() > 0).toList();
    List<Season> aired =
        regular.stream().filter(s -> s.hasAired() && s.episodeCount() > 0).toList();
    return !aired.isEmpty()
        && regular.stream().allMatch(Season::hasAired)
        && aired.stream()
            .allMatch(
                s ->
                    watched.getOrDefault(s.number(), Set.of()).stream()
                            .filter(e -> e <= s.episodeCount())
                            .count()
                        >= s.episodeCount());
  }

  private EpisodeProgressResponseDto toResponse(UserMediaEntity item, List<Season> catalog) {
    List<UserMediaEpisodeEntity> stored = episodeRepository.findByUserMediaId(item.getId());
    Map<Integer, Set<Integer>> watched = watchedBySeason(stored);
    Map<Integer, Map<Integer, Integer>> ratings = new TreeMap<>();
    for (UserMediaEpisodeEntity e : stored) {
      if (e.getRating() != null) {
        ratings
            .computeIfAbsent(e.getSeason(), s -> new TreeMap<>())
            .put(e.getEpisode(), e.getRating());
      }
    }
    Map<Integer, Integer> totals =
        catalog.stream().collect(Collectors.toMap(Season::number, Season::episodeCount));
    Map<Integer, SeasonProgressDto> seasons = new TreeMap<>();
    totals.forEach(
        (number, total) ->
            seasons.put(
                number,
                new SeasonProgressDto(
                    number,
                    total,
                    List.copyOf(watched.getOrDefault(number, Set.of())),
                    ratings.getOrDefault(number, Map.of()))));
    watched.forEach(
        (number, episodes) -> {
          if (!episodes.isEmpty()) {
            seasons.computeIfAbsent(
                number,
                n ->
                    new SeasonProgressDto(
                        n, null, List.copyOf(episodes), ratings.getOrDefault(n, Map.of())));
          }
        });
    return new EpisodeProgressResponseDto(
        List.copyOf(seasons.values()), isCompleted(catalog, watched), item.getStatus());
  }

  private Map<Integer, Set<Integer>> watchedBySeason(UUID itemId) {
    return watchedBySeason(episodeRepository.findByUserMediaId(itemId));
  }

  private static Map<Integer, Set<Integer>> watchedBySeason(List<UserMediaEpisodeEntity> episodes) {
    Map<Integer, Set<Integer>> result = new TreeMap<>();
    for (UserMediaEpisodeEntity e : episodes) {
      result.computeIfAbsent(e.getSeason(), s -> new TreeSet<>()).add(e.getEpisode());
    }
    return result;
  }

  private UserMediaEntity getTrackableItem(UUID userId, UUID itemId) {
    UserMediaEntity item =
        userMediaRepository
            .findWithMediaByIdAndUserId(itemId, userId)
            .orElseThrow(
                () ->
                    new ResourceNotFoundException(
                        ErrorCode.COLLECTION_ITEM_NOT_FOUND, "Collection item not found"));
    MediaEntity media = item.getMedia();
    if (!isTrackable(media)) {
      throw new ApiException(
          HttpStatus.BAD_REQUEST,
          ErrorCode.STATUS_NOT_APPLICABLE_TO_MEDIA_TYPE,
          "Episode tracking does not apply to " + media.getMediaType());
    }
    return item;
  }

  static boolean isTrackable(MediaEntity media) {
    return (media.getMediaType() == MediaType.TV_SHOW && "tmdb".equals(media.getProvider()))
        || (media.getMediaType() == MediaType.ANIME && "anilist".equals(media.getProvider()));
  }
}
