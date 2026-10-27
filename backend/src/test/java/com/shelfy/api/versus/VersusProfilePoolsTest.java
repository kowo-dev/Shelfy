package com.shelfy.api.versus;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.shelfy.api.auth.CollectionVisibility;
import com.shelfy.api.auth.JwtService;
import com.shelfy.api.auth.UserEntity;
import com.shelfy.api.auth.UserRepository;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class VersusProfilePoolsTest {

  @Autowired private MockMvc mockMvc;
  @Autowired private JwtService jwtService;
  @Autowired private UserRepository users;
  @Autowired private VersusPoolRepository pools;

  @Test
  void anonymousViewerSeesOnlyThePublicPoolsOfAPublicProfile() throws Exception {
    UserEntity owner = user();
    pool(owner, "Open duels", CollectionVisibility.PUBLIC);
    pool(owner, "Secret duels", CollectionVisibility.PRIVATE);
    pool(user(), "Someone else", CollectionVisibility.PUBLIC);

    mockMvc
        .perform(get("/api/v1/versus/pools/profile/{username}", owner.getUsername()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.totalElements").value(1))
        .andExpect(jsonPath("$.size").value(50))
        .andExpect(jsonPath("$.content[0].name").value("Open duels"))
        .andExpect(jsonPath("$.content[0].creatorUsername").value(owner.getUsername()));
  }

  @Test
  void ownerSeesTheirPrivatePoolsAndPagingIsHonoured() throws Exception {
    UserEntity owner = user();
    pool(owner, "One", CollectionVisibility.PUBLIC);
    pool(owner, "Two", CollectionVisibility.PRIVATE);
    String token = "Bearer " + jwtService.generateAccessToken(owner);

    mockMvc
        .perform(
            get("/api/v1/versus/pools/profile/{username}", owner.getUsername())
                .param("size", "1")
                .header("Authorization", token))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.totalElements").value(2))
        .andExpect(jsonPath("$.content.length()").value(1));
  }

  @Test
  void qNarrowsThePoolsByName() throws Exception {
    UserEntity owner = user();
    pool(owner, "Best Pixar", CollectionVisibility.PUBLIC);
    pool(owner, "Worst sequels", CollectionVisibility.PUBLIC);

    mockMvc
        .perform(
            get("/api/v1/versus/pools/profile/{username}", owner.getUsername()).param("q", "pixar"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.totalElements").value(1))
        .andExpect(jsonPath("$.content[0].name").value("Best Pixar"));
  }

  @Test
  void privateProfileAnswers403AndUnknownUserAnswers404() throws Exception {
    UserEntity hiddenOwner = user();
    hiddenOwner.setProfileVisibility(CollectionVisibility.PRIVATE);
    users.saveAndFlush(hiddenOwner);
    pool(hiddenOwner, "Hidden", CollectionVisibility.PUBLIC);

    mockMvc
        .perform(get("/api/v1/versus/pools/profile/{username}", hiddenOwner.getUsername()))
        .andExpect(status().isForbidden())
        .andExpect(jsonPath("$.code").value("PROFILE_PRIVATE"));
    mockMvc
        .perform(get("/api/v1/versus/pools/profile/{username}", "nobody" + UUID.randomUUID()))
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.code").value("USER_NOT_FOUND"));
  }

  private void pool(UserEntity owner, String name, CollectionVisibility visibility) {
    pools.saveAndFlush(new VersusPoolEntity(owner.getId(), name, null, visibility));
  }

  private UserEntity user() {
    String name = "u" + UUID.randomUUID().toString().substring(0, 12);
    return users.saveAndFlush(new UserEntity(name + "@example.com", name, "hash"));
  }
}
