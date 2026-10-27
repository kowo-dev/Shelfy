package com.shelfy.api.federation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.shelfy.api.auth.CollectionVisibility;
import com.shelfy.api.auth.UserEntity;
import com.shelfy.api.auth.UserRepository;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.json.JsonMapper;

@SpringBootTest(
    properties = {
      "app.federation.enabled=true",
      "app.federation.handle-domain=shelfy.test",
      "app.federation.server-url=http://api.shelfy.test",
      "app.federation.dev-mode=true"
    })
@AutoConfigureMockMvc
class FederationIntegrationTest {

  private static final JsonMapper JSON = JsonMapper.builder().build();

  @Autowired private MockMvc mockMvc;
  @Autowired private UserRepository users;
  @Autowired private ActorStore actorStore;
  @Autowired private RemoteActorService remoteActors;
  @Autowired private PlatformTransactionManager transactionManager;
  @Autowired private JdbcClient jdbcClient;

  private HttpServer remote;
  private String remoteAuthority;
  private String remoteName;
  private final AtomicReference<String> signatureCheck = new AtomicReference<>("not signed");

  @BeforeEach
  void startRemote() throws IOException {
    remote = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
    remoteAuthority = "127.0.0.1:" + remote.getAddress().getPort();
    String pem = RsaKeys.publicPem(RsaKeys.generate().getPublic());
    String name = "r" + UUID.randomUUID().toString().substring(0, 8);
    remoteName = name;
    String actorUri = "http://" + remoteAuthority + "/users/" + name;
    remote.createContext(
        "/.well-known/webfinger",
        exchange ->
            reply(
                exchange,
                """
                {"subject": "acct:%s@%s",
                 "links": [{"rel": "self", "type": "application/activity+json", "href": "%s"}]}
                """
                    .formatted(name, remoteAuthority, actorUri)));
    remote.createContext(
        "/users/",
        exchange -> {
          checkSignature(exchange);
          reply(
              exchange,
              """
              {"@context": "https://www.w3.org/ns/activitystreams",
               "id": "%1$s", "type": "Person", "preferredUsername": "%2$s", "name": "Remote",
               "inbox": "%1$s/inbox",
               "publicKey": {"id": "%1$s#main-key", "owner": "%1$s", "publicKeyPem": %3$s}}
              """
                  .formatted(actorUri, name, JSON.writeValueAsString(pem)));
        });
    remote.start();
  }

  @AfterEach
  void stopRemote() {
    remote.stop(0);
  }

  @Test
  void localUserIsDiscoverable() throws Exception {
    UserEntity user = user(CollectionVisibility.PUBLIC);
    String actor = "http://api.shelfy.test/ap/users/" + user.getId();

    mockMvc
        .perform(
            get("/.well-known/webfinger")
                .param("resource", "acct:" + user.getUsername() + "@shelfy.test"))
        .andExpect(status().isOk())
        .andExpect(content().contentTypeCompatibleWith("application/jrd+json"))
        .andExpect(jsonPath("$.links[0].href").value(actor));

    mockMvc
        .perform(
            get("/.well-known/webfinger")
                .param("resource", "acct:" + user.getUsername() + "@api.shelfy.test"))
        .andExpect(status().isOk());

    mockMvc
        .perform(get("/ap/users/{id}", user.getId()).accept("application/activity+json"))
        .andExpect(status().isOk())
        .andExpect(content().contentTypeCompatibleWith("application/activity+json"))
        .andExpect(jsonPath("$.id").value(actor))
        .andExpect(jsonPath("$.preferredUsername").value(user.getUsername()))
        .andExpect(jsonPath("$.inbox").value(actor + "/inbox"))
        .andExpect(jsonPath("$.publicKey.owner").value(actor))
        .andExpect(
            jsonPath("$.publicKey.publicKeyPem")
                .value(actorStore.localKey(user.getId()).publicPem()));
  }

  @Test
  void bannerIsPublishedAsTheProfileImage() throws Exception {
    UserEntity user = user(CollectionVisibility.PUBLIC);
    user.setProfileBannerUrl("https://image.example/banner.jpg");
    users.saveAndFlush(user);

    mockMvc
        .perform(get("/ap/users/{id}", user.getId()).accept("application/activity+json"))
        .andExpect(jsonPath("$.image.url").value("https://image.example/banner.jpg"));

    user.setAdultContentAllowed(true);
    users.saveAndFlush(user);
    mockMvc
        .perform(get("/ap/users/{id}", user.getId()).accept("application/activity+json"))
        .andExpect(jsonPath("$.image").doesNotExist());
  }

  @Test
  void privateUserIsHidden() throws Exception {
    UserEntity user = user(CollectionVisibility.PRIVATE);

    mockMvc
        .perform(
            get("/.well-known/webfinger")
                .param("resource", "acct:" + user.getUsername() + "@shelfy.test"))
        .andExpect(status().isNotFound());
    mockMvc.perform(get("/ap/users/{id}", user.getId())).andExpect(status().isNotFound());
  }

  @Test
  void instanceDescribesItself() throws Exception {
    mockMvc
        .perform(get("/.well-known/nodeinfo"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.links[0].href").value("http://api.shelfy.test/nodeinfo/2.1"));
    mockMvc
        .perform(get("/nodeinfo/2.1"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.software.name").value("shelfy"))
        .andExpect(jsonPath("$.protocols[0]").value("activitypub"));
    mockMvc
        .perform(get("/ap/actor"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.type").value("Application"))
        .andExpect(jsonPath("$.publicKey.id").value("http://api.shelfy.test/ap/actor#main-key"));
    mockMvc
        .perform(get("/.well-known/host-meta"))
        .andExpect(status().isOk())
        .andExpect(content().contentTypeCompatibleWith("application/xrd+xml"));
  }

  @Test
  void instanceActorIsFoundByWebFingerOnBothDomains() throws Exception {
    for (String resource :
        new String[] {
          "acct:shelfy.test@shelfy.test",
          "acct:shelfy.test@api.shelfy.test",
          "http://api.shelfy.test/ap/actor"
        }) {
      mockMvc
          .perform(get("/.well-known/webfinger").param("resource", resource))
          .andExpect(status().isOk())
          .andExpect(jsonPath("$.subject").value("acct:shelfy.test@shelfy.test"))
          .andExpect(jsonPath("$.links[0].href").value("http://api.shelfy.test/ap/actor"));
    }
    mockMvc
        .perform(get("/.well-known/webfinger").param("resource", "acct:nobody@api.shelfy.test"))
        .andExpect(status().isNotFound());
  }

  @Test
  void keysAreCreatedEvenInsideReadOnlyTransactions() {
    UserEntity user = user(CollectionVisibility.PUBLIC);
    TransactionTemplate readOnly = new TransactionTemplate(transactionManager);
    readOnly.setReadOnly(true);

    readOnly.executeWithoutResult(
        status -> {
          jdbcClient.sql("select 1").query(Integer.class).single();
          assertThat(actorStore.localKey(user.getId()).privatePem()).isNotBlank();
          assertThat(remoteActors.resolveHandle("@" + remoteName + "@" + remoteAuthority))
              .isNotNull();
        });
  }

  @Test
  void remoteHandleIsResolvedAndStored() {
    String handle = "@" + remoteName + "@" + remoteAuthority;

    UserEntity resolved = remoteActors.resolveHandle(handle);

    assertThat(resolved.getDomain()).isEqualTo(remoteAuthority);
    assertThat(resolved.getEmail()).isNull();
    assertThat(resolved.getDisplayName()).isEqualTo("Remote");
    assertThat(actorStore.findRemoteByUserId(resolved.getId()))
        .hasValueSatisfying(
            actor -> assertThat(actor.inbox()).endsWith("/users/" + remoteName + "/inbox"));
    assertThat(signatureCheck.get()).isEqualTo("valid");
    assertThat(remoteActors.resolveHandle(handle).getId()).isEqualTo(resolved.getId());
    assertThat(users.findByUsernameIgnoreCaseAndDomainIsNull(remoteName)).isEmpty();
  }

  private void checkSignature(HttpExchange exchange) {
    try {
      HttpSignatures.Parsed parsed =
          HttpSignatures.parse(exchange.getRequestHeaders().getFirst("Signature"));
      HttpSignatures.verify(
          parsed,
          "GET",
          exchange.getRequestURI().getRawPath(),
          name -> exchange.getRequestHeaders().getFirst(name),
          null,
          RsaKeys.parsePublic(actorStore.instanceKey().publicPem()),
          Instant.now());
      signatureCheck.set(
          parsed.keyId().equals("http://api.shelfy.test/ap/actor#main-key")
              ? "valid"
              : "wrong key");
    } catch (RuntimeException e) {
      signatureCheck.set(e.getMessage());
    }
  }

  private static void reply(HttpExchange exchange, String body) throws IOException {
    byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
    exchange.getResponseHeaders().add("Content-Type", "application/activity+json");
    exchange.sendResponseHeaders(200, bytes.length);
    exchange.getResponseBody().write(bytes);
    exchange.close();
  }

  private UserEntity user(CollectionVisibility visibility) {
    String name = "u" + UUID.randomUUID().toString().substring(0, 12);
    UserEntity user = new UserEntity(name + "@example.com", name, "hash");
    user.setEmailVerified(true);
    user.setProfileVisibility(visibility);
    return users.saveAndFlush(user);
  }
}
