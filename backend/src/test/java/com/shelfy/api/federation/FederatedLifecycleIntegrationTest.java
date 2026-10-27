package com.shelfy.api.federation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.shelfy.api.auth.JwtService;
import com.shelfy.api.auth.UserEntity;
import com.shelfy.api.auth.UserRepository;
import java.io.IOException;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.crypto.password.PasswordEncoder;
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
      "app.federation.dev-mode=true",
      "app.federation.admins=fedadmin@example.com"
    })
@AutoConfigureMockMvc
class FederatedLifecycleIntegrationTest {

  @Autowired private MockMvc mockMvc;
  @Autowired private JwtService jwtService;
  @Autowired private UserRepository users;
  @Autowired private PasswordEncoder passwordEncoder;
  @Autowired private ActorStore actorStore;
  @Autowired private DeliveryService deliveryService;
  @Autowired private RemoteActorService remoteActors;
  @Autowired private JdbcClient jdbcClient;
  @MockitoBean private FederationJobs federationJobs;

  private final Map<String, String> knownKeys = new ConcurrentHashMap<>();
  private RemoteStub remote;
  private UserEntity local;

  @BeforeEach
  void setUp() throws IOException {
    jdbcClient.sql("delete from ap_deliveries").update();
    jdbcClient.sql("delete from ap_reports").update();
    remote = new RemoteStub(knownKeys::get);
    local = localUser("u" + UUID.randomUUID().toString().substring(0, 12));
  }

  @AfterEach
  void tearDown() {
    remote.close();
  }

  @Test
  void deletedAccountIsAnnouncedWithItsOwnKey() throws Exception {
    followedByRemote();

    mockMvc
        .perform(
            delete("/api/v1/users/me")
                .header("Authorization", "Bearer " + jwtService.generateAccessToken(local))
                .contentType(APPLICATION_JSON)
                .content("{\"password\": \"secret-password\"}"))
        .andExpect(status().is2xxSuccessful());
    deliveryService.deliverDue();

    JsonNode delete = delivered("Delete");
    assertThat(delete.path("object").asString()).isEqualTo(localActor());
    assertThat(remote.inbox).allMatch(received -> received.signatureCheck().equals("valid"));
    assertThat(users.findById(local.getId())).isEmpty();
  }

  @Test
  void profileUpdatesTravelBothWays() throws Exception {
    followedByRemote();
    String renamed = local.getUsername() + "x";

    send(
        local,
        patch("/api/v1/users/me")
            .content(
                """
                {"username": "%s", "displayName": "New name", "bio": "Hello", "confirmAdultContent": false}
                """
                    .formatted(renamed)));
    deliveryService.deliverDue();
    JsonNode update = delivered("Update");
    assertThat(update.path("object").path("preferredUsername").asString()).isEqualTo(renamed);
    assertThat(update.path("object").path("id").asString()).isEqualTo(localActor());

    UserEntity author = users.findByUsernameIgnoreCase(remote.handle()).orElseThrow();
    String pem = RemoteStub.JSON.writeValueAsString(RsaKeys.publicPem(remote.keys.getPublic()));
    inbox(
            """
            {"id": "%1$s#update", "type": "Update", "actor": "%1$s",
             "object": {"id": "%1$s", "type": "Person", "preferredUsername": "%2$s",
               "name": "Renamed remote", "inbox": "%1$s/inbox",
               "publicKey": {"id": "%1$s#main-key", "owner": "%1$s", "publicKeyPem": %3$s}}}
            """
                .formatted(remote.actorUri(), remote.name, pem))
        .andExpect(status().isAccepted());
    assertThat(users.findById(author.getId()).orElseThrow().getDisplayName())
        .isEqualTo("Renamed remote");
  }

  @Test
  void adminsSeeFailingDeliveriesAndRetryThem() throws Exception {
    UserEntity admin =
        users
            .findByUsernameIgnoreCaseAndDomainIsNull("fedadmin")
            .orElseGet(() -> localUser("fedadmin"));
    followedByRemote();
    jdbcClient
        .sql(
            """
            insert into ap_deliveries (sender_id, inbox, payload, attempts, last_error, next_attempt_at)
            values (:sender, :inbox, '{}', 3, 'Got HTTP 503', now() + interval '1 day')
            """)
        .param("sender", local.getId())
        .param("inbox", "http://" + remote.authority() + "/inbox")
        .update();

    mockMvc
        .perform(
            get("/api/v1/admin/federation/overview")
                .header("Authorization", "Bearer " + jwtService.generateAccessToken(admin)))
        .andExpect(
            jsonPath("$.instances[?(@.domain == '%s')].lastError".formatted(remote.authority()))
                .value("Got HTTP 503"));

    mockMvc
        .perform(
            post("/api/v1/admin/federation/deliveries/" + remote.authority() + "/retry")
                .header("Authorization", "Bearer " + jwtService.generateAccessToken(local)))
        .andExpect(status().isForbidden());
    mockMvc
        .perform(
            post("/api/v1/admin/federation/deliveries/" + remote.authority() + "/retry")
                .header("Authorization", "Bearer " + jwtService.generateAccessToken(admin)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.retried").value(org.hamcrest.Matchers.greaterThanOrEqualTo(1)));

    assertThat(
            jdbcClient
                .sql("select count(*) from ap_deliveries where attempts > 0")
                .query(Long.class)
                .single())
        .isZero();
  }

  @Test
  void adminsBlockDomainsAndReadReports() throws Exception {
    UserEntity admin =
        users
            .findByUsernameIgnoreCaseAndDomainIsNull("fedadmin")
            .orElseGet(() -> localUser("fedadmin"));
    followedByRemote();
    inbox(
            """
            {"id": "%1$s/flags/1", "type": "Flag", "actor": "%1$s",
             "object": ["%2$s"], "content": "Spam shelf"}
            """
                .formatted(remote.actorUri(), localActor()))
        .andExpect(status().isAccepted());

    mockMvc
        .perform(
            get("/api/v1/admin/federation/reports")
                .header("Authorization", "Bearer " + jwtService.generateAccessToken(admin)))
        .andExpect(status().isOk())
        .andExpect(
            jsonPath("$[?(@.content == 'Spam shelf')].targetHandle").value(local.getUsername()));
    mockMvc
        .perform(
            get("/api/v1/admin/federation/reports")
                .header("Authorization", "Bearer " + jwtService.generateAccessToken(local)))
        .andExpect(status().isForbidden());
    mockMvc
        .perform(
            get("/api/v1/admin/federation/overview")
                .header("Authorization", "Bearer " + jwtService.generateAccessToken(admin)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.isEnabled").value(true))
        .andExpect(
            jsonPath("$.instances[?(@.domain == '%s')].accounts".formatted(remote.authority()))
                .value(1));
    mockMvc
        .perform(
            get("/api/v1/users/me")
                .header("Authorization", "Bearer " + jwtService.generateAccessToken(admin)))
        .andExpect(jsonPath("$.isAdmin").value(true));
    mockMvc
        .perform(
            get("/api/v1/users/me")
                .header("Authorization", "Bearer " + jwtService.generateAccessToken(local)))
        .andExpect(jsonPath("$.isAdmin").value(false));

    try {
      send(
          admin, put("/api/v1/admin/federation/domain-blocks/" + remote.authority()).content("{}"));
      assertThat(users.findByUsernameIgnoreCase(remote.handle())).isEmpty();
      inbox(
              """
              {"id": "%1$s/follows/2", "type": "Follow", "actor": "%1$s", "object": "%2$s"}
              """
                  .formatted(remote.actorUri(), localActor()))
          .andExpect(status().isForbidden());
    } finally {
      send(admin, delete("/api/v1/admin/federation/domain-blocks/127.0.0.1"));
    }
  }

  private void followedByRemote() throws Exception {
    knownKeys.put(localActor() + "#main-key", actorStore.localKey(local.getId()).publicPem());
    inbox(
            """
            {"id": "%1$s/follows/1", "type": "Follow", "actor": "%1$s", "object": "%2$s"}
            """
                .formatted(remote.actorUri(), localActor()))
        .andExpect(status().isAccepted());
    deliveryService.deliverDue();
    remote.inbox.clear();
  }

  private JsonNode delivered(String type) {
    return remote.inbox.stream()
        .map(RemoteStub.Received::body)
        .filter(body -> body.path("type").asString().equals(type))
        .findFirst()
        .orElseThrow(() -> new AssertionError("No " + type + " delivered"));
  }

  private UserEntity localUser(String name) {
    UserEntity user =
        new UserEntity(name + "@example.com", name, passwordEncoder.encode("secret-password"));
    user.setEmailVerified(true);
    return users.saveAndFlush(user);
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

  private void send(UserEntity user, MockHttpServletRequestBuilder request) throws Exception {
    mockMvc
        .perform(
            request
                .header("Authorization", "Bearer " + jwtService.generateAccessToken(user))
                .contentType(APPLICATION_JSON))
        .andExpect(status().is2xxSuccessful());
  }
}
