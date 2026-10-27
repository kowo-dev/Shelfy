package com.shelfy.api.search;

import com.shelfy.api.anilist.dto.AnimeSummaryResponseDto;
import com.shelfy.api.anilist.dto.MangaSummaryResponseDto;
import com.shelfy.api.collection.MediaType;
import com.shelfy.api.igdb.dto.GameSummaryResponseDto;
import com.shelfy.api.search.dto.SearchResultResponseDto;
import com.shelfy.api.tmdb.TmdbService;
import com.shelfy.api.tmdb.dto.MovieSummaryResponseDto;
import com.shelfy.api.tmdb.dto.TmdbGenreDto;
import com.shelfy.api.tmdb.dto.TvShowSummaryResponseDto;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class SearchResultMapper {

  static final String TMDB_PROVIDER = "tmdb";
  static final String IGDB_PROVIDER = "igdb";
  static final String ANILIST_PROVIDER = "anilist";

  private final TmdbService tmdbService;

  public SearchResultResponseDto toResult(MovieSummaryResponseDto movie) {
    String externalId = String.valueOf(movie.id());
    return new SearchResultResponseDto(
        TMDB_PROVIDER,
        MediaType.MOVIE,
        externalId,
        movie.title(),
        movie.posterPath(),
        movie.overview(),
        year(movie.releaseDate()),
        movieGenreNames(movie.genreIds()),
        movie.voteAverage(),
        movie.voteCount(),
        null,
        false,
        movie.backdropPath());
  }

  public SearchResultResponseDto toResult(TvShowSummaryResponseDto tvShow) {
    String externalId = String.valueOf(tvShow.id());
    return new SearchResultResponseDto(
        TMDB_PROVIDER,
        MediaType.TV_SHOW,
        externalId,
        tvShow.name(),
        tvShow.posterPath(),
        tvShow.overview(),
        year(tvShow.firstAirDate()),
        tvGenreNames(tvShow.genreIds()),
        tvShow.voteAverage(),
        tvShow.voteCount(),
        null,
        false,
        tvShow.backdropPath());
  }

  public SearchResultResponseDto toResult(GameSummaryResponseDto game) {
    String externalId = String.valueOf(game.id());
    return new SearchResultResponseDto(
        IGDB_PROVIDER,
        MediaType.GAME,
        externalId,
        game.name(),
        game.coverImageId(),
        game.summary(),
        year(game.releaseDate()),
        game.genres(),
        game.rating(),
        game.ratingCount(),
        null,
        false,
        game.screenshotImageIds() == null || game.screenshotImageIds().isEmpty()
            ? null
            : game.screenshotImageIds().getFirst());
  }

  public SearchResultResponseDto toResult(AnimeSummaryResponseDto anime) {
    String externalId = String.valueOf(anime.id());
    return new SearchResultResponseDto(
        ANILIST_PROVIDER,
        MediaType.ANIME,
        externalId,
        anime.title(),
        anime.coverImageUrl(),
        anime.summary(),
        year(anime.releaseDate()),
        anime.genres(),
        anime.rating(),
        anime.popularity(),
        anime.status(),
        false);
  }

  public SearchResultResponseDto toResult(MangaSummaryResponseDto manga, MediaType mediaType) {
    String externalId = String.valueOf(manga.id());
    return new SearchResultResponseDto(
        ANILIST_PROVIDER,
        mediaType,
        externalId,
        manga.title(),
        manga.coverImageUrl(),
        manga.summary(),
        year(manga.releaseDate()),
        manga.genres(),
        manga.rating(),
        manga.popularity(),
        manga.status(),
        false);
  }

  private static Integer year(LocalDate date) {
    return date == null ? null : date.getYear();
  }

  private List<String> movieGenreNames(List<Integer> genreIds) {
    return genreNames(tmdbService.getMovieGenres(), genreIds);
  }

  private List<String> tvGenreNames(List<Integer> genreIds) {
    return genreNames(tmdbService.getTvGenres(), genreIds);
  }

  private List<String> genreNames(List<TmdbGenreDto> genres, List<Integer> genreIds) {
    if (genreIds == null || genreIds.isEmpty()) {
      return List.of();
    }
    Map<Integer, String> byId =
        genres.stream().collect(Collectors.toMap(TmdbGenreDto::id, TmdbGenreDto::name));
    return genreIds.stream().map(byId::get).filter(Objects::nonNull).toList();
  }
}
