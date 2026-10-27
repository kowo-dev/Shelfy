package com.shelfy.api.federation;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.shelfy.api.auth.UserEntity;
import com.shelfy.api.auth.UserRepository;
import java.io.IOException;
import java.net.URI;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

@SpringBootTest(
    properties = {
      "app.federation.enabled=true",
      "app.federation.authorized-fetch=true",
      "app.federation.handle-domain=shelfy.test",
      "app.federation.server-url=http://localhost",
      "app.federation.dev-mode=true"
    })
@AutoConfigureMockMvc
class AuthorizedFetchIntegrationTest {

  @Autowired private MockMvc mockMvc;
  @Autowired private UserRepository users;
  @Autowired private ActorStore actorStore;
  @MockitoBean private FederationJobs federationJobs;

  private RemoteStub remote;
  private UserEntity local;

  @BeforeEach
  void setUp() throws IOException {
    remote = new RemoteStub(keyId -> actorStore.localKey(UUID.randomUUID()).publicPem());
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
  void unsignedReadsOfProfilesAreRefused() throws Exception {
    mockMvc
        .perform(get("/ap/users/{id}", local.getId()))
        .andExpect(status().isUnauthorized())
        .andExpect(
            org.springframework.test.web.servlet.result.MockMvcResultMatchers.header()
                .exists("WWW-Authenticate"));
  }

  @Test
  void percentEncodedPathsStillNeedASignature() throws Exception {
    mockMvc
        .perform(get(URI.create("/%61p/users/" + local.getId())))
        .andExpect(status().isUnauthorized());
  }

  @Test
  void signedReadsAreServed() throws Exception {
    signed("/ap/users/" + local.getId())
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.id").value("http://localhost/ap/users/" + local.getId()));
  }

  @Test
  void aSignatureFromAnUnknownKeyIsRefused() throws Exception {
    URI uri = URI.create("http://localhost/ap/users/" + local.getId());
    Map<String, String> headers =
        HttpSignatures.sign(
            "GET",
            uri,
            null,
            "http://" + remote.authority() + "/users/ghost#main-key",
            remote.keys.getPrivate(),
            Instant.now());
    MockHttpServletRequestBuilder request = get(uri.getPath()).header("Host", "localhost");
    headers.forEach(request::header);

    mockMvc.perform(request).andExpect(status().isUnauthorized());
  }

  @Test
  void theInstanceActorStaysPublicSoOtherServersCanCheckOurSignatures() throws Exception {
    mockMvc.perform(get("/ap/actor")).andExpect(status().isOk());
  }

  @Test
  void discoveryIsNotAffected() throws Exception {
    mockMvc.perform(get("/.well-known/nodeinfo")).andExpect(status().isOk());
  }

  private ResultActions signed(String path) throws Exception {
    URI uri = URI.create("http://localhost" + path);
    Map<String, String> headers =
        HttpSignatures.sign(
            "GET",
            uri,
            null,
            remote.actorUri() + "#main-key",
            remote.keys.getPrivate(),
            Instant.now());
    MockHttpServletRequestBuilder request = get(path).header("Host", "localhost");
    headers.forEach(request::header);
    return mockMvc.perform(request);
  }
}
