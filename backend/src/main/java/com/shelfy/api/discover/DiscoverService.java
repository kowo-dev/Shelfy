package com.shelfy.api.discover;

import com.shelfy.api.anilist.dto.AnimeSummaryResponseDto;
import com.shelfy.api.anilist.dto.MangaSummaryResponseDto;
import com.shelfy.api.common.dto.PagedResponseDto;
import com.shelfy.api.discover.cache.DiscoverCacheService;
import com.shelfy.api.igdb.dto.GameSummaryResponseDto;
import com.shelfy.api.tmdb.dto.MovieSummaryResponseDto;
import com.shelfy.api.tmdb.dto.TvShowSummaryResponseDto;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class DiscoverService {

  private final DiscoverCacheService discoverCacheService;

  public PagedResponseDto<MovieSummaryResponseDto> getMovies(
      DiscoverFeed feed, int page, int size) {
    return discoverCacheService.slice(
        DiscoverCacheService.MOVIE, feed, page, size, MovieSummaryResponseDto.class);
  }

  public PagedResponseDto<TvShowSummaryResponseDto> getSeries(
      DiscoverFeed feed, int page, int size) {
    return discoverCacheService.slice(
        DiscoverCacheService.TV_SHOW, feed, page, size, TvShowSummaryResponseDto.class);
  }

  public PagedResponseDto<GameSummaryResponseDto> getGames(DiscoverFeed feed, int page, int size) {
    return discoverCacheService.slice(
        DiscoverCacheService.GAME, feed, page, size, GameSummaryResponseDto.class);
  }

  public PagedResponseDto<AnimeSummaryResponseDto> getAnime(DiscoverFeed feed, int page, int size) {
    return discoverCacheService.slice(
        DiscoverCacheService.ANIME, feed, page, size, AnimeSummaryResponseDto.class);
  }

  public PagedResponseDto<MangaSummaryResponseDto> getManga(DiscoverFeed feed, int page, int size) {
    return discoverCacheService.slice(
        DiscoverCacheService.MANGA, feed, page, size, MangaSummaryResponseDto.class);
  }

  public PagedResponseDto<MangaSummaryResponseDto> getWebtoons(
      DiscoverFeed feed, int page, int size) {
    return discoverCacheService.slice(
        DiscoverCacheService.WEBTOON, feed, page, size, MangaSummaryResponseDto.class);
  }
}
