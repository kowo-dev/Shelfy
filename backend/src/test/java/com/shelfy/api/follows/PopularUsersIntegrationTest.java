package com.shelfy.api.follows;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import com.shelfy.api.activity.ActivityType;
import com.shelfy.api.activity.UserActivityEntity;
import com.shelfy.api.activity.UserActivityRepository;
import com.shelfy.api.auth.CollectionVisibility;
import com.shelfy.api.auth.JwtService;
import com.shelfy.api.auth.UserEntity;
import com.shelfy.api.auth.UserRepository;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
class PopularUsersIntegrationTest {

  @Autowired private MockMvc mockMvc;
  @Autowired private JwtService jwtService;
  @Autowired private UserRepository users;
  @Autowired private FollowRepository follows;
  @Autowired private UserActivityRepository activity;

  @Test
  void popular_ranksActivePublicAccountsTheViewerDoesNotFollowYet() throws Exception {
    UserEntity viewer = user(true);
    UserEntity star = user(true);
    UserEntity rising = user(true);
    UserEntity alreadyFollowed = user(true);
    UserEntity inactive = user(false);
    UserEntity hidden = user(true);
    hidden.setProfileVisibility(CollectionVisibility.PRIVATE);
    users.saveAndFlush(hidden);

    follow(user(false), star);
    follow(user(false), star);
    follow(user(false), rising);
    follow(viewer, alreadyFollowed);
    follow(user(false), inactive);

    String body =
        mockMvc
            .perform(
                get("/api/v1/follows/popular")
                    .param("size", "100")
                    .header("Authorization", "Bearer " + jwtService.generateAccessToken(viewer)))
            .andExpect(status().isOk())
            .andReturn()
            .getResponse()
            .getContentAsString();

    List<String> ids = JsonPath.read(body, "$.content[*].id");
    List<String> ours =
        ids.stream()
            .filter(
                id ->
                    List.of(
                            viewer.getId().toString(),
                            star.getId().toString(),
                            rising.getId().toString(),
                            alreadyFollowed.getId().toString(),
                            inactive.getId().toString(),
                            hidden.getId().toString())
                        .contains(id))
            .toList();
    assertThat(ours).containsExactly(star.getId().toString(), rising.getId().toString());
    List<Integer> counts =
        JsonPath.read(body, "$.content[?(@.id == '" + star.getId() + "')].followersCount");
    assertThat(counts).containsExactly(2);
  }

  private void follow(UserEntity follower, UserEntity followed) {
    follows.saveAndFlush(new FollowEntity(follower.getId(), followed.getId()));
  }

  private UserEntity user(boolean active) {
    String name = "p" + UUID.randomUUID().toString().substring(0, 12);
    UserEntity user = new UserEntity(name + "@example.com", name, "hash");
    user.setEmailVerified(true);
    UserEntity saved = users.saveAndFlush(user);
    if (active) {
      activity.saveAndFlush(
          new UserActivityEntity(saved.getId(), null, ActivityType.COMMENTED, Map.of()));
    }
    return saved;
  }
}
