package com.shelfy.api.tmdb;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.shelfy.api.collection.MediaType;
import com.shelfy.api.related.RelatedSectionFetcher;
import com.shelfy.api.related.dto.RelatedEntityDto;
import com.shelfy.api.related.dto.RelatedSectionResponseDto;
import com.shelfy.api.search.dto.SearchResultResponseDto;
import com.shelfy.api.tmdb.client.TmdbClient;
import com.shelfy.api.tmdb.client.TmdbCollectionRefResponseDto;
import com.shelfy.api.tmdb.client.TmdbCollectionResponseDto;
import com.shelfy.api.tmdb.client.TmdbCombinedCreditsResponseDto;
import com.shelfy.api.tmdb.client.TmdbCompanyResponseDto;
import com.shelfy.api.tmdb.client.TmdbCreditsResponseDto;
import com.shelfy.api.tmdb.client.TmdbCrewMemberResponseDto;
import com.shelfy.api.tmdb.client.TmdbMovieResponseDto;
import com.shelfy.api.tmdb.client.TmdbPersonCrewCreditResponseDto;
import com.shelfy.api.tmdb.client.TmdbPersonResponseDto;
import com.shelfy.api.tmdb.client.TmdbSearchResponseDto;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

class TmdbRelatedSourceTest {

  private final TmdbClient client = mock(TmdbClient.class);
  private final RelatedSectionFetcher fetcher = new RelatedSectionFetcher();
  private final TmdbRelatedSource source = new TmdbRelatedSource(client, fetcher);

  @AfterEach
  void tearDown() {
    fetcher.close();
  }

  @Test
  void movieSections_listRecommendationsSagaDirectorAndStudioInOrder() {
    when(client.fetchMovieWithRecommendations(1))
        .thenReturn(
            movie(
                1,
                "Dune",
                new TmdbCollectionRefResponseDto(50, "Dune Collection"),
                new TmdbCreditsResponseDto(
                    List.of(),
                    List.of(
                        new TmdbCrewMemberResponseDto(7, "Denis", "Director", "Directing", null))),
                List.of(new TmdbCompanyResponseDto(3, "Legendary", null, null)),
                new TmdbSearchResponseDto<>(List.of(movie(2, "Arrival")), 1, 3, 60)));
    when(client.fetchCollection(50))
        .thenReturn(
            new TmdbCollectionResponseDto(
                50,
                "Dune Collection",
                List.of(movieOn(4, "2024-02-27"), movieOn(1, "2021-09-15"))));
    when(client.fetchPerson(7))
        .thenReturn(
            person(
                crew(2, "movie", "Director", 80.0),
                crew(5, "movie", "Writer", 99.0),
                crew(6, "movie", "Director", 90.0)));
    when(client.discoverMoviesByCompany(3, 1))
        .thenReturn(new TmdbSearchResponseDto<>(List.of(movie(8, "Godzilla")), 1, 1, 1));

    List<RelatedSectionResponseDto> sections = source.sections(MediaType.MOVIE, "1");

    assertThat(sections)
        .extracting(RelatedSectionResponseDto::kind)
        .containsExactly("similar", "franchise", "entity", "entity");
    assertThat(sections.get(0).hasMore()).isTrue();
    assertThat(ids(sections.get(0))).containsExactly("2");
    assertThat(sections.get(1).label()).isEqualTo("Dune Collection");
    assertThat(ids(sections.get(1))).containsExactly("1", "4");
    assertThat(sections.get(2).entity())
        .isEqualTo(new RelatedEntityDto("people", "7", "Denis", "director"));
    assertThat(ids(sections.get(2))).containsExactly("6", "2");
    assertThat(sections.get(3).entity().kind()).isEqualTo("companies");
    assertThat(ids(sections.get(3))).containsExactly("8");
  }

  @Test
  void movieSections_dropASectionWhoseLookupFails() {
    when(client.fetchMovieWithRecommendations(1))
        .thenReturn(
            movie(
                1,
                "Dune",
                new TmdbCollectionRefResponseDto(50, "Dune Collection"),
                null,
                List.of(),
                new TmdbSearchResponseDto<>(List.of(movie(2, "Arrival")), 1, 1, 1)));
    when(client.fetchCollection(50)).thenThrow(new IllegalStateException("TMDB down"));

    List<RelatedSectionResponseDto> sections = source.sections(MediaType.MOVIE, "1");

    assertThat(sections).extracting(RelatedSectionResponseDto::kind).containsExactly("similar");
  }

  private static List<String> ids(RelatedSectionResponseDto section) {
    return section.items().stream().map(SearchResultResponseDto::externalId).toList();
  }

  private static TmdbMovieResponseDto movie(long id, String title) {
    return movie(id, title, null, null, List.of(), null);
  }

  private static TmdbMovieResponseDto movieOn(long id, String releaseDate) {
    return new TmdbMovieResponseDto(
        id,
        "Movie " + id,
        null,
        null,
        null,
        null,
        releaseDate,
        List.of(),
        List.of(),
        null,
        null,
        false,
        null,
        null,
        null,
        List.of(),
        null,
        null,
        null,
        null,
        null);
  }

  private static TmdbMovieResponseDto movie(
      long id,
      String title,
      TmdbCollectionRefResponseDto collection,
      TmdbCreditsResponseDto credits,
      List<TmdbCompanyResponseDto> companies,
      TmdbSearchResponseDto<TmdbMovieResponseDto> recommendations) {
    return new TmdbMovieResponseDto(
        id,
        title,
        title,
        "",
        null,
        null,
        "2021-09-15",
        List.of(),
        List.of(),
        8.0,
        100,
        false,
        null,
        null,
        null,
        companies,
        credits,
        null,
        collection,
        recommendations,
        null);
  }

  private static TmdbPersonResponseDto person(TmdbPersonCrewCreditResponseDto... crew) {
    return new TmdbPersonResponseDto(
        7,
        "Denis",
        null,
        null,
        null,
        null,
        null,
        new TmdbCombinedCreditsResponseDto(List.of(), List.of(crew)));
  }

  private static TmdbPersonCrewCreditResponseDto crew(
      long id, String mediaType, String job, double popularity) {
    return new TmdbPersonCrewCreditResponseDto(
        id, "Movie " + id, null, mediaType, null, "2016-11-10", null, job, popularity, 7.5, false);
  }
}
