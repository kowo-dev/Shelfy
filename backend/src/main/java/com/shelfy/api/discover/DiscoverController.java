package com.shelfy.api.discover;

import com.shelfy.api.anilist.dto.AnimeSummaryResponseDto;
import com.shelfy.api.anilist.dto.MangaSummaryResponseDto;
import com.shelfy.api.common.dto.PagedResponseDto;
import com.shelfy.api.igdb.dto.GameSummaryResponseDto;
import com.shelfy.api.tmdb.dto.MovieSummaryResponseDto;
import com.shelfy.api.tmdb.dto.TvShowSummaryResponseDto;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/discover")
@RequiredArgsConstructor
public class DiscoverController {

  private static final int DEFAULT_PAGE_SIZE = 24;

  private final DiscoverService discoverService;

  @GetMapping("/movies/{feed}")
  public PagedResponseDto<MovieSummaryResponseDto> getMovies(
      @PathVariable DiscoverFeed feed,
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "" + DEFAULT_PAGE_SIZE) int size) {
    return discoverService.getMovies(feed, page, size);
  }

  @GetMapping("/series/{feed}")
  public PagedResponseDto<TvShowSummaryResponseDto> getSeries(
      @PathVariable DiscoverFeed feed,
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "" + DEFAULT_PAGE_SIZE) int size) {
    return discoverService.getSeries(feed, page, size);
  }

  @GetMapping("/games/{feed}")
  public PagedResponseDto<GameSummaryResponseDto> getGames(
      @PathVariable DiscoverFeed feed,
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "" + DEFAULT_PAGE_SIZE) int size) {
    return discoverService.getGames(feed, page, size);
  }

  @GetMapping("/anime/{feed}")
  public PagedResponseDto<AnimeSummaryResponseDto> getAnime(
      @PathVariable DiscoverFeed feed,
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "" + DEFAULT_PAGE_SIZE) int size) {
    return discoverService.getAnime(feed, page, size);
  }

  @GetMapping("/manga/{feed}")
  public PagedResponseDto<MangaSummaryResponseDto> getManga(
      @PathVariable DiscoverFeed feed,
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "" + DEFAULT_PAGE_SIZE) int size) {
    return discoverService.getManga(feed, page, size);
  }

  @GetMapping("/webtoons/{feed}")
  public PagedResponseDto<MangaSummaryResponseDto> getWebtoons(
      @PathVariable DiscoverFeed feed,
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "" + DEFAULT_PAGE_SIZE) int size) {
    return discoverService.getWebtoons(feed, page, size);
  }
}
