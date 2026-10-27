package com.shelfy.api.tmdb.client;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.springframework.test.web.client.ExpectedCount.once;
import static org.springframework.test.web.client.ExpectedCount.times;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import com.shelfy.api.common.exception.ApiException;
import com.shelfy.api.common.exception.ErrorCode;
import com.shelfy.api.common.exception.ResourceNotFoundException;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

class TmdbClientTest {

  private final RestClient.Builder builder =
      RestClient.builder().baseUrl("https://api.themoviedb.org/3");
  private final MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
  private final TmdbClient client = new TmdbClient(builder.build());

  @Test
  void getMovie_whenNotFound_throwsResourceNotFoundWithTmdbErrorCode() {
    server
        .expect(
            requestTo(
                "https://api.themoviedb.org/3/movie/999?append_to_response=credits,images,videos&include_image_language=null"))
        .andRespond(withStatus(HttpStatus.NOT_FOUND));

    ResourceNotFoundException exception =
        assertThrows(ResourceNotFoundException.class, () -> client.fetchMovie(999));
    assertEquals(ErrorCode.TMDB_RESOURCE_NOT_FOUND, exception.getCode());
  }

  @Test
  void getMovie_whenUpstreamKeepsFailing_retriesOnceThenThrowsBadGateway() {
    server
        .expect(
            times(2),
            requestTo(
                "https://api.themoviedb.org/3/movie/1?append_to_response=credits,images,videos&include_image_language=null"))
        .andRespond(withStatus(HttpStatus.INTERNAL_SERVER_ERROR));

    ApiException exception = assertThrows(ApiException.class, () -> client.fetchMovie(1));
    assertEquals(HttpStatus.BAD_GATEWAY, exception.getStatus());
    assertEquals(ErrorCode.TMDB_PROVIDER_UNAVAILABLE, exception.getCode());
    server.verify();
  }

  @Test
  void getMovie_whenUpstreamFailsOnce_returnsTheRetriedResponse() {
    server
        .expect(
            requestTo(
                "https://api.themoviedb.org/3/movie/1?append_to_response=credits,images,videos&include_image_language=null"))
        .andRespond(withStatus(HttpStatus.SERVICE_UNAVAILABLE));
    server
        .expect(
            requestTo(
                "https://api.themoviedb.org/3/movie/1?append_to_response=credits,images,videos&include_image_language=null"))
        .andRespond(
            withSuccess(
                "{\"id\": 1, \"title\": \"Alien\", \"adult\": false}", MediaType.APPLICATION_JSON));

    assertEquals("Alien", client.fetchMovie(1).title());
  }

  @Test
  void getMovie_whenRequestIsRejected_doesNotRetry() {
    server
        .expect(
            once(),
            requestTo(
                "https://api.themoviedb.org/3/movie/1?append_to_response=credits,images,videos&include_image_language=null"))
        .andRespond(withStatus(HttpStatus.UNAUTHORIZED));

    assertThrows(ApiException.class, () -> client.fetchMovie(1));
    server.verify();
  }

  @Test
  void discoverMovies_combinesCriteriaBeforePagination() {
    server
        .expect(
            requestTo(
                "https://api.themoviedb.org/3/discover/movie?page=2&include_adult=false"
                    + "&sort_by=vote_average.desc&with_genres=878,12&without_genres=27"
                    + "&with_keywords=4379&with_watch_providers=8%7C119&watch_region=FR"
                    + "&with_watch_monetization_types=flatrate%7Cfree%7Cads"
                    + "&vote_count.gte=3000"
                    + "&primary_release_date.gte=2010-01-01&primary_release_date.lte=2019-12-31"))
        .andRespond(
            withSuccess(
                "{\"results\":[],\"page\":2,\"totalPages\":3,\"totalResults\":60}",
                MediaType.APPLICATION_JSON));
    TmdbDiscoverQuery query =
        new TmdbDiscoverQuery(
            List.of(878, 12),
            List.of(27),
            List.of(4379),
            List.of(),
            List.of(8, 119),
            "FR",
            LocalDate.of(2010, 1, 1),
            LocalDate.of(2019, 12, 31),
            TmdbDiscoverQuery.Sort.RATING,
            2,
            false);

    assertEquals(3, client.discoverMovies(query).totalPages());
    server.verify();
  }
}
