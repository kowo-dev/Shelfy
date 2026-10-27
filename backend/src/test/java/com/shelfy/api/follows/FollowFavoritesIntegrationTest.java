package com.shelfy.api.follows;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import com.shelfy.api.auth.CollectionVisibility;
import com.shelfy.api.auth.JwtService;
import com.shelfy.api.auth.UserEntity;
import com.shelfy.api.auth.UserRepository;
import com.shelfy.api.lists.MediaListEntity;
import com.shelfy.api.lists.MediaListRepository;
import java.util.List;
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
class FollowFavoritesIntegrationTest {

  @Autowired private MockMvc mockMvc;
  @Autowired private JwtService jwtService;
  @Autowired private UserRepository users;
  @Autowired private MediaListRepository lists;

  @Test
  void favorites_comeFirstAndOnlyForPeopleTheViewerFollows() throws Exception {
    UserEntity viewer = user();
    UserEntity first = user();
    UserEntity second = user();
    UserEntity stranger = user();
    send(viewer, post("/api/v1/follows/" + second.getId()));
    send(viewer, post("/api/v1/follows/" + first.getId()));

    send(viewer, put("/api/v1/follows/" + second.getId() + "/favorite"));

    String following = send(viewer, get("/api/v1/follows/following"));
    assertThat(JsonPath.<List<String>>read(following, "$.content[*].id"))
        .containsExactly(second.getId().toString(), first.getId().toString());
    assertThat(JsonPath.<List<Boolean>>read(following, "$.content[*].isFavorite"))
        .containsExactly(true, false);
    assertThat(
            JsonPath.<List<String>>read(
                send(viewer, get("/api/v1/follows/favorites")), "$.content[*].id"))
        .containsExactly(second.getId().toString());
    mockMvc
        .perform(
            put("/api/v1/follows/" + stranger.getId() + "/favorite")
                .header("Authorization", "Bearer " + jwtService.generateAccessToken(viewer)))
        .andExpect(status().isNotFound());

    send(viewer, delete("/api/v1/follows/" + second.getId()));
    send(viewer, post("/api/v1/follows/" + second.getId()));
    assertThat(
            JsonPath.<List<String>>read(
                send(viewer, get("/api/v1/follows/favorites")), "$.content"))
        .isEmpty();
  }

  @Test
  void circle_listsFromFavoritesComeFirst() throws Exception {
    UserEntity viewer = user();
    UserEntity favorite = user();
    UserEntity other = user();
    send(viewer, post("/api/v1/follows/" + favorite.getId()));
    send(viewer, post("/api/v1/follows/" + other.getId()));
    UUID older = list(favorite);
    UUID newer = list(other);

    String before = send(viewer, get("/api/v1/lists").param("scope", "CIRCLE"));
    assertThat(JsonPath.<List<String>>read(before, "$.content[*].id"))
        .containsExactly(newer.toString(), older.toString());

    send(viewer, put("/api/v1/follows/" + favorite.getId() + "/favorite"));

    String after = send(viewer, get("/api/v1/lists").param("scope", "CIRCLE"));
    assertThat(JsonPath.<List<String>>read(after, "$.content[*].id"))
        .containsExactly(older.toString(), newer.toString());
    String everyone = send(viewer, get("/api/v1/lists").param("q", favorite.getUsername()));
    assertThat(JsonPath.<List<String>>read(everyone, "$.content[*].id"))
        .containsExactly(older.toString());
  }

  private String send(UserEntity user, MockHttpServletRequestBuilder request) throws Exception {
    return mockMvc
        .perform(request.header("Authorization", "Bearer " + jwtService.generateAccessToken(user)))
        .andExpect(status().is2xxSuccessful())
        .andReturn()
        .getResponse()
        .getContentAsString();
  }

  private UUID list(UserEntity owner) {
    return lists
        .saveAndFlush(
            new MediaListEntity(
                owner.getId(), "Picks", null, CollectionVisibility.PUBLIC, Set.of()))
        .getId();
  }

  private UserEntity user() {
    String name = "f" + UUID.randomUUID().toString().substring(0, 12);
    UserEntity user = new UserEntity(name + "@example.com", name, "hash");
    user.setEmailVerified(true);
    return users.saveAndFlush(user);
  }
}
