package com.shelfy.api.search;

import com.shelfy.api.anilist.AniListService;
import com.shelfy.api.auth.ViewerPreferences;
import com.shelfy.api.collection.MediaType;
import com.shelfy.api.igdb.IgdbService;
import com.shelfy.api.igdb.dto.IgdbFacetKind;
import com.shelfy.api.search.ExploreCriterion.Kind;
import com.shelfy.api.search.dto.ExploreOptionResponseDto;
import com.shelfy.api.search.dto.ExploreVocabularyResponseDto;
import com.shelfy.api.tmdb.TmdbService;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import java.util.regex.Pattern;
import java.util.stream.Stream;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class ExploreOptionsService {

  private static final int MAX_OPTIONS = 60;
  private static final int MAX_STREAMING_SERVICES = 40;
  private static final int MIN_KEYWORD_QUERY = 2;
  private static final int MAX_QUERY_LENGTH = 60;
  private static final Pattern REGION = Pattern.compile("[A-Z]{2}");
  private static final String GENRE = "genre";
  private static final String THEME = "theme";
  private static final String KEYWORD = "keyword";

  private final ExploreVocabulary vocabulary;
  private final TmdbService tmdbService;
  private final AniListService aniListService;
  private final IgdbService igdbService;
  private final ViewerPreferences viewerPreferences;

  public ExploreVocabularyResponseDto getVocabulary() {
    return new ExploreVocabularyResponseDto(
        vocabulary.entries().stream()
            .map(
                entry ->
                    new ExploreVocabularyResponseDto.Criterion(
                        entry.id(),
                        entry.group().name().toLowerCase(Locale.ROOT),
                        entry.mediaTypes()))
            .toList(),
        vocabulary.platforms().stream()
            .map(
                platform ->
                    new ExploreOptionResponseDto(
                        Kind.PLATFORM.prefix() + ":" + platform.id(),
                        platform.label(),
                        "platform",
                        null))
            .toList());
  }

  public List<ExploreOptionResponseDto> listStreamingServices(String region) {
    if (region == null || !REGION.matcher(region).matches()) {
      throw new IllegalArgumentException("Invalid region");
    }
    return tmdbService.getWatchProviders(region).stream()
        .limit(MAX_STREAMING_SERVICES)
        .map(
            provider ->
                new ExploreOptionResponseDto(
                    Kind.STREAMING.prefix() + ":" + provider.id(),
                    provider.name(),
                    "streaming",
                    provider.logoPath()))
        .toList();
  }

  public List<ExploreOptionResponseDto> listCatalogOptions(
      UUID userId, MediaType type, String query) {
    String search = query == null ? "" : query.strip();
    if (type == null
        || type == MediaType.BOOK
        || search.length() > MAX_QUERY_LENGTH
        || search.chars().anyMatch(Character::isISOControl)) {
      throw new IllegalArgumentException("Invalid catalog options request");
    }
    List<ExploreOptionResponseDto> options =
        switch (type) {
          case MOVIE, TV_SHOW -> tmdbOptions(type, search);
          case ANIME, MANGA, WEBTOON -> aniListOptions(userId, search);
          case GAME -> igdbOptions(search);
          case BOOK -> List.of();
        };
    return options.stream().limit(MAX_OPTIONS).toList();
  }

  private List<ExploreOptionResponseDto> tmdbOptions(MediaType type, String search) {
    var genres = type == MediaType.MOVIE ? tmdbService.getMovieGenres() : tmdbService.getTvGenres();
    Stream<ExploreOptionResponseDto> genreOptions =
        genres.stream()
            .filter(genre -> matches(genre.name(), search))
            .map(genre -> option(Kind.TMDB_GENRE, String.valueOf(genre.id()), genre.name(), GENRE));
    if (search.length() < MIN_KEYWORD_QUERY) {
      return genreOptions.toList();
    }
    Stream<ExploreOptionResponseDto> keywordOptions =
        tmdbService.searchKeywords(search).stream()
            .map(
                keyword ->
                    option(
                        Kind.TMDB_KEYWORD, String.valueOf(keyword.id()), keyword.name(), KEYWORD));
    return Stream.concat(genreOptions, keywordOptions).toList();
  }

  private List<ExploreOptionResponseDto> aniListOptions(UUID userId, String search) {
    boolean includeAdult = viewerPreferences.allowsAdultContent(userId);
    List<ExploreOptionResponseDto> options = new ArrayList<>();
    aniListService.getGenres().stream()
        .filter(genre -> matches(genre, search))
        .forEach(genre -> options.add(option(Kind.ANILIST_GENRE, genre, genre, GENRE)));
    aniListService.getTags(includeAdult).stream()
        .filter(tag -> matches(tag, search))
        .forEach(tag -> options.add(option(Kind.ANILIST_TAG, tag, tag, THEME)));
    return options;
  }

  private List<ExploreOptionResponseDto> igdbOptions(String search) {
    List<ExploreOptionResponseDto> options = new ArrayList<>();
    igdbService.getFacets(IgdbFacetKind.GENRE, "").stream()
        .filter(genre -> matches(genre.name(), search))
        .forEach(
            genre ->
                options.add(
                    option(Kind.IGDB_GENRE, String.valueOf(genre.id()), genre.name(), GENRE)));
    igdbService.getFacets(IgdbFacetKind.THEME, "").stream()
        .filter(theme -> matches(theme.name(), search))
        .forEach(
            theme ->
                options.add(
                    option(Kind.IGDB_THEME, String.valueOf(theme.id()), theme.name(), THEME)));
    if (search.length() >= MIN_KEYWORD_QUERY) {
      igdbService.getFacets(IgdbFacetKind.KEYWORD, search).stream()
          .forEach(
              keyword ->
                  options.add(
                      option(
                          Kind.IGDB_KEYWORD,
                          String.valueOf(keyword.id()),
                          keyword.name(),
                          KEYWORD)));
    }
    return options;
  }

  private static boolean matches(String label, String search) {
    return search.isEmpty()
        || label.toLowerCase(Locale.ROOT).contains(search.toLowerCase(Locale.ROOT));
  }

  private static ExploreOptionResponseDto option(
      Kind kind, String value, String label, String group) {
    return new ExploreOptionResponseDto(kind.prefix() + ":" + value, label, group, null);
  }
}
