package com.shelfy.api.federation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
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
import com.shelfy.api.collection.UserMediaRepository;
import com.shelfy.api.feed.FeedService;
import com.shelfy.api.follows.FollowService;
import java.io.IOException;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.Set;
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
import tools.jackson.databind.JsonNode;

@SpringBootTest(
    properties = {
      "app.federation.enabled=true",
      "app.federation.handle-domain=shelfy.test",
      "app.federation.server-url=http://localhost",
      "app.federation.dev-mode=true"
    })
@AutoConfigureMockMvc
class FederatedActivitiesIntegrationTest {

  private static final String REVIEW =
      """
      {"note": {"type": "doc", "content": [{"type": "paragraph",
        "content": [{"type": "text", "text": "Loved <it>"}]}]},
       "rating": 8, "containsSpoilers": true}
      """;

  @Autowired private MockMvc mockMvc;
  @Autowired private JwtService jwtService;
  @Autowired private UserRepository users;
  @Autowired private MediaRepository mediaRepository;
  @Autowired private CanonicalWorkService canonicalWorks;
  @Autowired private UserMediaRepository userMedia;
  @Autowired private ActorStore actorStore;
  @Autowired private DeliveryService deliveryService;
  @Autowired private RemoteActorService remoteActors;
  @Autowired private FollowService followService;
  @Autowired private FeedService feedService;
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
  void localReviewIsPublishedToRemoteFollowers() throws Exception {
    inbox(
            """
            {"id": "%1$s/follows/1", "type": "Follow", "actor": "%1$s", "object": "%2$s"}
            """
                .formatted(remote.actorUri(), localActor()))
        .andExpect(status().isAccepted());
    MediaEntity movie = movie();
    String itemId =
        JsonPath.read(
            send(
                post("/api/v1/collection")
                    .content(
                        """
                        {"externalId": "%s", "provider": "tmdb", "mediaType": "movie",
                         "status": "done"}
                        """
                            .formatted(movie.getExternalId()))),
            "$.id");
    send(put("/api/v1/collection/{id}", itemId).content(REVIEW));

    deliveryService.deliverDue();
    JsonNode review =
        remote.inbox.stream()
            .map(RemoteStub.Received::body)
            .filter(body -> body.path("type").asString().equals("Create"))
            .map(body -> body.path("object"))
            .filter(note -> note.path("shelfy:activity").path("type").asString().equals("REVIEWED"))
            .findFirst()
            .orElseThrow();
    assertThat(review.path("content").asString()).contains("Loved &lt;it&gt;").contains("8/10");
    assertThat(review.path("summary").asString()).isEqualTo("Spoilers: " + movie.getTitle());
    assertThat(review.path("sensitive").asBoolean()).isTrue();
    assertThat(review.path("content").asString()).contains("rel=\"tag\">#<span>movie</span>");
    assertThat(review.path("tag").path(0).path("type").asString()).isEqualTo("Hashtag");
    assertThat(review.path("tag").path(0).path("name").asString()).isEqualTo("#movie");
    assertThat(review.path("shelfy:item").path("rating").asInt()).isEqualTo(8);
    assertThat(review.path("shelfy:work").path("references").path(0).path("externalId").asString())
        .isEqualTo(movie.getExternalId());
    assertThat(remote.inbox).allMatch(received -> received.signatureCheck().equals("valid"));

    String noteId = review.path("id").asString();
    mockMvc
        .perform(get(URI.create(noteId).getPath()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.id").value(noteId));
    mockMvc
        .perform(get("/ap/users/{id}/outbox", local.getId()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.orderedItems[0].type").value("Create"));

    send(delete("/api/v1/collection/{id}", itemId));
    deliveryService.deliverDue();
    assertThat(remote.inbox.getLast().body().path("type").asString()).isEqualTo("Delete");
  }

  @Test
  void newFollowerReceivesRecentActivities() throws Exception {
    MediaEntity movie = movie();
    send(
        post("/api/v1/collection")
            .content(
                """
                {"externalId": "%s", "provider": "tmdb", "mediaType": "movie", "status": "done"}
                """
                    .formatted(movie.getExternalId())));
    deliveryService.deliverDue();
    assertThat(remote.inbox).isEmpty();

    inbox(
            """
            {"id": "%1$s/follows/9", "type": "Follow", "actor": "%1$s", "object": "%2$s"}
            """
                .formatted(remote.actorUri(), localActor()))
        .andExpect(status().isAccepted());

    deliveryService.deliverDue();
    assertThat(remote.inbox.stream().map(received -> received.body().path("type").asString()))
        .containsExactly("Accept");

    jdbcClient.sql("update ap_deliveries set next_attempt_at = now()").update();
    deliveryService.deliverDue();
    assertThat(remote.inbox.stream().map(received -> received.body().path("type").asString()))
        .containsExactly("Accept", "Create");
    JsonNode note = remote.inbox.getLast().body().path("object");
    assertThat(note.path("shelfy:activity").path("type").asString()).isEqualTo("ADDED");
  }

  @Test
  void remoteActivityLandsInTheFeedOfFollowers() throws Exception {
    UserEntity author = remoteActors.resolveHandle(remote.handle());
    jdbcClient
        .sql("insert into follows (follower_id, followed_id) values (:follower, :followed)")
        .param("follower", local.getId())
        .param("followed", author.getId())
        .update();
    MediaEntity movie = movie();
    String noteId = remote.actorUri() + "/notes/1";

    inbox(create("Create", noteId, movie, 7)).andExpect(status().isAccepted());

    var item = userMedia.findByUserIdAndMediaId(author.getId(), movie.getId()).orElseThrow();
    assertThat(item.getRating()).isEqualTo(7);
    var feed = feedService.getCircleFeed(local.getId(), null, 20);
    assertThat(feed.items())
        .anySatisfy(entry -> assertThat(entry.actor().username()).isEqualTo(remote.handle()));

    inbox(create("Update", noteId, movie, 9)).andExpect(status().isAccepted());
    assertThat(
            userMedia
                .findByUserIdAndMediaId(author.getId(), movie.getId())
                .orElseThrow()
                .getRating())
        .isEqualTo(9);

    inbox(
            """
            {"id": "%1$s/delete/1", "type": "Delete", "actor": "%1$s",
             "object": {"id": "%2$s", "type": "Tombstone"}}
            """
                .formatted(remote.actorUri(), noteId))
        .andExpect(status().isAccepted());
    assertThat(userMedia.findByUserIdAndMediaId(author.getId(), movie.getId())).isEmpty();
  }

  @Test
  void activityFromAnActorNobodyFollowsIsIgnored() throws Exception {
    UserEntity author = remoteActors.resolveHandle(remote.handle());
    MediaEntity movie = movie();

    inbox(create("Create", remote.actorUri() + "/notes/2", movie, 5))
        .andExpect(status().isAccepted());

    assertThat(userMedia.findByUserIdAndMediaId(author.getId(), movie.getId())).isEmpty();
  }

  private String create(String type, String noteId, MediaEntity movie, int rating) {
    return """
        {"@context": "https://www.w3.org/ns/activitystreams",
         "id": "%1$s/%5$s", "type": "%5$s", "actor": "%2$s",
         "object": {"id": "%1$s", "type": "Note", "attributedTo": "%2$s",
           "content": "<p>Rated it</p>",
           "shelfy:activity": {"type": "RATED", "payload": {"rating": %4$d}},
           "shelfy:work": {"mediaType": "movie", "title": "Remote title",
             "references": [{"provider": "tmdb", "mediaType": "movie", "externalId": "%3$s"}]},
           "shelfy:item": {"status": "done", "rating": %4$d, "containsSpoilers": false}}}
        """
        .formatted(noteId, remote.actorUri(), movie.getExternalId(), rating, type);
  }

  private String localActor() {
    return "http://localhost/ap/users/" + local.getId();
  }

  private ResultActions inbox(String activity) throws Exception {
    byte[] body = activity.getBytes(StandardCharsets.UTF_8);
    MockHttpServletRequestBuilder request =
        post("/ap/inbox").header("Host", "localhost").content(body);
    remote.sign(URI.create("http://localhost/ap/inbox"), body).forEach(request::header);
    return mockMvc.perform(request);
  }

  private String send(MockHttpServletRequestBuilder request) throws Exception {
    return mockMvc
        .perform(
            request
                .header("Authorization", "Bearer " + jwtService.generateAccessToken(local))
                .contentType(APPLICATION_JSON))
        .andExpect(status().is2xxSuccessful())
        .andReturn()
        .getResponse()
        .getContentAsString();
  }

  private MediaEntity movie() {
    String externalId = String.valueOf(Math.abs(UUID.randomUUID().getMostSignificantBits()));
    return mediaRepository.saveAndFlush(
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
