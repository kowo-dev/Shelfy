package com.shelfy.api.federation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.http.MediaType.APPLICATION_JSON;
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
class FederatedCollaboratorsIntegrationTest {

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
  private UserEntity friend;

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
    friend = remoteActors.resolveHandle(remote.handle());
    jdbcClient
        .sql(
            """
            insert into follows (follower_id, followed_id)
            values (:remote, :local), (:local, :remote)
            """)
        .param("remote", friend.getId())
        .param("local", local.getId())
        .update();
  }

  @AfterEach
  void tearDown() {
    remote.close();
  }

  @Test
  void remoteFriendCollaboratesOnALocalList() throws Exception {
    MediaEntity first = movie();
    MediaEntity second = movie();
    String listId =
        JsonPath.read(
            send(
                post("/api/v1/lists")
                    .content(
                        """
                        {"name": "Shared", "visibility": "public", "media": [%s]}
                        """
                            .formatted(references(List.of(first))))),
            "$.id");
    send(
        post("/api/v1/lists/{id}/collaborators", listId)
            .content("{\"userId\": \"%s\"}".formatted(friend.getId())));
    deliveryService.deliverDue();

    JsonNode invite = delivered("Invite");
    assertThat(invite.path("object").asString()).isEqualTo(remote.actorUri());
    assertThat(invite.path("target").path("shelfy:list").path("name").asString())
        .isEqualTo("Shared");

    inbox(
            """
            {"id": "%1$s/accept/1", "type": "Accept", "actor": "%1$s", "object": %2$s}
            """
                .formatted(remote.actorUri(), invite.toString()))
        .andExpect(status().isAccepted());
    assertThat(collaboratorStatus(UUID.fromString(listId), friend.getId())).isEqualTo("ACCEPTED");

    inbox(
            """
            {"id": "%1$s/edits/1", "type": "Update", "actor": "%1$s",
             "object": {"id": "http://localhost/ap/lists/%2$s", "type": "Note",
               "shelfy:list": {"items": [%3$s]}}}
            """
                .formatted(remote.actorUri(), listId, works(List.of(first, second))))
        .andExpect(status().isAccepted());
    assertThat(
            jdbcClient
                .sql(
                    """
                    select count(*) from media_list_items where list_id = :id and added_by = :by
                    """)
                .param("id", UUID.fromString(listId))
                .param("by", friend.getId())
                .query(Long.class)
                .single())
        .isEqualTo(1);
  }

  @Test
  void localUserCollaboratesOnARemoteList() throws Exception {
    MediaEntity first = movie();
    MediaEntity second = movie();
    String remoteList = remote.actorUri() + "/lists/7";
    inbox(
            """
            {"@context": "https://www.w3.org/ns/activitystreams",
             "id": "%1$s/invites/7", "type": "Invite", "actor": "%1$s", "object": "%2$s",
             "target": {"id": "%3$s", "type": "Note", "attributedTo": "%1$s",
               "to": ["%2$s"],
               "shelfy:list": {"name": "Theirs", "items": [%4$s]}}}
            """
                .formatted(
                    remote.actorUri(),
                    "http://localhost/ap/users/" + local.getId(),
                    remoteList,
                    works(List.of(first))))
        .andExpect(status().isAccepted());
    UUID mirror =
        jdbcClient
            .sql("select local_id from ap_remote_collections where ap_id = :apId")
            .param("apId", remoteList)
            .query(UUID.class)
            .single();
    assertThat(collaboratorStatus(mirror, local.getId())).isEqualTo("PENDING");

    send(put("/api/v1/lists/{id}/collaborators/accept", mirror));
    send(
        post("/api/v1/lists/{id}/items/batch", mirror)
            .content("{\"media\": [%s]}".formatted(references(List.of(second)))));
    deliveryService.deliverDue();

    JsonNode accept = delivered("Accept");
    assertThat(accept.path("object").path("target").asString()).isEqualTo(remoteList);
    JsonNode edit = delivered("Update");
    assertThat(edit.path("object").path("id").asString()).isEqualTo(remoteList);
    assertThat(edit.path("object").path("shelfy:list").path("items")).hasSize(2);
  }

  private String collaboratorStatus(UUID listId, UUID userId) {
    return jdbcClient
        .sql(
            "select status from media_list_collaborators where list_id = :list and user_id = :user")
        .param("list", listId)
        .param("user", userId)
        .query(String.class)
        .optional()
        .orElse("none");
  }

  private JsonNode delivered(String type) {
    return remote.inbox.stream()
        .map(RemoteStub.Received::body)
        .filter(body -> body.path("type").asString().equals(type))
        .findFirst()
        .orElseThrow(() -> new AssertionError("No " + type + " delivered"));
  }

  private static String works(List<MediaEntity> media) {
    return media.stream()
        .map(
            item ->
                """
                {"references": [{"provider": "tmdb", "mediaType": "movie", "externalId": "%s"}]}
                """
                    .formatted(item.getExternalId()))
        .collect(Collectors.joining(","));
  }

  private static String references(List<MediaEntity> media) {
    return media.stream()
        .map(
            item ->
                "{\"provider\": \"tmdb\", \"mediaType\": \"movie\", \"externalId\": \"%s\"}"
                    .formatted(item.getExternalId()))
        .collect(Collectors.joining(","));
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
