package com.shelfy.api.federation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.shelfy.api.auth.JwtService;
import com.shelfy.api.auth.UserEntity;
import com.shelfy.api.auth.UserRepository;
import com.shelfy.api.follows.FollowRepository;
import java.io.IOException;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.UUID;
import java.util.function.Function;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

@SpringBootTest(
    properties = {
      "app.federation.enabled=true",
      "app.federation.handle-domain=shelfy.test",
      "app.federation.server-url=http://localhost",
      "app.federation.dev-mode=true"
    })
@AutoConfigureMockMvc
class AccountMigrationIntegrationTest {

  @Autowired private MockMvc mockMvc;
  @Autowired private JwtService jwtService;
  @Autowired private UserRepository users;
  @Autowired private FollowRepository follows;
  @Autowired private ActorStore actorStore;
  @Autowired private DeliveryService deliveryService;
  @Autowired private RemoteActorService remoteActors;
  @Autowired private JdbcClient jdbcClient;
  @MockitoBean private FederationJobs federationJobs;

  private RemoteStub oldAccount;
  private RemoteStub newAccount;
  private UserEntity local;

  @BeforeEach
  void setUp() throws IOException {
    jdbcClient.sql("delete from ap_deliveries").update();
    Function<String, String> keys =
        keyId ->
            actorStore
                .localKey(
                    UUID.fromString(
                        keyId.replace("http://localhost/ap/users/", "").replace("#main-key", "")))
                .publicPem();
    oldAccount = new RemoteStub(keys);
    newAccount = new RemoteStub(keys);
    String name = "u" + UUID.randomUUID().toString().substring(0, 12);
    UserEntity user = new UserEntity(name + "@example.com", name, "hash");
    user.setEmailVerified(true);
    local = users.saveAndFlush(user);
  }

  @AfterEach
  void tearDown() {
    oldAccount.close();
    newAccount.close();
  }

  @Test
  void followersOfAMovedAccountFollowTheNewOne() throws Exception {
    UserEntity old = remoteActors.resolveHandle(oldAccount.handle());
    jdbcClient
        .sql("insert into follows (follower_id, followed_id) values (:follower, :followed)")
        .param("follower", local.getId())
        .param("followed", old.getId())
        .update();
    newAccount.alsoKnownAs = oldAccount.actorUri();

    inbox(move(oldAccount.actorUri(), newAccount.actorUri())).andExpect(status().isAccepted());

    UserEntity current = remoteActors.resolveHandle(newAccount.handle());
    assertThat(follows.existsByFollowerIdAndFollowedId(local.getId(), old.getId())).isFalse();
    assertThat(
            jdbcClient
                .sql(
                    "select count(*) from ap_follow_requests where follower_id = :f and followed_id = :t")
                .param("f", local.getId())
                .param("t", current.getId())
                .query(Long.class)
                .single())
        .isEqualTo(1);
    deliveryService.deliverDue();
    assertThat(newAccount.inbox.getFirst().body().path("type").asString()).isEqualTo("Follow");
    assertThat(oldAccount.inbox.getFirst().body().path("type").asString()).isEqualTo("Undo");
  }

  @Test
  void aMoveToAnAccountThatDoesNotListTheOldOneIsIgnored() throws Exception {
    UserEntity old = remoteActors.resolveHandle(oldAccount.handle());
    jdbcClient
        .sql("insert into follows (follower_id, followed_id) values (:follower, :followed)")
        .param("follower", local.getId())
        .param("followed", old.getId())
        .update();

    inbox(move(oldAccount.actorUri(), newAccount.actorUri())).andExpect(status().isAccepted());

    assertThat(follows.existsByFollowerIdAndFollowedId(local.getId(), old.getId())).isTrue();
    deliveryService.deliverDue();
    assertThat(newAccount.inbox).isEmpty();
  }

  @Test
  void aLocalAccountCanMoveAndTellItsFollowers() throws Exception {
    inbox(
            """
            {"id": "%1$s/follows/1", "type": "Follow", "actor": "%1$s", "object": "%2$s"}
            """
                .formatted(oldAccount.actorUri(), localActor()))
        .andExpect(status().isAccepted());

    send(post("/api/v1/federation/migration/move")
            .content("{\"handle\": \"%s\"}".formatted(newAccount.handle())))
        .andExpect(status().isBadRequest());

    newAccount.alsoKnownAs = localActor();
    send(post("/api/v1/federation/migration/move")
            .content("{\"handle\": \"%s\"}".formatted(newAccount.handle())))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.movedTo").value(newAccount.actorUri()));

    mockMvc
        .perform(get("/ap/users/{id}", local.getId()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.movedTo").value(newAccount.actorUri()));
    deliveryService.deliverDue();
    assertThat(oldAccount.inbox.stream().map(received -> received.body().path("type").asString()))
        .contains("Move");
    send(post("/api/v1/federation/migration/move")
            .content("{\"handle\": \"%s\"}".formatted(newAccount.handle())))
        .andExpect(status().isConflict());
  }

  @Test
  void anAliasIsPublishedAsAlsoKnownAs() throws Exception {
    send(put("/api/v1/federation/migration/alias")
            .content("{\"handle\": \"%s\"}".formatted(oldAccount.handle())))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.alias").value(oldAccount.actorUri()));

    mockMvc
        .perform(get("/ap/users/{id}", local.getId()))
        .andExpect(jsonPath("$.alsoKnownAs[0]").value(oldAccount.actorUri()));
  }

  private String move(String actor, String target) {
    return """
        {"@context": "https://www.w3.org/ns/activitystreams",
         "id": "%1$s/moves/1", "type": "Move", "actor": "%1$s", "object": "%1$s", "target": "%2$s"}
        """
        .formatted(actor, target);
  }

  private String localActor() {
    return "http://localhost/ap/users/" + local.getId();
  }

  private ResultActions send(MockHttpServletRequestBuilder request) throws Exception {
    return mockMvc.perform(
        request
            .header("Authorization", "Bearer " + jwtService.generateAccessToken(local))
            .contentType(APPLICATION_JSON));
  }

  private ResultActions inbox(String activity) throws Exception {
    byte[] body = activity.getBytes(StandardCharsets.UTF_8);
    String path = "/ap/users/" + local.getId() + "/inbox";
    MockHttpServletRequestBuilder request =
        post(path)
            .header("Host", "localhost")
            .contentType("application/activity+json")
            .content(body);
    oldAccount.sign(URI.create("http://localhost" + path), body).forEach(request::header);
    return mockMvc.perform(request);
  }
}
