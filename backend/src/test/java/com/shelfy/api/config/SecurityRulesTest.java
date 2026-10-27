package com.shelfy.api.config;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
class SecurityRulesTest {

  @Autowired private MockMvc mockMvc;

  @Test
  void privateEndpoints_rejectRequestsWithoutAToken() throws Exception {
    mockMvc.perform(get("/api/v1/users/me")).andExpect(status().isUnauthorized());
    mockMvc.perform(delete("/api/v1/users/me")).andExpect(status().isUnauthorized());
    mockMvc.perform(get("/api/v1/users/me/export")).andExpect(status().isUnauthorized());
    mockMvc.perform(patch("/api/v1/users/me")).andExpect(status().isUnauthorized());
    mockMvc.perform(get("/api/v1/collection")).andExpect(status().isUnauthorized());
    mockMvc.perform(post("/api/v1/steam/import")).andExpect(status().isUnauthorized());
    mockMvc
        .perform(get("/api/v1/users/camille_rousseau/collection/common"))
        .andExpect(status().isUnauthorized());
    mockMvc
        .perform(get("/api/v1/users/camille_rousseau/compare"))
        .andExpect(status().isUnauthorized());
    mockMvc.perform(post("/api/v1/lists")).andExpect(status().isUnauthorized());
  }

  @Test
  void publicBrowseEndpoints_doNotRequireAToken() throws Exception {
    mockMvc.perform(get("/api/v1/lists")).andExpect(status().isOk());
    mockMvc.perform(get("/api/v1/lists/profile/nobody")).andExpect(status().isNotFound());
    mockMvc.perform(get("/api/v1/versus/pools/profile/nobody")).andExpect(status().isNotFound());
  }
}
