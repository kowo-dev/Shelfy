package com.shelfy.api.tmdb;

import com.shelfy.api.common.dto.NextAiringDto;
import com.shelfy.api.tmdb.client.TmdbCastMemberResponseDto;
import com.shelfy.api.tmdb.client.TmdbCombinedCreditsResponseDto;
import com.shelfy.api.tmdb.client.TmdbCompanyDetailResponseDto;
import com.shelfy.api.tmdb.client.TmdbCompanyResponseDto;
import com.shelfy.api.tmdb.client.TmdbCreditsResponseDto;
import com.shelfy.api.tmdb.client.TmdbEpisodeResponseDto;
import com.shelfy.api.tmdb.client.TmdbGenreResponseDto;
import com.shelfy.api.tmdb.client.TmdbImageResponseDto;
import com.shelfy.api.tmdb.client.TmdbImagesResponseDto;
import com.shelfy.api.tmdb.client.TmdbMovieResponseDto;
import com.shelfy.api.tmdb.client.TmdbPersonCastCreditResponseDto;
import com.shelfy.api.tmdb.client.TmdbPersonCrewCreditResponseDto;
import com.shelfy.api.tmdb.client.TmdbPersonResponseDto;
import com.shelfy.api.tmdb.client.TmdbSeasonDetailResponseDto;
import com.shelfy.api.tmdb.client.TmdbSeasonSummaryResponseDto;
import com.shelfy.api.tmdb.client.TmdbTvShowResponseDto;
import com.shelfy.api.tmdb.client.TmdbVideoResponseDto;
import com.shelfy.api.tmdb.client.TmdbVideosResponseDto;
import com.shelfy.api.tmdb.dto.CastMemberResponseDto;
import com.shelfy.api.tmdb.dto.CompanyDetailResponseDto;
import com.shelfy.api.tmdb.dto.CompanyRefDto;
import com.shelfy.api.tmdb.dto.EpisodeResponseDto;
import com.shelfy.api.tmdb.dto.MovieDetailResponseDto;
import com.shelfy.api.tmdb.dto.MovieSummaryResponseDto;
import com.shelfy.api.tmdb.dto.PersonCreditResponseDto;
import com.shelfy.api.tmdb.dto.PersonDetailResponseDto;
import com.shelfy.api.tmdb.dto.PersonRefDto;
import com.shelfy.api.tmdb.dto.SeasonDetailResponseDto;
import com.shelfy.api.tmdb.dto.SeasonSummaryResponseDto;
import com.shelfy.api.tmdb.dto.TmdbGenreDto;
import com.shelfy.api.tmdb.dto.TvShowDetailResponseDto;
import com.shelfy.api.tmdb.dto.TvShowSummaryResponseDto;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.function.Function;

final class TmdbMapper {

  private static final int MAX_CAST_SIZE = 10;
  private static final int MAX_GALLERY_SIZE = 12;
  private static final String YOUTUBE_WATCH = "https://www.youtube.com/watch?v=";

  private TmdbMapper() {}

  static MovieSummaryResponseDto toMovieSummary(TmdbMovieResponseDto payload) {
    return new MovieSummaryResponseDto(
        payload.id(),
        payload.title(),
        payload.originalTitle(),
        payload.overview(),
        payload.posterPath(),
        payload.backdropPath(),
        parseDate(payload.releaseDate()),
        payload.genreIds(),
        orZero(payload.voteAverage()),
        orZero(payload.voteCount()),
        payload.adult());
  }

  static MovieDetailResponseDto toMovieDetail(TmdbMovieResponseDto payload) {
    return new MovieDetailResponseDto(
        payload.id(),
        payload.title(),
        payload.originalTitle(),
        payload.overview(),
        payload.posterPath(),
        payload.backdropPath(),
        parseDate(payload.releaseDate()),
        payload.runtime(),
        toGenres(payload.genres()),
        orZero(payload.voteAverage()),
        orZero(payload.voteCount()),
        payload.adult(),
        payload.budget(),
        payload.revenue(),
        toCompanyRefs(payload.productionCompanies()),
        findDirector(payload.credits()),
        toImagePaths(payload.images(), TmdbImagesResponseDto::backdrops),
        toImagePaths(payload.images(), TmdbImagesResponseDto::posters),
        toCast(payload.credits()),
        toTrailerUrl(payload.videos()));
  }

  static TvShowSummaryResponseDto toTvShowSummary(TmdbTvShowResponseDto payload) {
    return new TvShowSummaryResponseDto(
        payload.id(),
        payload.name(),
        payload.originalName(),
        payload.overview(),
        payload.posterPath(),
        payload.backdropPath(),
        parseDate(payload.firstAirDate()),
        payload.genreIds(),
        orZero(payload.voteAverage()),
        orZero(payload.voteCount()),
        payload.adult());
  }

  static TvShowDetailResponseDto toTvShowDetail(TmdbTvShowResponseDto payload) {
    return new TvShowDetailResponseDto(
        payload.id(),
        payload.name(),
        payload.originalName(),
        payload.overview(),
        payload.posterPath(),
        payload.backdropPath(),
        parseDate(payload.firstAirDate()),
        payload.numberOfSeasons(),
        payload.numberOfEpisodes(),
        toSeasonSummaries(payload.seasons()),
        toGenres(payload.genres()),
        orZero(payload.voteAverage()),
        orZero(payload.voteCount()),
        toCompanyRefs(payload.productionCompanies()),
        toCompanyRefs(payload.networks()),
        toImagePaths(payload.images(), TmdbImagesResponseDto::backdrops),
        toImagePaths(payload.images(), TmdbImagesResponseDto::posters),
        toCast(payload.credits()),
        payload.adult(),
        toTrailerUrl(payload.videos()));
  }

  static List<TmdbGenreDto> toGenres(List<TmdbGenreResponseDto> genres) {
    if (genres == null) {
      return List.of();
    }
    return genres.stream().map(TmdbStructMapper.INSTANCE::toGenre).toList();
  }

  static SeasonDetailResponseDto toSeasonDetail(TmdbSeasonDetailResponseDto payload) {
    List<EpisodeResponseDto> episodes =
        payload.episodes() == null
            ? List.of()
            : payload.episodes().stream().map(TmdbStructMapper.INSTANCE::toEpisode).toList();
    return new SeasonDetailResponseDto(
        payload.seasonNumber(), payload.name(), payload.overview(), payload.posterPath(), episodes);
  }

  private static List<SeasonSummaryResponseDto> toSeasonSummaries(
      List<TmdbSeasonSummaryResponseDto> seasons) {
    if (seasons == null) {
      return List.of();
    }
    return seasons.stream().map(TmdbStructMapper.INSTANCE::toSeasonSummary).toList();
  }

  private static List<CastMemberResponseDto> toCast(TmdbCreditsResponseDto credits) {
    if (credits == null || credits.cast() == null) {
      return List.of();
    }
    return credits.cast().stream()
        .sorted(Comparator.comparingInt(TmdbCastMemberResponseDto::order))
        .limit(MAX_CAST_SIZE)
        .map(TmdbStructMapper.INSTANCE::toCastMember)
        .toList();
  }

  private static List<CompanyRefDto> toCompanyRefs(List<TmdbCompanyResponseDto> companies) {
    if (companies == null) {
      return List.of();
    }
    return companies.stream()
        .filter(company -> company.name() != null)
        .map(TmdbStructMapper.INSTANCE::toCompanyRef)
        .toList();
  }

  static PersonRefDto findDirector(TmdbCreditsResponseDto credits) {
    if (credits == null || credits.crew() == null) {
      return null;
    }
    return credits.crew().stream()
        .filter(member -> "Director".equalsIgnoreCase(member.job()))
        .filter(member -> member.name() != null)
        .map(member -> new PersonRefDto(member.id(), member.name()))
        .findFirst()
        .orElse(null);
  }

  static PersonDetailResponseDto toPersonDetail(
      TmdbPersonResponseDto payload, boolean adultContentAllowed) {
    List<PersonCreditResponseDto> credits =
        toPersonCredits(payload.combinedCredits(), adultContentAllowed);
    return new PersonDetailResponseDto(
        payload.id(),
        payload.name(),
        payload.biography(),
        payload.profilePath(),
        parseDate(payload.birthday()),
        parseDate(payload.deathday()),
        payload.placeOfBirth(),
        credits);
  }

  static CompanyDetailResponseDto toCompanyDetail(TmdbCompanyDetailResponseDto payload) {
    return new CompanyDetailResponseDto(
        payload.id(),
        payload.name(),
        payload.description(),
        payload.headquarters(),
        payload.originCountry());
  }

  private static List<PersonCreditResponseDto> toPersonCredits(
      TmdbCombinedCreditsResponseDto credits, boolean adultContentAllowed) {
    if (credits == null) {
      return List.of();
    }
    Map<String, PersonCreditResponseDto> byMedia = new LinkedHashMap<>();
    if (credits.cast() != null) {
      for (TmdbPersonCastCreditResponseDto credit : credits.cast()) {
        addPersonCredit(
            byMedia,
            credit.mediaType(),
            credit.id(),
            title(credit.title(), credit.name()),
            credit.posterPath(),
            credit.releaseDate(),
            credit.firstAirDate(),
            credit.character(),
            null,
            credit.popularity(),
            credit.voteAverage(),
            credit.adult(),
            adultContentAllowed);
      }
    }
    if (credits.crew() != null) {
      for (TmdbPersonCrewCreditResponseDto credit : credits.crew()) {
        String key = credit.mediaType() + ":" + credit.id();
        if (byMedia.containsKey(key)) {
          continue;
        }
        addPersonCredit(
            byMedia,
            credit.mediaType(),
            credit.id(),
            title(credit.title(), credit.name()),
            credit.posterPath(),
            credit.releaseDate(),
            credit.firstAirDate(),
            null,
            credit.job(),
            credit.popularity(),
            credit.voteAverage(),
            credit.adult(),
            adultContentAllowed);
      }
    }
    return byMedia.values().stream()
        .sorted(Comparator.comparingDouble(PersonCreditResponseDto::popularity).reversed())
        .toList();
  }

  private static void addPersonCredit(
      Map<String, PersonCreditResponseDto> byMedia,
      String mediaType,
      long mediaId,
      String title,
      String posterPath,
      String releaseDate,
      String firstAirDate,
      String character,
      String job,
      Double popularity,
      Double voteAverage,
      boolean adult,
      boolean adultContentAllowed) {
    if (title == null || mediaType == null || (adult && !adultContentAllowed)) {
      return;
    }
    String date = releaseDate != null ? releaseDate : firstAirDate;
    byMedia.put(
        mediaType + ":" + mediaId,
        new PersonCreditResponseDto(
            mediaId,
            mediaType,
            title,
            posterPath,
            parseDate(date),
            character,
            job,
            popularity == null ? 0.0 : popularity,
            voteAverage == null ? 0.0 : voteAverage));
  }

  private static String title(String title, String name) {
    return title != null ? title : name;
  }

  static String toTrailerUrl(TmdbVideosResponseDto videos) {
    if (videos == null || videos.results() == null) {
      return null;
    }
    return videos.results().stream()
        .filter(video -> "YouTube".equals(video.site()) && video.key() != null)
        .filter(video -> "Trailer".equals(video.type()) || "Teaser".equals(video.type()))
        .min(
            Comparator.comparing((TmdbVideoResponseDto video) -> !"Trailer".equals(video.type()))
                .thenComparing(video -> !Boolean.TRUE.equals(video.official())))
        .map(video -> YOUTUBE_WATCH + video.key())
        .orElse(null);
  }

  private static List<String> toImagePaths(
      TmdbImagesResponseDto images,
      Function<TmdbImagesResponseDto, List<TmdbImageResponseDto>> selector) {
    if (images == null) {
      return List.of();
    }
    List<TmdbImageResponseDto> list = selector.apply(images);
    if (list == null) {
      return List.of();
    }
    return list.stream()
        .sorted(Comparator.comparingDouble(TmdbImageResponseDto::voteAverage).reversed())
        .limit(MAX_GALLERY_SIZE)
        .map(TmdbImageResponseDto::filePath)
        .filter(Objects::nonNull)
        .toList();
  }

  static NextAiringDto toNextAiring(TmdbTvShowResponseDto payload) {
    TmdbEpisodeResponseDto next = payload.nextEpisodeToAir();
    if (next == null) {
      return NextAiringDto.NONE;
    }
    return new NextAiringDto(
        next.seasonNumber(),
        next.episodeNumber(),
        next.name(),
        parseDate(next.airDate()),
        null,
        next.stillPath());
  }

  private static LocalDate parseDate(String value) {
    if (value == null || value.isBlank()) {
      return null;
    }
    return LocalDate.parse(value);
  }

  private static double orZero(Double value) {
    return value == null ? 0.0 : value;
  }

  private static int orZero(Integer value) {
    return value == null ? 0 : value;
  }
}
