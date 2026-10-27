package com.shelfy.api.igdb;

import com.shelfy.api.igdb.client.IgdbClient;
import com.shelfy.api.igdb.client.IgdbExternalGameResponseDto;
import com.shelfy.api.igdb.client.IgdbGameModeResponseDto;
import com.shelfy.api.igdb.client.IgdbGameResponseDto;
import com.shelfy.api.igdb.client.IgdbGenreResponseDto;
import com.shelfy.api.igdb.client.IgdbImageResponseDto;
import com.shelfy.api.igdb.client.IgdbInvolvedCompanyResponseDto;
import com.shelfy.api.igdb.client.IgdbPlatformResponseDto;
import com.shelfy.api.igdb.client.IgdbThemeResponseDto;
import com.shelfy.api.igdb.dto.CompanyRefDto;
import com.shelfy.api.igdb.dto.FacetRefDto;
import com.shelfy.api.igdb.dto.GameDetailResponseDto;
import com.shelfy.api.igdb.dto.GameSummaryResponseDto;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

final class IgdbMapper {

  private static final double RATING_SCALE = 10.0;

  private IgdbMapper() {}

  static GameSummaryResponseDto toGameSummary(IgdbGameResponseDto payload) {
    return new GameSummaryResponseDto(
        payload.id(),
        payload.name(),
        payload.summary(),
        toDate(payload.firstReleaseDate()),
        extractImageId(payload.cover()),
        toImageIds(payload.screenshots()),
        toImageIds(payload.artworks()),
        toNames(payload.genres(), IgdbGenreResponseDto::name),
        toNames(payload.platforms(), IgdbPlatformResponseDto::name),
        toRating(payload.totalRating()),
        orZero(payload.totalRatingCount()),
        isAdult(payload));
  }

  static GameDetailResponseDto toGameDetail(
      IgdbGameResponseDto payload, List<IgdbGameResponseDto> dlcs) {
    return new GameDetailResponseDto(
        payload.id(),
        payload.name(),
        payload.summary(),
        payload.storyline(),
        toDate(payload.firstReleaseDate()),
        extractImageId(payload.cover()),
        toImageIds(payload.screenshots()),
        toImageIds(payload.artworks()),
        toFacetRefs(payload.genres()),
        toFacetRefs(payload.platforms()),
        toFacetRefs(payload.themes()),
        toCompanyRefList(payload.involvedCompanies(), true),
        toCompanyRefList(payload.involvedCompanies(), false),
        toFacetRefs(payload.gameModes()),
        toRating(payload.totalRating()),
        orZero(payload.totalRatingCount()),
        payload.franchise() == null ? null : payload.franchise().id(),
        payload.franchise() == null ? null : payload.franchise().name(),
        dlcs == null ? List.of() : dlcs.stream().map(IgdbMapper::toGameSummary).toList(),
        isAdult(payload),
        steamAppIds(payload.externalGames()));
  }

  private static boolean isAdult(IgdbGameResponseDto payload) {
    return payload.themes() != null
        && payload.themes().stream().anyMatch(theme -> theme.id() == IgdbClient.EROTIC_THEME_ID);
  }

  private static Set<String> steamAppIds(List<IgdbExternalGameResponseDto> externalGames) {
    if (externalGames == null) {
      return Set.of();
    }
    return externalGames.stream()
        .filter(game -> game.externalGameSource() == 1)
        .map(IgdbExternalGameResponseDto::uid)
        .filter(Objects::nonNull)
        .collect(Collectors.toUnmodifiableSet());
  }

  private static List<CompanyRefDto> toCompanyRefList(
      List<IgdbInvolvedCompanyResponseDto> involvedCompanies, boolean developer) {
    if (involvedCompanies == null) {
      return List.of();
    }
    return involvedCompanies.stream()
        .filter(
            ic ->
                Boolean.TRUE.equals(developer ? ic.developer() : ic.publisher())
                    && ic.company() != null
                    && ic.company().name() != null)
        .map(IgdbStructMapper.INSTANCE::toCompanyRef)
        .distinct()
        .toList();
  }

  private static <T> List<String> toNames(List<T> items, Function<T, String> nameExtractor) {
    if (items == null) {
      return List.of();
    }
    return items.stream().map(nameExtractor).toList();
  }

  private static List<FacetRefDto> toFacetRefs(List<?> items) {
    if (items == null) {
      return List.of();
    }
    return items.stream().map(IgdbMapper::toFacetRef).filter(Objects::nonNull).toList();
  }

  private static FacetRefDto toFacetRef(Object item) {
    if (item instanceof IgdbGenreResponseDto g) {
      return IgdbStructMapper.INSTANCE.toFacetRef(g);
    }
    if (item instanceof IgdbPlatformResponseDto p) {
      return IgdbStructMapper.INSTANCE.toFacetRef(p);
    }
    if (item instanceof IgdbThemeResponseDto t) {
      return IgdbStructMapper.INSTANCE.toFacetRef(t);
    }
    if (item instanceof IgdbGameModeResponseDto gm) {
      return IgdbStructMapper.INSTANCE.toFacetRef(gm);
    }
    return null;
  }

  private static List<String> toImageIds(List<IgdbImageResponseDto> images) {
    if (images == null) {
      return List.of();
    }
    return images.stream().map(IgdbMapper::extractImageId).filter(Objects::nonNull).toList();
  }

  private static String extractImageId(IgdbImageResponseDto image) {
    if (image == null || image.url() == null) {
      return null;
    }
    String url = image.url();
    int lastSlash = url.lastIndexOf('/');
    String fileName = lastSlash >= 0 ? url.substring(lastSlash + 1) : url;
    int dotIndex = fileName.lastIndexOf('.');
    return dotIndex >= 0 ? fileName.substring(0, dotIndex) : fileName;
  }

  private static LocalDate toDate(Long unixSeconds) {
    if (unixSeconds == null) {
      return null;
    }
    return Instant.ofEpochSecond(unixSeconds).atZone(ZoneOffset.UTC).toLocalDate();
  }

  private static double toRating(Double totalRating) {
    return totalRating == null ? 0.0 : totalRating / RATING_SCALE;
  }

  private static int orZero(Integer value) {
    return value == null ? 0 : value;
  }
}
