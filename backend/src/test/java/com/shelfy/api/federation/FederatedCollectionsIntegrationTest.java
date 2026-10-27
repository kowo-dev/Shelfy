package com.shelfy.api.federation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
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
import java.io.IOException;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
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
class FederatedCollectionsIntegrationTest {

  @Autowired private MockMvc mockMvc;
  @Autowired private JwtService jwtService;
  @Autowired private UserRepository users;
  @Autowired private MediaRepository mediaRepository;
  @Autowired private CanonicalWorkService canonicalWorks;
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
  void localListIsPublishedUpdatedAndDeleted() throws Exception {
    inbox(
            """
            {"id": "%1$s/follows/1", "type": "Follow", "actor": "%1$s", "object": "%2$s"}
            """
                .formatted(remote.actorUri(), localActor()))
        .andExpect(status().isAccepted());
    MediaEntity first = movie();
    MediaEntity second = movie();
    String listId =
        JsonPath.read(
            send(
                post("/api/v1/lists")
                    .content(
                        """
                        {"name": "Favourites", "visibility": "public", "tags": ["best"],
                         "media": [%s]}
                        """
                            .formatted(references(List.of(first))))),
            "$.id");
    send(
        post("/api/v1/lists/{id}/items/batch", listId)
            .content("{\"media\": [%s]}".formatted(references(List.of(second)))));
    deliveryService.deliverDue();

    JsonNode create = delivered("Create");
    assertThat(create.path("object").path("shelfy:list").path("name").asString())
        .isEqualTo("Favourites");
    JsonNode update = delivered("Update");
    assertThat(update.path("object").path("shelfy:list").path("items")).hasSize(2);
    mockMvc
        .perform(get("/ap/lists/{id}", listId))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.name").value("Favourites"));

    send(delete("/api/v1/lists/{id}", listId));
    deliveryService.deliverDue();
    assertThat(delivered("Delete").path("object").path("id").asString())
        .isEqualTo("http://localhost/ap/lists/" + listId);
  }

  @Test
  void remoteListAndPoolAreMirrored() throws Exception {
    follow(remoteActors.resolveHandle(remote.handle()));
    MediaEntity first = movie();
    MediaEntity second = movie();
    String listId = remote.actorUri() + "/lists/1";

    inbox(listActivity("Create", listId, List.of(first, second))).andExpect(status().isAccepted());
    assertThat(mirroredTitles(listId)).containsExactly(first.getTitle(), second.getTitle());

    inbox(listActivity("Update", listId, List.of(second))).andExpect(status().isAccepted());
    assertThat(mirroredTitles(listId)).containsExactly(second.getTitle());

    String poolId = remote.actorUri() + "/versus/1";
    inbox(
            """
            {"id": "%1$s/create", "type": "Create", "actor": "%2$s",
             "object": {"id": "%1$s", "type": "Note", "attributedTo": "%2$s",
               "to": ["https://www.w3.org/ns/activitystreams#Public"],
               "shelfy:versusPool": {"name": "Duel", "items": [
                 {"work": {"references": [{"provider": "tmdb", "mediaType": "movie",
                                           "externalId": "%3$s"}]}},
                 {"clip": {"provider": "youtube", "externalId": "abc123", "title": "Opening",
                           "thumbnailUrl": "https://img.example/a.jpg"}}]}}}
            """
                .formatted(poolId, remote.actorUri(), first.getExternalId()))
        .andExpect(status().isAccepted());
    assertThat(
            jdbcClient
                .sql(
                    """
                    select count(*) from versus_pool_items i
                    join ap_remote_collections c on c.local_id = i.pool_id where c.ap_id = :apId
                    """)
                .param("apId", poolId)
                .query(Long.class)
                .single())
        .isEqualTo(2);

    inbox(
            """
            {"id": "%1$s/delete", "type": "Delete", "actor": "%2$s",
             "object": {"id": "%1$s", "type": "Tombstone"}}
            """
                .formatted(listId, remote.actorUri()))
        .andExpect(status().isAccepted());
    assertThat(mirroredTitles(listId)).isEmpty();
  }

  @Test
  void likesAndRepliesWorkOnListsBothWays() throws Exception {
    MediaEntity movie = movie();
    String listId =
        JsonPath.read(
            send(
                post("/api/v1/lists")
                    .content(
                        """
                        {"name": "Mine", "visibility": "public", "media": [%s]}
                        """
                            .formatted(references(List.of(movie))))),
            "$.id");
    String listUri = "http://localhost/ap/lists/" + listId;
    jdbcClient
        .sql("insert into ap_published_objects (object_id) values (:id) on conflict do nothing")
        .param("id", UUID.fromString(listId))
        .update();

    inbox(
            """
            {"id": "%1$s/likes/9", "type": "Like", "actor": "%1$s", "object": "%2$s"}
            """
                .formatted(remote.actorUri(), listUri))
        .andExpect(status().isAccepted());
    inbox(
            """
            {"id": "%1$s/statuses/9/activity", "type": "Create", "actor": "%1$s",
             "object": {"id": "%1$s/statuses/9", "type": "Note", "attributedTo": "%1$s",
                        "inReplyTo": "%2$s", "content": "<p>Nice list</p>"}}
            """
                .formatted(remote.actorUri(), listUri))
        .andExpect(status().isAccepted());
    assertThat(count("select count(*) from media_list_likes where list_id = :id", listId))
        .isEqualTo(1);
    assertThat(
            count(
                "select count(*) from comments where target_type = 'LIST' and target_id = :id",
                listId))
        .isEqualTo(1);

    UserEntity author = users.findByUsernameIgnoreCase(remote.handle()).orElseThrow();
    follow(author);
    String remoteList = remote.actorUri() + "/lists/2";
    inbox(listActivity("Create", remoteList, List.of(movie))).andExpect(status().isAccepted());
    UUID mirrored =
        jdbcClient
            .sql("select local_id from ap_remote_collections where ap_id = :apId")
            .param("apId", remoteList)
            .query(UUID.class)
            .single();
    send(post("/api/v1/lists/{id}/likes", mirrored));
    send(post("/api/v1/lists/{id}/comments", mirrored).content("{\"content\": \"Great picks\"}"));
    deliveryService.deliverDue();
    assertThat(delivered("Like").path("object").asString()).isEqualTo(remoteList);
    assertThat(delivered("Create").path("object").path("inReplyTo").asString())
        .isEqualTo(remoteList);
  }

  private String listActivity(String type, String listId, List<MediaEntity> items) {
    String works =
        items.stream()
            .map(
                media ->
                    """
                    {"references": [{"provider": "tmdb", "mediaType": "movie", "externalId": "%s"}]}
                    """
                        .formatted(media.getExternalId()))
            .collect(Collectors.joining(","));
    return """
        {"id": "%1$s/%4$s", "type": "%4$s", "actor": "%2$s",
         "object": {"id": "%1$s", "type": "Note", "attributedTo": "%2$s",
           "to": ["https://www.w3.org/ns/activitystreams#Public"],
           "shelfy:list": {"name": "Remote picks", "tags": ["x"], "items": [%3$s]}}}
        """
        .formatted(listId, remote.actorUri(), works, type);
  }

  private List<String> mirroredTitles(String apId) {
    return jdbcClient
        .sql(
            """
            select m.title from media_list_items i
            join media m on m.id = i.media_id
            join ap_remote_collections c on c.local_id = i.list_id
            where c.ap_id = :apId order by i.position
            """)
        .param("apId", apId)
        .query(String.class)
        .list();
  }

  private void follow(UserEntity target) {
    jdbcClient
        .sql(
            """
            insert into follows (follower_id, followed_id) values (:follower, :followed)
            on conflict do nothing
            """)
        .param("follower", local.getId())
        .param("followed", target.getId())
        .update();
  }

  private long count(String sql, String id) {
    return jdbcClient.sql(sql).param("id", UUID.fromString(id)).query(Long.class).single();
  }

  private JsonNode delivered(String type) {
    return remote.inbox.stream()
        .map(RemoteStub.Received::body)
        .filter(body -> body.path("type").asString().equals(type))
        .findFirst()
        .orElseThrow(() -> new AssertionError("No " + type + " delivered"));
  }

  private static String references(List<MediaEntity> media) {
    return media.stream()
        .map(
            item ->
                "{\"provider\": \"tmdb\", \"mediaType\": \"movie\", \"externalId\": \"%s\"}"
                    .formatted(item.getExternalId()))
        .collect(Collectors.joining(","));
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
