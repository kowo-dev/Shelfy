package com.shelfy.api.federation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
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
import com.shelfy.api.collection.UserMediaRepository;
import com.shelfy.api.comments.CommentRepository;
import com.shelfy.api.comments.CommentTargetType;
import com.shelfy.api.notifications.NotificationRepository;
import com.shelfy.api.notifications.NotificationType;
import java.io.IOException;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.data.domain.Pageable;
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
class FederatedInteractionsIntegrationTest {

  @Autowired private MockMvc mockMvc;
  @Autowired private JwtService jwtService;
  @Autowired private UserRepository users;
  @Autowired private MediaRepository mediaRepository;
  @Autowired private CanonicalWorkService canonicalWorks;
  @Autowired private UserMediaRepository userMedia;
  @Autowired private CommentRepository comments;
  @Autowired private NotificationRepository notifications;
  @Autowired private ActorStore actorStore;
  @Autowired private ObjectLookup lookup;
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
  void remoteReplyAndLikeLandOnALocalReview() throws Exception {
    UUID reviewId = localReview();
    String note = lookup.localNoteFor(reviewId).orElseThrow();
    String replyId = remote.actorUri() + "/statuses/1";

    inbox(
            """
            {"id": "%1$s/activity", "type": "Create", "actor": "%2$s",
             "object": {"id": "%1$s", "type": "Note", "attributedTo": "%2$s", "inReplyTo": "%3$s",
               "content": "<p><span class=\\"h-card\\"><a href=\\"x\\">@<span>%4$s</span></a></span> great take</p>"}}
            """
                .formatted(replyId, remote.actorUri(), note, local.getUsername()))
        .andExpect(status().isAccepted());

    assertThat(
            jdbcClient
                .sql(
                    """
                    select u.username || ' ' || c.content from comments c
                    join users u on u.id = c.author_id where c.target_id = :id
                    """)
                .param("id", reviewId)
                .query(String.class)
                .list())
        .containsExactly(remote.handle() + " @" + local.getUsername() + " great take");
    assertThat(
            notifications.findHistory(
                local.getId(),
                List.of(NotificationType.values()),
                NotificationType.requests(),
                Pageable.ofSize(5)))
        .isNotEmpty();

    String like =
        """
        {"id": "%1$s/likes/1", "type": "Like", "actor": "%1$s", "object": "%2$s"}
        """
            .formatted(remote.actorUri(), note);
    inbox(like).andExpect(status().isAccepted());
    assertThat(likes(reviewId)).isEqualTo(1);
    inbox(
            """
            {"id": "%1$s/likes/1/undo", "type": "Undo", "actor": "%1$s", "object": %2$s}
            """
                .formatted(remote.actorUri(), like))
        .andExpect(status().isAccepted());
    assertThat(likes(reviewId)).isZero();

    inbox(
            """
            {"id": "%1$s/delete", "type": "Delete", "actor": "%2$s",
             "object": {"id": "%1$s", "type": "Tombstone"}}
            """
                .formatted(replyId, remote.actorUri()))
        .andExpect(status().isAccepted());
    assertThat(comments.findByTargetTypeAndTargetId(CommentTargetType.REVIEW, reviewId)).isEmpty();
  }

  @Test
  void localCommentAndLikeOnARemoteReviewAreDelivered() throws Exception {
    UserEntity author = remoteActors.resolveHandle(remote.handle());
    jdbcClient
        .sql("insert into follows (follower_id, followed_id) values (:follower, :followed)")
        .param("follower", local.getId())
        .param("followed", author.getId())
        .update();
    MediaEntity movie = movie();
    String remoteNote = remote.actorUri() + "/notes/9";
    inbox(
            """
            {"id": "%1$s/create", "type": "Create", "actor": "%2$s",
             "object": {"id": "%1$s", "type": "Note", "attributedTo": "%2$s",
               "content": "<p>Review</p>",
               "shelfy:activity": {"type": "REVIEWED", "payload": {}},
               "shelfy:work": {"references": [{"provider": "tmdb", "mediaType": "movie",
                                               "externalId": "%3$s"}]},
               "shelfy:item": {"status": "done", "rating": 6, "note": {"type": "doc", "content": [
                 {"type": "paragraph", "content": [{"type": "text", "text": "Solid"}]}]}}}}
            """
                .formatted(remoteNote, remote.actorUri(), movie.getExternalId()))
        .andExpect(status().isAccepted());
    UUID reviewId =
        userMedia.findByUserIdAndMediaId(author.getId(), movie.getId()).orElseThrow().getId();

    send(post("/api/v1/reviews/{id}/comments", reviewId).content("{\"content\": \"Agreed <3\"}"));
    send(post("/api/v1/users/reviews/{id}/likes", reviewId));
    send(delete("/api/v1/users/reviews/{id}/likes", reviewId));
    deliveryService.deliverDue();

    JsonNode reply = delivered("Create");
    assertThat(reply.path("object").path("inReplyTo").asString()).isEqualTo(remoteNote);
    assertThat(reply.path("object").path("content").asString()).isEqualTo("<p>Agreed &lt;3</p>");
    assertThat(delivered("Like").path("object").asString()).isEqualTo(remoteNote);
    assertThat(delivered("Undo").path("object").path("type").asString()).isEqualTo("Like");
    assertThat(remote.inbox).allMatch(received -> received.signatureCheck().equals("valid"));
  }

  @Test
  void mentioningARemoteUserDeliversTheComment() throws Exception {
    remoteActors.resolveHandle(remote.handle());
    UUID reviewId = localReview();

    send(
        post("/api/v1/reviews/{id}/comments", reviewId)
            .content("{\"content\": \"What do you think @%s?\"}".formatted(remote.handle())));
    deliveryService.deliverDue();

    JsonNode note = delivered("Create").path("object");
    assertThat(note.path("tag").path(0).path("href").asString()).isEqualTo(remote.actorUri());
    assertThat(note.path("inReplyTo").asString())
        .isEqualTo(lookup.localNoteFor(reviewId).orElseThrow());
  }

  private JsonNode delivered(String type) {
    return remote.inbox.stream()
        .map(RemoteStub.Received::body)
        .filter(body -> body.path("type").asString().equals(type))
        .findFirst()
        .orElseThrow(() -> new AssertionError("No " + type + " delivered"));
  }

  private long likes(UUID reviewId) {
    return jdbcClient
        .sql("select count(*) from review_likes where review_id = :id")
        .param("id", reviewId)
        .query(Long.class)
        .single();
  }

  private UUID localReview() throws Exception {
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
    send(
        put("/api/v1/collection/{id}", itemId)
            .content(
                """
                {"note": {"type": "doc", "content": [{"type": "paragraph",
                  "content": [{"type": "text", "text": "Strong"}]}]}, "rating": 8}
                """));
    return UUID.fromString(itemId);
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
