package com.shelfy.api.federation;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.shelfy.api.auth.CollectionVisibility;
import com.shelfy.api.auth.UserEntity;
import com.shelfy.api.auth.UserRepository;
import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest(
    properties = {
      "app.federation.enabled=true",
      "app.federation.handle-domain=shelfy.test",
      "app.federation.server-url=http://localhost",
      "app.federation.dev-mode=true"
    })
@AutoConfigureMockMvc
class RemoteFollowIntegrationTest {

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
  void sendsTheVisitorToTheirOwnServerWithTheProfileToFollow() throws Exception {
    String actor =
        URLEncoder.encode("http://localhost/ap/users/" + local.getId(), StandardCharsets.UTF_8);

    mockMvc
        .perform(
            get("/api/v1/federation/remote-follow")
                .param("handle", "@" + remote.handle())
                .param("username", local.getUsername()))
        .andExpect(status().isOk())
        .andExpect(
            jsonPath("$.url")
                .value("http://" + remote.authority() + "/authorize_interaction?uri=" + actor));
  }

  @Test
  void refusesAnAddressOnThisServer() throws Exception {
    mockMvc
        .perform(
            get("/api/v1/federation/remote-follow")
                .param("handle", "@someone@shelfy.test")
                .param("username", local.getUsername()))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("REMOTE_FOLLOW_INVALID_ADDRESS"));
  }

  @Test
  void refusesAMalformedAddress() throws Exception {
    mockMvc
        .perform(
            get("/api/v1/federation/remote-follow")
                .param("handle", "not-an-address")
                .param("username", local.getUsername()))
        .andExpect(status().isBadRequest());
  }

  @Test
  void hidesPrivateProfiles() throws Exception {
    local.setProfileVisibility(CollectionVisibility.PRIVATE);
    users.saveAndFlush(local);

    mockMvc
        .perform(
            get("/api/v1/federation/remote-follow")
                .param("handle", "@" + remote.handle())
                .param("username", local.getUsername()))
        .andExpect(status().isNotFound());
  }

  @Test
  void saysWhenTheAccountDoesNotExistOnTheirServer() throws Exception {
    remote.knowsNobody = true;

    mockMvc
        .perform(
            get("/api/v1/federation/remote-follow")
                .param("handle", "@" + remote.handle())
                .param("username", local.getUsername()))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("REMOTE_FOLLOW_ACCOUNT_NOT_FOUND"));
  }

  @Test
  void failsWhenTheVisitorsServerCannotBeReached() throws Exception {
    remote.close();

    mockMvc
        .perform(
            get("/api/v1/federation/remote-follow")
                .param("handle", "@" + remote.handle())
                .param("username", local.getUsername()))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("REMOTE_FOLLOW_SERVER_UNREACHABLE"));
  }
}
