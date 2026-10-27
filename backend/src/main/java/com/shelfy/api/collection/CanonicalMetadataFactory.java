package com.shelfy.api.collection;

import com.shelfy.api.anilist.dto.AnimeDetailResponseDto;
import com.shelfy.api.anilist.dto.MangaDetailResponseDto;
import com.shelfy.api.igdb.dto.GameDetailResponseDto;
import com.shelfy.api.igdb.dto.GameSummaryResponseDto;
import com.shelfy.api.tmdb.dto.MovieDetailResponseDto;
import com.shelfy.api.tmdb.dto.TvShowDetailResponseDto;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.Map;

final class CanonicalMetadataFactory {

  private static final String OVERVIEW = "overview";
  private static final String VOTE_AVERAGE = "voteAverage";
  private static final String RELEASE_DATE = "releaseDate";
  private static final String BACKDROP_URL = "backdropUrl";

  private CanonicalMetadataFactory() {}

  static Map<String, Object> forMovie(MovieDetailResponseDto movie, String backdropUrl) {
    Map<String, Object> metadata = new HashMap<>();
    put(metadata, OVERVIEW, movie.overview());
    put(metadata, VOTE_AVERAGE, movie.voteAverage());
    put(metadata, RELEASE_DATE, movie.releaseDate());
    put(metadata, BACKDROP_URL, backdropUrl);
    return metadata;
  }

  static Map<String, Object> forTvShow(TvShowDetailResponseDto show, String backdropUrl) {
    Map<String, Object> metadata = new HashMap<>();
    put(metadata, OVERVIEW, show.overview());
    put(metadata, VOTE_AVERAGE, show.voteAverage());
    put(metadata, RELEASE_DATE, show.firstAirDate());
    put(metadata, BACKDROP_URL, backdropUrl);
    LocalDate today = LocalDate.now();
    int airedEpisodes =
        show.seasons().stream()
            .filter(s -> s.seasonNumber() > 0 && s.airDate() != null && !s.airDate().isAfter(today))
            .mapToInt(s -> s.episodeCount())
            .sum();
    if (airedEpisodes > 0) {
      metadata.put(CollectionService.EPISODE_TOTAL, airedEpisodes);
    }
    return metadata;
  }

  static Map<String, Object> forGame(GameDetailResponseDto game, String backdropUrl) {
    Map<String, Object> metadata = new HashMap<>();
    put(metadata, OVERVIEW, game.summary());
    put(metadata, VOTE_AVERAGE, game.rating());
    put(metadata, RELEASE_DATE, game.releaseDate());
    put(metadata, BACKDROP_URL, backdropUrl);
    return metadata;
  }

  static Map<String, Object> forGame(GameSummaryResponseDto game, String backdropUrl) {
    Map<String, Object> metadata = new HashMap<>();
    put(metadata, OVERVIEW, game.summary());
    put(metadata, VOTE_AVERAGE, game.rating());
    put(metadata, RELEASE_DATE, game.releaseDate());
    put(metadata, BACKDROP_URL, backdropUrl);
    return metadata;
  }

  static Map<String, Object> forAnime(AnimeDetailResponseDto anime) {
    Map<String, Object> metadata = new HashMap<>();
    put(metadata, OVERVIEW, anime.summary());
    put(metadata, VOTE_AVERAGE, anime.rating());
    put(metadata, RELEASE_DATE, anime.releaseDate());
    put(metadata, BACKDROP_URL, anime.bannerImageUrl());
    if ("FINISHED".equals(anime.status()) && anime.episodes() != null) {
      metadata.put(CollectionService.EPISODE_TOTAL, anime.episodes());
    }
    return metadata;
  }

  static Map<String, Object> forManga(MangaDetailResponseDto manga) {
    Map<String, Object> metadata = new HashMap<>();
    put(metadata, OVERVIEW, manga.summary());
    put(metadata, VOTE_AVERAGE, manga.rating());
    put(metadata, RELEASE_DATE, manga.releaseDate());
    put(metadata, BACKDROP_URL, manga.bannerImageUrl());
    return metadata;
  }

  private static void put(Map<String, Object> metadata, String key, Object value) {
    if (value != null) {
      metadata.put(key, value);
    }
  }
}
