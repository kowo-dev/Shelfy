package com.shelfy.api.versus;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
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
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class VersusPoolLifecycleTest {

  @Autowired private MockMvc mockMvc;
  @Autowired private JwtService jwtService;
  @Autowired private UserRepository users;
  @Autowired private VersusPoolRepository pools;
  @Autowired private VersusPoolCollaboratorRepository collaborators;

  @Test
  void owner_deletesTheirPool() throws Exception {
    UserEntity owner = user();
    VersusPoolEntity pool = pool(owner, CollectionVisibility.PUBLIC);

    mockMvc
        .perform(
            delete("/api/v1/versus/pools/{id}", pool.getId()).header("Authorization", token(owner)))
        .andExpect(status().isNoContent());

    assertThat(pools.findById(pool.getId())).isEmpty();
  }

  @Test
  void someoneElse_cannotDeleteAPool() throws Exception {
    VersusPoolEntity pool = pool(user(), CollectionVisibility.PUBLIC);

    mockMvc
        .perform(
            delete("/api/v1/versus/pools/{id}", pool.getId())
                .header("Authorization", token(user())))
        .andExpect(status().isForbidden());
    assertThat(pools.findById(pool.getId())).isPresent();
  }

  @Test
  void duplicate_makesAPrivateCopyThatCreditsTheOriginal() throws Exception {
    UserEntity owner = user();
    UserEntity reader = user();
    VersusPoolEntity pool = pool(owner, CollectionVisibility.PUBLIC);

    mockMvc
        .perform(
            post("/api/v1/versus/pools/{id}/duplicate", pool.getId())
                .header("Authorization", token(reader))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"My bracket\"}"))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.name").value("My bracket"))
        .andExpect(jsonPath("$.userId").value(reader.getId().toString()))
        .andExpect(jsonPath("$.visibility").value("private"))
        .andExpect(jsonPath("$.isOwner").value(true))
        .andExpect(jsonPath("$.source.id").value(pool.getId().toString()))
        .andExpect(jsonPath("$.source.creatorUsername").value(owner.getUsername()));
  }

  @Test
  void duplicate_ofAPoolTheViewerCannotSee_isNotFound() throws Exception {
    VersusPoolEntity hidden = pool(user(), CollectionVisibility.PRIVATE);

    mockMvc
        .perform(
            post("/api/v1/versus/pools/{id}/duplicate", hidden.getId())
                .header("Authorization", token(user())))
        .andExpect(status().isNotFound());
  }

  @Test
  void acceptedCoAuthor_seesAPrivatePoolAndCanEditItsEntries() throws Exception {
    UserEntity owner = user();
    UserEntity coAuthor = user();
    VersusPoolEntity hidden = pool(owner, CollectionVisibility.PRIVATE);
    collaborators.saveAndFlush(
        new VersusPoolCollaboratorEntity(hidden, coAuthor.getId(), owner.getId()));

    mockMvc
        .perform(
            get("/api/v1/versus/pools/{id}", hidden.getId())
                .header("Authorization", token(coAuthor)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.canEdit").value(false))
        .andExpect(jsonPath("$.viewerCollaboratorStatus").value("PENDING"));

    mockMvc
        .perform(
            put("/api/v1/versus/pools/{id}/collaborators/accept", hidden.getId())
                .header("Authorization", token(coAuthor)))
        .andExpect(status().isOk());

    mockMvc
        .perform(
            get("/api/v1/versus/pools/{id}", hidden.getId())
                .header("Authorization", token(coAuthor)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.canEdit").value(true))
        .andExpect(jsonPath("$.isOwner").value(false))
        .andExpect(jsonPath("$.collaborators[0].username").value(coAuthor.getUsername()));
  }

  @Test
  void stranger_cannotSeeAPrivatePool() throws Exception {
    VersusPoolEntity hidden = pool(user(), CollectionVisibility.PRIVATE);

    mockMvc
        .perform(
            get("/api/v1/versus/pools/{id}", hidden.getId()).header("Authorization", token(user())))
        .andExpect(status().isNotFound());
  }

  @Test
  void publishing_aPoolWithFewerThanFourContenders_isRefused() throws Exception {
    UserEntity owner = user();
    VersusPoolEntity draft = pool(owner, CollectionVisibility.PRIVATE);

    mockMvc
        .perform(
            put("/api/v1/versus/pools/{id}", draft.getId())
                .header("Authorization", token(owner))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"Best duels\",\"visibility\":\"public\"}"))
        .andExpect(status().isBadRequest());

    mockMvc
        .perform(
            put("/api/v1/versus/pools/{id}", draft.getId())
                .header("Authorization", token(owner))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"Renamed draft\",\"visibility\":\"private\"}"))
        .andExpect(status().isOk());
  }

  private VersusPoolEntity pool(UserEntity owner, CollectionVisibility visibility) {
    return pools.saveAndFlush(new VersusPoolEntity(owner.getId(), "Best duels", null, visibility));
  }

  private String token(UserEntity user) {
    return "Bearer " + jwtService.generateAccessToken(user);
  }

  private UserEntity user() {
    String name = "u" + UUID.randomUUID().toString().substring(0, 12);
    return users.saveAndFlush(new UserEntity(name + "@example.com", name, "hash"));
  }
}
