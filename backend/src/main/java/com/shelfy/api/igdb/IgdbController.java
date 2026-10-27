package com.shelfy.api.igdb;

import com.shelfy.api.auth.ViewerPreferences;
import com.shelfy.api.common.exception.ErrorCode;
import com.shelfy.api.common.exception.ResourceNotFoundException;
import com.shelfy.api.igdb.dto.CompanyDetailResponseDto;
import com.shelfy.api.igdb.dto.FranchiseDetailResponseDto;
import com.shelfy.api.igdb.dto.GameDetailResponseDto;
import com.shelfy.api.igdb.dto.GameSummaryResponseDto;
import com.shelfy.api.igdb.dto.MediaPageResponseDto;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/igdb")
@RequiredArgsConstructor
public class IgdbController {

  private final IgdbService igdbService;
  private final ViewerPreferences viewerPreferences;

  @GetMapping("/games/{id}")
  public GameDetailResponseDto getGame(
      @AuthenticationPrincipal UUID userId, @PathVariable long id) {
    GameDetailResponseDto game = igdbService.getGame(id);
    requireAdultAllowed(userId, game.isAdult());
    return game;
  }

  @GetMapping("/companies/{id}")
  public CompanyDetailResponseDto getCompany(@PathVariable long id) {
    return igdbService.getCompany(id);
  }

  @GetMapping("/companies/{id}/games")
  public MediaPageResponseDto<GameSummaryResponseDto> getCompanyGames(
      @AuthenticationPrincipal UUID userId,
      @PathVariable long id,
      @RequestParam(defaultValue = "0") int page) {
    return igdbService.getCompanyGames(id, allowsAdultContent(userId), page);
  }

  @GetMapping("/franchises/{id}")
  public FranchiseDetailResponseDto getFranchise(@PathVariable long id) {
    return igdbService.getFranchise(id);
  }

  @GetMapping("/franchises/{id}/games")
  public MediaPageResponseDto<GameSummaryResponseDto> getFranchiseGames(
      @AuthenticationPrincipal UUID userId,
      @PathVariable long id,
      @RequestParam(defaultValue = "0") int page) {
    return igdbService.getFranchiseGames(id, allowsAdultContent(userId), page);
  }

  @GetMapping("/games/by-genre/{id}")
  public MediaPageResponseDto<GameSummaryResponseDto> getGamesByGenre(
      @AuthenticationPrincipal UUID userId,
      @PathVariable long id,
      @RequestParam(defaultValue = "0") int page) {
    return igdbService.getGamesByGenre(id, allowsAdultContent(userId), page);
  }

  @GetMapping("/games/by-platform/{id}")
  public MediaPageResponseDto<GameSummaryResponseDto> getGamesByPlatform(
      @AuthenticationPrincipal UUID userId,
      @PathVariable long id,
      @RequestParam(defaultValue = "0") int page) {
    return igdbService.getGamesByPlatform(id, allowsAdultContent(userId), page);
  }

  @GetMapping("/games/by-theme/{id}")
  public MediaPageResponseDto<GameSummaryResponseDto> getGamesByTheme(
      @AuthenticationPrincipal UUID userId,
      @PathVariable long id,
      @RequestParam(defaultValue = "0") int page) {
    return igdbService.getGamesByTheme(id, allowsAdultContent(userId), page);
  }

  @GetMapping("/games/by-game-mode/{id}")
  public MediaPageResponseDto<GameSummaryResponseDto> getGamesByGameMode(
      @AuthenticationPrincipal UUID userId,
      @PathVariable long id,
      @RequestParam(defaultValue = "0") int page) {
    return igdbService.getGamesByGameMode(id, allowsAdultContent(userId), page);
  }

  private void requireAdultAllowed(UUID userId, boolean adult) {
    if (!adult) {
      return;
    }
    if (!allowsAdultContent(userId)) {
      throw new ResourceNotFoundException(ErrorCode.IGDB_RESOURCE_NOT_FOUND, "Resource not found");
    }
  }

  private boolean allowsAdultContent(UUID userId) {
    return viewerPreferences.allowsAdultContent(userId);
  }
}
