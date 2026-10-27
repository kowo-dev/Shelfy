package com.shelfy.api.collection;

import com.shelfy.api.anilist.AniListService;
import com.shelfy.api.anilist.dto.AnimeDetailResponseDto;
import com.shelfy.api.anilist.dto.MangaDetailResponseDto;
import com.shelfy.api.igdb.IgdbProperties;
import com.shelfy.api.igdb.IgdbService;
import com.shelfy.api.igdb.dto.GameDetailResponseDto;
import com.shelfy.api.igdb.dto.GameSummaryResponseDto;
import com.shelfy.api.tmdb.TmdbProperties;
import com.shelfy.api.tmdb.TmdbService;
import com.shelfy.api.tmdb.dto.MovieDetailResponseDto;
import com.shelfy.api.tmdb.dto.TvShowDetailResponseDto;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class MediaCatalogService {

  private static final String TMDB_PROVIDER = "tmdb";
  private static final String IGDB_PROVIDER = "igdb";
  private static final String ANILIST_PROVIDER = "anilist";

  private final TmdbService tmdbService;
  private final TmdbProperties tmdbProperties;
  private final IgdbService igdbService;
  private final IgdbProperties igdbProperties;
  private final AniListService aniListService;

  public Map<String, Object> buildGameMetadata(GameSummaryResponseDto game) {
    return CanonicalMetadataFactory.forGame(
        game, gameBackdropUrl(game.artworkImageIds(), game.screenshotImageIds()));
  }

  public CanonicalMedia resolve(String provider, MediaType mediaType, String externalId) {
    return switch (provider) {
      case TMDB_PROVIDER -> resolveTmdb(mediaType, parseNumericId(externalId));
      case IGDB_PROVIDER -> resolveIgdb(mediaType, parseNumericId(externalId));
      case ANILIST_PROVIDER -> resolveAniList(mediaType, parseNumericId(externalId));
      default -> throw new InvalidMediaReferenceException();
    };
  }

  private CanonicalMedia resolveTmdb(MediaType mediaType, long id) {
    return switch (mediaType) {
      case MOVIE -> fromMovie(tmdbService.getMovie(id));
      case TV_SHOW -> fromTvShow(tmdbService.getTvShow(id));
      default -> throw new InvalidMediaReferenceException();
    };
  }

  private CanonicalMedia resolveIgdb(MediaType mediaType, long id) {
    if (mediaType != MediaType.GAME) {
      throw new InvalidMediaReferenceException();
    }
    GameDetailResponseDto game = igdbService.getGame(id);
    return new CanonicalMedia(
        game.name(),
        igdbImageUrl(game.coverImageId()),
        CanonicalMetadataFactory.forGame(
            game, gameBackdropUrl(game.artworkImageIds(), game.screenshotImageIds())),
        game.isAdult(),
        game.steamAppIds().stream()
            .map(steamAppId -> new ExternalMediaReference("steam", steamAppId))
            .collect(Collectors.toUnmodifiableSet()));
  }

  private CanonicalMedia resolveAniList(MediaType mediaType, long id) {
    return switch (mediaType) {
      case ANIME -> fromAnime(aniListService.getAnime(id));
      case MANGA, WEBTOON -> fromManga(aniListService.getManga(id));
      default -> throw new InvalidMediaReferenceException();
    };
  }

  private CanonicalMedia fromMovie(MovieDetailResponseDto movie) {
    Map<String, Object> metadata =
        CanonicalMetadataFactory.forMovie(movie, tmdbImageUrl(movie.backdropPath()));
    return new CanonicalMedia(
        movie.title(), tmdbImageUrl(movie.posterPath()), metadata, movie.isAdult(), Set.of());
  }

  private CanonicalMedia fromTvShow(TvShowDetailResponseDto show) {
    Map<String, Object> metadata =
        CanonicalMetadataFactory.forTvShow(show, tmdbImageUrl(show.backdropPath()));
    return new CanonicalMedia(
        show.name(), tmdbImageUrl(show.posterPath()), metadata, show.isAdult(), Set.of());
  }

  private CanonicalMedia fromAnime(AnimeDetailResponseDto anime) {
    return new CanonicalMedia(
        anime.title(),
        anime.coverImageUrl(),
        CanonicalMetadataFactory.forAnime(anime),
        false,
        Set.of());
  }

  private CanonicalMedia fromManga(MangaDetailResponseDto manga) {
    return new CanonicalMedia(
        manga.title(),
        manga.coverImageUrl(),
        CanonicalMetadataFactory.forManga(manga),
        false,
        Set.of());
  }

  private long parseNumericId(String externalId) {
    try {
      return Long.parseLong(externalId);
    } catch (NumberFormatException ex) {
      throw new InvalidMediaReferenceException();
    }
  }

  private String tmdbImageUrl(String path) {
    return path == null ? null : tmdbProperties.imageBaseUrl() + "w500" + path;
  }

  private String gameBackdropUrl(List<String> artworkIds, List<String> screenshotIds) {
    List<String> pool = artworkIds == null || artworkIds.isEmpty() ? screenshotIds : artworkIds;
    return pool == null || pool.isEmpty() ? null : igdbImageUrl(pool.getFirst());
  }

  private String igdbImageUrl(String imageId) {
    return imageId == null ? null : igdbProperties.imageBaseUrl() + imageId + ".jpg";
  }
}
