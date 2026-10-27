package com.shelfy.api.tmdb;

import com.shelfy.api.collection.MediaType;
import com.shelfy.api.related.RelatedMediaSource;
import com.shelfy.api.related.RelatedSection;
import com.shelfy.api.related.RelatedSectionFetcher;
import com.shelfy.api.related.dto.RelatedEntityDto;
import com.shelfy.api.related.dto.RelatedSectionResponseDto;
import com.shelfy.api.related.dto.SimilarMediaResponseDto;
import com.shelfy.api.search.dto.SearchResultResponseDto;
import com.shelfy.api.tmdb.client.TmdbClient;
import com.shelfy.api.tmdb.client.TmdbCompanyResponseDto;
import com.shelfy.api.tmdb.client.TmdbCreatorResponseDto;
import com.shelfy.api.tmdb.client.TmdbMovieResponseDto;
import com.shelfy.api.tmdb.client.TmdbPersonCrewCreditResponseDto;
import com.shelfy.api.tmdb.client.TmdbSearchResponseDto;
import com.shelfy.api.tmdb.client.TmdbTvShowResponseDto;
import com.shelfy.api.tmdb.dto.PersonRefDto;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.function.Supplier;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class TmdbRelatedSource implements RelatedMediaSource {

  private static final String PROVIDER = "tmdb";
  private static final Set<String> DIRECTOR_JOBS = Set.of("Director");
  private static final Set<String> CREATOR_JOBS = Set.of("Creator", "Director", "Writer");

  private final TmdbClient tmdbClient;
  private final RelatedSectionFetcher fetcher;

  @Override
  public boolean supports(MediaType mediaType) {
    return mediaType == MediaType.MOVIE || mediaType == MediaType.TV_SHOW;
  }

  @Override
  public List<RelatedSectionResponseDto> sections(MediaType mediaType, String externalId) {
    long id = Long.parseLong(externalId);
    return mediaType == MediaType.MOVIE ? movieSections(id) : tvShowSections(id);
  }

  @Override
  public SimilarMediaResponseDto similar(MediaType mediaType, String externalId, int page) {
    long id = Long.parseLong(externalId);
    if (mediaType == MediaType.MOVIE) {
      var payload = tmdbClient.fetchMovieRecommendations(id, page);
      return new SimilarMediaResponseDto(
          movies(payload.results()), payload.page(), payload.page() < payload.totalPages());
    }
    var payload = tmdbClient.fetchTvShowRecommendations(id, page);
    return new SimilarMediaResponseDto(
        tvShows(payload.results()), payload.page(), payload.page() < payload.totalPages());
  }

  private List<RelatedSectionResponseDto> movieSections(long id) {
    TmdbMovieResponseDto movie = tmdbClient.fetchMovieWithRecommendations(id);
    List<Supplier<Optional<RelatedSectionResponseDto>>> lookups = new ArrayList<>();
    lookups.add(() -> Optional.of(similarMovies(movie.recommendations())));
    if (movie.belongsToCollection() != null) {
      long collectionId = movie.belongsToCollection().id();
      lookups.add(() -> Optional.of(saga(collectionId)));
    }
    PersonRefDto director = TmdbMapper.findDirector(movie.credits());
    if (director != null) {
      lookups.add(
          () ->
              Optional.of(
                  RelatedSection.entity(
                      new RelatedEntityDto(
                          "people", String.valueOf(director.id()), director.name(), "director"),
                      crewWorks(director.id(), DIRECTOR_JOBS))));
    }
    firstNamed(movie.productionCompanies())
        .ifPresent(
            company ->
                lookups.add(
                    () ->
                        Optional.of(
                            RelatedSection.entity(
                                new RelatedEntityDto(
                                    "companies",
                                    String.valueOf(company.id()),
                                    company.name(),
                                    "studio"),
                                movies(
                                    tmdbClient
                                        .discoverMoviesByCompany(company.id(), 1)
                                        .results())))));
    return fetcher.fetchAll(lookups);
  }

  private List<RelatedSectionResponseDto> tvShowSections(long id) {
    TmdbTvShowResponseDto show = tmdbClient.fetchTvShowWithRecommendations(id);
    List<Supplier<Optional<RelatedSectionResponseDto>>> lookups = new ArrayList<>();
    lookups.add(() -> Optional.of(similarTvShows(show.recommendations())));
    firstCreator(show.createdBy())
        .ifPresent(
            creator ->
                lookups.add(
                    () ->
                        Optional.of(
                            RelatedSection.entity(
                                new RelatedEntityDto(
                                    "people",
                                    String.valueOf(creator.id()),
                                    creator.name(),
                                    "creator"),
                                crewWorks(creator.id(), CREATOR_JOBS)))));
    firstNamed(show.networks())
        .ifPresent(
            network ->
                lookups.add(
                    () ->
                        Optional.of(
                            RelatedSection.entity(
                                new RelatedEntityDto(
                                    "networks",
                                    String.valueOf(network.id()),
                                    network.name(),
                                    "network"),
                                tvShows(
                                    tmdbClient
                                        .discoverTvShowsByNetwork(network.id(), 1)
                                        .results())))));
    return fetcher.fetchAll(lookups);
  }

  private RelatedSectionResponseDto similarMovies(
      TmdbSearchResponseDto<TmdbMovieResponseDto> recommendations) {
    if (recommendations == null || recommendations.results() == null) {
      return RelatedSection.similar(List.of(), false);
    }
    return RelatedSection.similar(
        movies(recommendations.results()), recommendations.totalPages() > 1);
  }

  private RelatedSectionResponseDto similarTvShows(
      TmdbSearchResponseDto<TmdbTvShowResponseDto> recommendations) {
    if (recommendations == null || recommendations.results() == null) {
      return RelatedSection.similar(List.of(), false);
    }
    return RelatedSection.similar(
        tvShows(recommendations.results()), recommendations.totalPages() > 1);
  }

  private RelatedSectionResponseDto saga(long collectionId) {
    var collection = tmdbClient.fetchCollection(collectionId);
    List<TmdbMovieResponseDto> parts =
        collection.parts() == null
            ? List.of()
            : collection.parts().stream()
                .sorted(
                    Comparator.comparing(
                        TmdbMovieResponseDto::releaseDate,
                        Comparator.nullsLast(Comparator.naturalOrder())))
                .toList();
    return RelatedSection.franchise(collection.name(), movies(parts));
  }

  private List<SearchResultResponseDto> crewWorks(long personId, Set<String> jobs) {
    var credits = tmdbClient.fetchPerson(personId).combinedCredits();
    if (credits == null || credits.crew() == null) {
      return List.of();
    }
    return credits.crew().stream()
        .filter(credit -> !credit.adult() && jobs.contains(credit.job()))
        .filter(credit -> "movie".equals(credit.mediaType()) || "tv".equals(credit.mediaType()))
        .sorted(
            Comparator.comparing(
                TmdbPersonCrewCreditResponseDto::popularity,
                Comparator.nullsLast(Comparator.reverseOrder())))
        .map(TmdbRelatedSource::toItem)
        .toList();
  }

  private static Optional<TmdbCompanyResponseDto> firstNamed(List<TmdbCompanyResponseDto> list) {
    return list == null
        ? Optional.empty()
        : list.stream().filter(company -> company.name() != null).findFirst();
  }

  private static Optional<TmdbCreatorResponseDto> firstCreator(List<TmdbCreatorResponseDto> list) {
    return list == null
        ? Optional.empty()
        : list.stream().filter(creator -> creator.name() != null).findFirst();
  }

  private static List<SearchResultResponseDto> movies(List<TmdbMovieResponseDto> movies) {
    return movies == null
        ? List.of()
        : movies.stream()
            .filter(movie -> !movie.adult())
            .map(
                movie ->
                    item(
                        MediaType.MOVIE,
                        movie.id(),
                        movie.title(),
                        movie.posterPath(),
                        movie.overview(),
                        movie.releaseDate(),
                        movie.voteAverage(),
                        movie.voteCount()))
            .toList();
  }

  private static List<SearchResultResponseDto> tvShows(List<TmdbTvShowResponseDto> shows) {
    return shows == null
        ? List.of()
        : shows.stream()
            .filter(show -> !show.adult())
            .map(
                show ->
                    item(
                        MediaType.TV_SHOW,
                        show.id(),
                        show.name(),
                        show.posterPath(),
                        show.overview(),
                        show.firstAirDate(),
                        show.voteAverage(),
                        show.voteCount()))
            .toList();
  }

  private static SearchResultResponseDto toItem(TmdbPersonCrewCreditResponseDto credit) {
    boolean movie = "movie".equals(credit.mediaType());
    return item(
        movie ? MediaType.MOVIE : MediaType.TV_SHOW,
        credit.id(),
        movie ? credit.title() : credit.name(),
        credit.posterPath(),
        null,
        movie ? credit.releaseDate() : credit.firstAirDate(),
        credit.voteAverage(),
        null);
  }

  private static SearchResultResponseDto item(
      MediaType mediaType,
      long id,
      String title,
      String posterPath,
      String overview,
      String date,
      Double voteAverage,
      Integer voteCount) {
    return new SearchResultResponseDto(
        PROVIDER,
        mediaType,
        String.valueOf(id),
        title,
        posterPath,
        overview,
        year(date),
        List.of(),
        voteAverage,
        voteCount,
        null,
        false);
  }

  private static Integer year(String date) {
    return date == null || date.length() < 4 ? null : Integer.valueOf(date.substring(0, 4));
  }
}
