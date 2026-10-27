package com.shelfy.api;

import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import com.shelfy.api.auth.JwtService;
import com.shelfy.api.auth.UserEntity;
import com.shelfy.api.auth.UserRepository;
import com.shelfy.api.collection.CanonicalWorkService;
import com.shelfy.api.collection.ExternalMediaReference;
import com.shelfy.api.collection.MediaEntity;
import com.shelfy.api.collection.MediaRepository;
import com.shelfy.api.collection.MediaType;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

@SpringBootTest
@AutoConfigureMockMvc
class ReadPathsIntegrationTest {

  private static final String NOTE =
      """
      {"note": {"type": "doc", "content": [{"type": "paragraph",
        "content": [{"type": "text", "text": "Loved it"}]}]}, "rating": 8}
      """;

  @Autowired private MockMvc mockMvc;
  @Autowired private JwtService jwtService;
  @Autowired private UserRepository users;
  @Autowired private MediaRepository media;
  @Autowired private CanonicalWorkService canonicalWorks;

  @Test
  void mainReadPaths_answerWithoutLazyLoadingErrors() throws Exception {
    UserEntity author = user();
    UserEntity viewer = user();
    List<String> movieIds = new ArrayList<>();
    for (int i = 0; i < 4; i++) {
      movieIds.add(movie().getExternalId());
    }

    List<String> itemIds = new ArrayList<>();
    for (String movieId : movieIds) {
      itemIds.add(
          id(
              send(
                  author,
                  post("/api/v1/collection")
                      .content(
                          """
                          {"externalId": "%s", "provider": "tmdb", "mediaType": "movie",
                           "status": "done"}
                          """
                              .formatted(movieId)))));
    }
    send(author, put("/api/v1/collection/{id}", itemIds.get(0)).content(NOTE));
    String listId =
        id(
            send(
                author,
                post("/api/v1/lists")
                    .content(
                        """
                        {"name": "Favourites", "visibility": "public", "tags": ["best"],
                         "media": [%s]}
                        """
                            .formatted(references(movieIds.subList(0, 2))))));
    send(author, post("/api/v1/lists/{id}/comments", listId).content("{\"content\": \"Nice\"}"));
    String poolId =
        id(
            send(
                author,
                post("/api/v1/versus/pools")
                    .content("{\"name\": \"Duel\", \"visibility\": \"public\"}")));
    send(
        author,
        post("/api/v1/versus/pools/{id}/items/batch", poolId)
            .content("{\"items\": [%s]}".formatted(references(movieIds))));
    String sessionId =
        JsonPath.read(
            send(
                author,
                post("/api/v1/versus/sessions").content("{\"poolId\": \"%s\"}".formatted(poolId))),
            "$.sessionId");

    String name = author.getUsername();
    for (MockHttpServletRequestBuilder request :
        List.of(
            get("/api/v1/users/{u}/profile", name),
            get("/api/v1/users/{u}/collection", name),
            get("/api/v1/users/{u}/collection/stats", name),
            get("/api/v1/users/{u}/essentials", name),
            get("/api/v1/users/{u}/reviews", name),
            get("/api/v1/users/{u}/activity", name),
            get("/api/v1/users/reviews"),
            get("/api/v1/users/reviews/{id}", itemIds.get(0)),
            get("/api/v1/users/reviews/{id}/watch-log", itemIds.get(0)),
            get("/api/v1/users/reviews/media")
                .param("provider", "tmdb")
                .param("mediaType", "movie")
                .param("externalId", movieIds.get(0)),
            get("/api/v1/lists"),
            get("/api/v1/lists/{id}", listId),
            get("/api/v1/lists/profile/{u}", name),
            get("/api/v1/lists/{id}/comments", listId),
            get("/api/v1/versus/pools"),
            get("/api/v1/versus/pools/{id}", poolId))) {
      send(viewer, request);
    }
    send(viewer, post("/api/v1/users/reviews/{id}/likes", itemIds.get(0)));

    for (MockHttpServletRequestBuilder request :
        List.of(
            get("/api/v1/users/me"),
            get("/api/v1/users/me/export"),
            get("/api/v1/collection"),
            get("/api/v1/collection/stats"),
            get("/api/v1/collection/{id}", itemIds.get(0)),
            post("/api/v1/collection/lookup-batch")
                .content("{\"references\": [%s]}".formatted(references(movieIds))),
            get("/api/v1/versus/sessions/{id}", sessionId),
            get("/api/v1/versus/sessions/{id}/bracket", sessionId),
            delete("/api/v1/collection/{id}", itemIds.get(3)))) {
      send(author, request);
    }
  }

  private String send(UserEntity user, MockHttpServletRequestBuilder request) throws Exception {
    return mockMvc
        .perform(
            request
                .header("Authorization", "Bearer " + jwtService.generateAccessToken(user))
                .contentType(APPLICATION_JSON))
        .andExpect(status().is2xxSuccessful())
        .andReturn()
        .getResponse()
        .getContentAsString();
  }

  private static String id(String body) {
    return JsonPath.read(body, "$.id");
  }

  private static String references(List<String> movieIds) {
    return String.join(
        ",",
        movieIds.stream()
            .map(
                id ->
                    "{\"provider\": \"tmdb\", \"mediaType\": \"movie\", \"externalId\": \"%s\"}"
                        .formatted(id))
            .toList());
  }

  private UserEntity user() {
    String name = "u" + UUID.randomUUID().toString().substring(0, 12);
    UserEntity user = new UserEntity(name + "@example.com", name, "hash");
    user.setEmailVerified(true);
    return users.saveAndFlush(user);
  }

  private MediaEntity movie() {
    String externalId = String.valueOf(Math.abs(UUID.randomUUID().getMostSignificantBits()));
    return media.saveAndFlush(
        new MediaEntity(
            externalId,
            "tmdb",
            MediaType.MOVIE,
            canonicalWorks.resolve(
                MediaType.MOVIE, Set.of(new ExternalMediaReference("tmdb", externalId))),
            "Movie " + externalId,
            null,
            Map.of(),
            false));
  }
}
