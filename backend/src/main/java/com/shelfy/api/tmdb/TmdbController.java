package com.shelfy.api.tmdb;

import com.shelfy.api.auth.ViewerPreferences;
import com.shelfy.api.common.exception.ErrorCode;
import com.shelfy.api.common.exception.ResourceNotFoundException;
import com.shelfy.api.tmdb.dto.CompanyDetailResponseDto;
import com.shelfy.api.tmdb.dto.MovieDetailResponseDto;
import com.shelfy.api.tmdb.dto.MovieSummaryResponseDto;
import com.shelfy.api.tmdb.dto.PersonDetailResponseDto;
import com.shelfy.api.tmdb.dto.SeasonDetailResponseDto;
import com.shelfy.api.tmdb.dto.TmdbGenreDto;
import com.shelfy.api.tmdb.dto.TmdbSearchResponseDto;
import com.shelfy.api.tmdb.dto.TvShowDetailResponseDto;
import com.shelfy.api.tmdb.dto.TvShowSummaryResponseDto;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/tmdb")
@RequiredArgsConstructor
public class TmdbController {

  private final TmdbService tmdbService;
  private final ViewerPreferences viewerPreferences;

  @GetMapping("/movies/{id}")
  public MovieDetailResponseDto getMovie(
      @AuthenticationPrincipal UUID userId, @PathVariable long id) {
    MovieDetailResponseDto movie = tmdbService.getMovie(id);
    requireAdultAllowed(userId, movie.isAdult());
    return movie;
  }

  @GetMapping("/tv/{id}")
  public TvShowDetailResponseDto getTvShow(
      @AuthenticationPrincipal UUID userId, @PathVariable long id) {
    TvShowDetailResponseDto tvShow = tmdbService.getTvShow(id);
    requireAdultAllowed(userId, tvShow.isAdult());
    return tvShow;
  }

  @GetMapping("/tv/{id}/seasons/{seasonNumber}")
  public SeasonDetailResponseDto getTvSeason(
      @AuthenticationPrincipal UUID userId, @PathVariable long id, @PathVariable int seasonNumber) {
    requireAdultAllowed(userId, tmdbService.getTvShow(id).isAdult());
    return tmdbService.getTvSeason(id, seasonNumber);
  }

  @GetMapping("/people/{id}")
  public PersonDetailResponseDto getPerson(
      @AuthenticationPrincipal UUID userId, @PathVariable long id) {
    return tmdbService.getPerson(id, allowsAdultContent(userId));
  }

  @GetMapping("/companies/{id}")
  public CompanyDetailResponseDto getCompany(@PathVariable long id) {
    return tmdbService.getCompany(id);
  }

  @GetMapping("/companies/{id}/movies")
  public TmdbSearchResponseDto<MovieSummaryResponseDto> getCompanyMovies(
      @PathVariable long id, @RequestParam(defaultValue = "1") int page) {
    return tmdbService.getMoviesByCompany(id, page);
  }

  @GetMapping("/companies/{id}/tv")
  public TmdbSearchResponseDto<TvShowSummaryResponseDto> getCompanyTvShows(
      @PathVariable long id, @RequestParam(defaultValue = "1") int page) {
    return tmdbService.getTvShowsByCompany(id, page);
  }

  @GetMapping("/networks/{id}")
  public CompanyDetailResponseDto getNetwork(@PathVariable long id) {
    return tmdbService.getNetwork(id);
  }

  @GetMapping("/networks/{id}/tv")
  public TmdbSearchResponseDto<TvShowSummaryResponseDto> getNetworkTvShows(
      @PathVariable long id, @RequestParam(defaultValue = "1") int page) {
    return tmdbService.getTvShowsByNetwork(id, page);
  }

  @GetMapping("/movies/by-genre/{genreId}")
  public TmdbSearchResponseDto<MovieSummaryResponseDto> getMoviesByGenre(
      @PathVariable long genreId, @RequestParam(defaultValue = "1") int page) {
    return tmdbService.getMoviesByGenre(genreId, page);
  }

  @GetMapping("/tv/by-genre/{genreId}")
  public TmdbSearchResponseDto<TvShowSummaryResponseDto> getTvShowsByGenre(
      @PathVariable long genreId, @RequestParam(defaultValue = "1") int page) {
    return tmdbService.getTvShowsByGenre(genreId, page);
  }

  @GetMapping("/genres/movie")
  public List<TmdbGenreDto> getMovieGenres() {
    return tmdbService.getMovieGenres();
  }

  @GetMapping("/genres/tv")
  public List<TmdbGenreDto> getTvGenres() {
    return tmdbService.getTvGenres();
  }

  private void requireAdultAllowed(UUID userId, boolean adult) {
    if (!adult) {
      return;
    }
    if (!allowsAdultContent(userId)) {
      throw new ResourceNotFoundException(ErrorCode.TMDB_RESOURCE_NOT_FOUND, "Resource not found");
    }
  }

  private boolean allowsAdultContent(UUID userId) {
    return viewerPreferences.allowsAdultContent(userId);
  }
}
