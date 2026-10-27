package com.shelfy.api.federation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.shelfy.api.auth.UserEntity;
import com.shelfy.api.auth.UserRepository;
import com.shelfy.api.follows.FollowRepository;
import com.shelfy.api.follows.FollowService;
import java.io.IOException;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.UUID;
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
class FederatedFollowsIntegrationTest {

  @Autowired private MockMvc mockMvc;
  @Autowired private UserRepository users;
  @Autowired private FollowRepository follows;
  @Autowired private FollowService followService;
  @Autowired private ActorStore actorStore;
  @Autowired private DeliveryService deliveryService;
  @Autowired private RemoteActorService remoteActors;
  @Autowired private JdbcClient jdbcClient;
  @MockitoBean private FederationJobs federationJobs;

  private RemoteStub remote;
  private UserEntity local;

  @BeforeEach
  void setUp() throws IOException {
    jdbcClient.sql("delete from ap_deliveries").update();
    remote =
        new RemoteStub(
            keyId ->
                actorStore
                    .localKey(
                        UUID.fromString(
                            keyId
                                .replace("http://localhost/ap/users/", "")
                                .replace("#main-key", "")))
                    .publicPem());
    String name = "u" + UUID.randomUUID().toString().substring(0, 12);
    UserEntity user = new UserEntity(name + "@example.com", name, "hash");
    user.setEmailVerified(true);
    local = users.saveAndFlush(user);
  }

  @AfterEach
  void tearDown() {
    remote.close();
  }

  @Test
  void remoteFollowIsAcceptedAndUndone() throws Exception {
    String followId = remote.actorUri() + "/follows/1";
    inbox(follow(followId)).andExpect(status().isAccepted());

    UserEntity follower = users.findByUsernameIgnoreCase(remote.handle()).orElseThrow();
    assertThat(follows.existsByFollowerIdAndFollowedId(follower.getId(), local.getId())).isTrue();
    assertThat(follower.getAvatarFilename()).isNotNull();

    deliveryService.deliverDue();
    assertThat(remote.inbox).hasSize(1);
    RemoteStub.Received accept = remote.inbox.getFirst();
    assertThat(accept.signatureCheck()).isEqualTo("valid");
    assertThat(accept.body().path("type").asString()).isEqualTo("Accept");
    assertThat(accept.body().path("object").path("id").asString()).isEqualTo(followId);

    inbox(
            """
            {"id": "%1$s/undo/1", "type": "Undo", "actor": "%1$s",
             "object": {"id": "%2$s", "type": "Follow", "actor": "%1$s", "object": "%3$s"}}
            """
                .formatted(remote.actorUri(), followId, localActor()))
        .andExpect(status().isAccepted());
    assertThat(follows.existsByFollowerIdAndFollowedId(follower.getId(), local.getId())).isFalse();
  }

  @Test
  void accountsThatOptedOutAreHiddenAndRejectFollows() throws Exception {
    local.setFederationOptOut(true);
    users.saveAndFlush(local);

    mockMvc
        .perform(get("/ap/users/{id}", local.getId()).accept("application/activity+json"))
        .andExpect(status().isNotFound());
    mockMvc
        .perform(
            get("/.well-known/webfinger")
                .param("resource", "acct:" + local.getUsername() + "@shelfy.test"))
        .andExpect(status().isNotFound());

    inbox(follow(remote.actorUri() + "/follows/optout")).andExpect(status().isAccepted());
    deliveryService.deliverDue();

    assertThat(remote.inbox.getFirst().body().path("type").asString()).isEqualTo("Reject");
    UserEntity follower = users.findByUsernameIgnoreCase(remote.handle()).orElseThrow();
    assertThat(follows.existsByFollowerIdAndFollowedId(follower.getId(), local.getId())).isFalse();
  }

  @Test
  void localFollowWaitsForAccept() throws Exception {
    UserEntity target = remoteActors.resolveHandle(remote.handle());

    followService.follow(local.getId(), target.getId());
    assertThat(followService.isFollowing(local.getId(), target.getId())).isTrue();
    assertThat(follows.existsByFollowerIdAndFollowedId(local.getId(), target.getId())).isFalse();

    deliveryService.deliverDue();
    RemoteStub.Received follow = remote.inbox.getFirst();
    assertThat(follow.signatureCheck()).isEqualTo("valid");
    assertThat(follow.body().path("type").asString()).isEqualTo("Follow");
    assertThat(follow.body().path("object").asString()).isEqualTo(remote.actorUri());

    inbox(
            """
            {"id": "%1$s/accepts/1", "type": "Accept", "actor": "%1$s", "object": "%2$s"}
            """
                .formatted(remote.actorUri(), follow.body().path("id").asString()))
        .andExpect(status().isAccepted());
    assertThat(follows.existsByFollowerIdAndFollowedId(local.getId(), target.getId())).isTrue();

    followService.unfollow(local.getId(), target.getId());
    deliveryService.deliverDue();
    RemoteStub.Received undo = remote.inbox.getLast();
    assertThat(undo.body().path("type").asString()).isEqualTo("Undo");
    assertThat(undo.body().path("object").path("id").asString())
        .isEqualTo(follow.body().path("id").asString());
    assertThat(followService.isFollowing(local.getId(), target.getId())).isFalse();
  }

  @Test
  void unsignedOrForgedRequestsAreRejected() throws Exception {
    byte[] body = follow(remote.actorUri() + "/follows/2").getBytes(StandardCharsets.UTF_8);
    mockMvc
        .perform(post("/ap/inbox").header("Host", "localhost").content(body))
        .andExpect(status().isUnauthorized());

    Map<String, String> headers = remote.sign(URI.create("http://localhost/ap/inbox"), body);
    byte[] tampered = follow(remote.actorUri() + "/follows/3").getBytes(StandardCharsets.UTF_8);
    MockHttpServletRequestBuilder forged =
        post("/ap/inbox").header("Host", "localhost").content(tampered);
    headers.forEach(forged::header);
    mockMvc.perform(forged).andExpect(status().isUnauthorized());

    String impersonation =
        """
        {"id": "%1$s/follows/4", "type": "Follow", "actor": "http://%2$s/users/someone-else",
         "object": "%3$s"}
        """
            .formatted(remote.actorUri(), remote.authority(), localActor());
    inbox(impersonation).andExpect(status().isForbidden());
  }

  @Test
  void replayedActivityIsProcessedOnce() throws Exception {
    String activity = follow(remote.actorUri() + "/follows/5");
    inbox(activity).andExpect(status().isAccepted());
    inbox(activity).andExpect(status().isAccepted());

    deliveryService.deliverDue();
    assertThat(remote.inbox).hasSize(1);
  }

  private String follow(String id) {
    return """
        {"@context": "https://www.w3.org/ns/activitystreams",
         "id": "%s", "type": "Follow", "actor": "%s", "object": "%s"}
        """
        .formatted(id, remote.actorUri(), localActor());
  }

  private String localActor() {
    return "http://localhost/ap/users/" + local.getId();
  }

  private ResultActions inbox(String activity) throws Exception {
    byte[] body = activity.getBytes(StandardCharsets.UTF_8);
    String path = "/ap/users/" + local.getId() + "/inbox";
    MockHttpServletRequestBuilder request =
        post(path)
            .header("Host", "localhost")
            .contentType("application/activity+json")
            .content(body);
    remote.sign(URI.create("http://localhost" + path), body).forEach(request::header);
    return mockMvc.perform(request);
  }
}
