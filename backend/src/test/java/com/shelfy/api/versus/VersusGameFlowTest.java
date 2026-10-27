package com.shelfy.api.versus;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.shelfy.api.auth.CollectionVisibility;
import com.shelfy.api.auth.JwtService;
import com.shelfy.api.auth.UserEntity;
import com.shelfy.api.auth.UserRepository;
import com.shelfy.api.collection.CanonicalWorkService;
import com.shelfy.api.collection.ExternalMediaReference;
import com.shelfy.api.collection.MediaEntity;
import com.shelfy.api.collection.MediaRepository;
import com.shelfy.api.collection.MediaType;
import com.shelfy.api.follows.FollowEntity;
import com.shelfy.api.follows.FollowRepository;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class VersusGameFlowTest {

  @Autowired private MockMvc mockMvc;
  @Autowired private JwtService jwtService;
  @Autowired private UserRepository users;
  @Autowired private VersusPoolRepository pools;
  @Autowired private MediaRepository media;
  @Autowired private CanonicalWorkService canonicalWorks;
  @Autowired private FollowRepository follows;
  @Autowired private ObjectMapper json;

  @Test
  void undo_takesBackThePickInTheCurrentRound() throws Exception {
    UserEntity player = user();
    JsonNode session = start(player, pool(player, CollectionVisibility.PUBLIC));
    JsonNode afterPick = pickA(player, session);
    assertThat(afterPick.at("/currentMatch/slotIndex").asInt()).isEqualTo(1);

    JsonNode undone = undo(player, session);

    assertThat(undone.at("/currentRound").asInt()).isEqualTo(1);
    assertThat(undone.at("/currentMatch/slotIndex").asInt()).isZero();
  }

  @Test
  void undo_stepsBackIntoThePreviousRound() throws Exception {
    UserEntity player = user();
    JsonNode session = start(player, pool(player, CollectionVisibility.PUBLIC));
    pickA(player, session);
    JsonNode semiDone = pickA(player, session);
    assertThat(semiDone.at("/currentRound").asInt()).isEqualTo(2);

    JsonNode undone = undo(player, session);

    assertThat(undone.at("/currentRound").asInt()).isEqualTo(1);
    assertThat(undone.at("/currentMatch/slotIndex").asInt()).isEqualTo(1);
  }

  @Test
  void undo_reopensAFinishedGame() throws Exception {
    UserEntity player = user();
    JsonNode session = start(player, pool(player, CollectionVisibility.PUBLIC));
    pickA(player, session);
    pickA(player, session);
    JsonNode finished = pickA(player, session);
    assertThat(finished.at("/status").asText()).isEqualToIgnoringCase("completed");

    JsonNode undone = undo(player, session);

    assertThat(undone.at("/status").asText()).isEqualToIgnoringCase("in_progress");
    assertThat(undone.at("/currentRound").asInt()).isEqualTo(2);
    assertThat(undone.at("/winnerEntry").isNull()).isTrue();
  }

  @Test
  void undo_withNothingPicked_isAConflict() throws Exception {
    UserEntity player = user();
    JsonNode session = start(player, pool(player, CollectionVisibility.PUBLIC));

    mockMvc
        .perform(
            post("/api/v1/versus/sessions/{id}/undo", session.at("/sessionId").asText())
                .header("Authorization", token(player)))
        .andExpect(status().isConflict());
  }

  @Test
  void current_returnsTheUnfinishedGameOnThePool() throws Exception {
    UserEntity player = user();
    VersusPoolEntity pool = pool(player, CollectionVisibility.PUBLIC);

    mockMvc
        .perform(
            get("/api/v1/versus/sessions/current")
                .param("poolId", pool.getId().toString())
                .header("Authorization", token(player)))
        .andExpect(status().isNoContent());

    JsonNode session = start(player, pool);
    mockMvc
        .perform(
            get("/api/v1/versus/sessions/current")
                .param("poolId", pool.getId().toString())
                .header("Authorization", token(player)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.sessionId").value(session.at("/sessionId").asText()));
  }

  @Test
  void result_showsThePodiumToAnyoneWhoCanSeeThePool() throws Exception {
    UserEntity player = user();
    JsonNode session = start(player, pool(player, CollectionVisibility.PUBLIC));
    pickA(player, session);
    pickA(player, session);
    pickA(player, session);

    mockMvc
        .perform(get("/api/v1/versus/sessions/{id}/result", session.at("/sessionId").asText()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.player.username").value(player.getUsername()))
        .andExpect(jsonPath("$.entryCount").value(4))
        .andExpect(jsonPath("$.podium[0].place").value(1))
        .andExpect(jsonPath("$.podium[1].place").value(2))
        .andExpect(jsonPath("$.podium[2].place").value(3))
        .andExpect(jsonPath("$.podium[3].place").value(3))
        .andExpect(jsonPath("$.agreement").value(100))
        .andExpect(jsonPath("$.communitySessionCount").value(1));
  }

  @Test
  void result_ofAnUnfinishedGame_isAConflict() throws Exception {
    UserEntity player = user();
    JsonNode session = start(player, pool(player, CollectionVisibility.PUBLIC));

    mockMvc
        .perform(
            get("/api/v1/versus/sessions/{id}/result", session.at("/sessionId").asText())
                .header("Authorization", token(player)))
        .andExpect(status().isConflict());
  }

  @Test
  void result_onAPrivatePool_isHiddenFromStrangers() throws Exception {
    UserEntity player = user();
    JsonNode session = start(player, pool(player, CollectionVisibility.PRIVATE));
    pickA(player, session);
    pickA(player, session);
    pickA(player, session);

    mockMvc
        .perform(
            get("/api/v1/versus/sessions/{id}/result", session.at("/sessionId").asText())
                .header("Authorization", token(user())))
        .andExpect(status().isNotFound());
  }

  @Test
  void friends_listsTheLatestFinishedGameOfEachFriend() throws Exception {
    UserEntity player = user();
    UserEntity friend = user();
    UserEntity stranger = user();
    follow(player, friend);
    VersusPoolEntity pool = pool(player, CollectionVisibility.PUBLIC);
    for (UserEntity someone : new UserEntity[] {friend, stranger}) {
      JsonNode session = start(someone, pool);
      pickA(someone, session);
      pickA(someone, session);
      pickA(someone, session);
    }

    mockMvc
        .perform(
            get("/api/v1/versus/sessions/following")
                .param("poolId", pool.getId().toString())
                .header("Authorization", token(player)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.length()").value(1))
        .andExpect(jsonPath("$[0].player.username").value(friend.getUsername()))
        .andExpect(jsonPath("$[0].winner.id").exists());
  }

  private JsonNode start(UserEntity player, VersusPoolEntity pool) throws Exception {
    return read(
        mockMvc
            .perform(
                post("/api/v1/versus/sessions")
                    .header("Authorization", token(player))
                    .contentType(org.springframework.http.MediaType.APPLICATION_JSON)
                    .content("{\"poolId\":\"" + pool.getId() + "\"}"))
            .andExpect(status().isCreated())
            .andReturn()
            .getResponse()
            .getContentAsString());
  }

  private JsonNode pickA(UserEntity player, JsonNode session) throws Exception {
    String id = session.at("/sessionId").asText();
    JsonNode current =
        read(
            mockMvc
                .perform(
                    get("/api/v1/versus/sessions/{id}", id).header("Authorization", token(player)))
                .andReturn()
                .getResponse()
                .getContentAsString());
    String winner = current.at("/currentMatch/entryA/id").asText();
    return read(
        mockMvc
            .perform(
                post("/api/v1/versus/sessions/{id}/picks", id)
                    .header("Authorization", token(player))
                    .contentType(org.springframework.http.MediaType.APPLICATION_JSON)
                    .content("{\"winnerEntryId\":\"" + winner + "\"}"))
            .andExpect(status().isOk())
            .andReturn()
            .getResponse()
            .getContentAsString());
  }

  private JsonNode undo(UserEntity player, JsonNode session) throws Exception {
    return read(
        mockMvc
            .perform(
                post("/api/v1/versus/sessions/{id}/undo", session.at("/sessionId").asText())
                    .header("Authorization", token(player)))
            .andExpect(status().isOk())
            .andReturn()
            .getResponse()
            .getContentAsString());
  }

  private JsonNode read(String body) throws Exception {
    return json.readTree(body);
  }

  private VersusPoolEntity pool(UserEntity owner, CollectionVisibility visibility) {
    VersusPoolEntity pool = new VersusPoolEntity(owner.getId(), "Best four", null, visibility);
    for (int i = 0; i < 4; i++) {
      pool.appendItem(movie());
    }
    return pools.saveAndFlush(pool);
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

  private void follow(UserEntity follower, UserEntity followed) {
    follows.saveAndFlush(new FollowEntity(follower.getId(), followed.getId()));
  }

  private String token(UserEntity user) {
    return "Bearer " + jwtService.generateAccessToken(user);
  }

  private UserEntity user() {
    String name = "u" + UUID.randomUUID().toString().substring(0, 12);
    return users.saveAndFlush(new UserEntity(name + "@example.com", name, "hash"));
  }
}
