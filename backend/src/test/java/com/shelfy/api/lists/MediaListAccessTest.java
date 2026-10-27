package com.shelfy.api.lists;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.shelfy.api.auth.CollectionVisibility;
import com.shelfy.api.auth.JwtService;
import com.shelfy.api.auth.UserEntity;
import com.shelfy.api.auth.UserRepository;
import com.shelfy.api.follows.FollowEntity;
import com.shelfy.api.follows.FollowRepository;
import java.util.LinkedHashSet;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class MediaListAccessTest {

  @Autowired private MockMvc mockMvc;
  @Autowired private JwtService jwtService;
  @Autowired private UserRepository users;
  @Autowired private MediaListRepository lists;
  @Autowired private MediaListCollaboratorRepository collaborators;
  @Autowired private FollowRepository follows;

  @Test
  void stranger_cannotReadAPrivateListNorItsCollaborators() throws Exception {
    UserEntity owner = user();
    UserEntity stranger = user();
    MediaListEntity hidden =
        lists.saveAndFlush(
            new MediaListEntity(
                owner.getId(),
                "hidden",
                null,
                CollectionVisibility.PRIVATE,
                new LinkedHashSet<>()));
    String token = "Bearer " + jwtService.generateAccessToken(stranger);

    mockMvc
        .perform(get("/api/v1/lists/{id}", hidden.getId()).header("Authorization", token))
        .andExpect(status().isNotFound());
    mockMvc
        .perform(
            get("/api/v1/lists/{id}/collaborators", hidden.getId()).header("Authorization", token))
        .andExpect(status().is4xxClientError());
  }

  @Test
  void acceptedCollaborator_canReadAndWriteTheCommentsOfAPrivateList() throws Exception {
    UserEntity owner = user();
    UserEntity collaborator = user();
    MediaListEntity hidden = privateList(owner);
    MediaListCollaboratorEntity invite =
        new MediaListCollaboratorEntity(hidden, collaborator.getId(), owner.getId());
    invite.accept();
    collaborators.saveAndFlush(invite);
    String token = "Bearer " + jwtService.generateAccessToken(collaborator);

    mockMvc
        .perform(get("/api/v1/lists/{id}", hidden.getId()).header("Authorization", token))
        .andExpect(status().isOk());
    mockMvc
        .perform(get("/api/v1/lists/{id}/comments", hidden.getId()).header("Authorization", token))
        .andExpect(status().isOk());
    mockMvc
        .perform(
            post("/api/v1/lists/{id}/comments", hidden.getId())
                .header("Authorization", token)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"content\": \"Added two more\"}"))
        .andExpect(status().is2xxSuccessful());
  }

  @Test
  void owner_canOnlyInvitePeopleWhoFollowThem() throws Exception {
    UserEntity owner = user();
    UserEntity follower = user();
    UserEntity stranger = user();
    follows.saveAndFlush(new FollowEntity(follower.getId(), owner.getId()));
    MediaListEntity list = privateList(owner);
    String token = "Bearer " + jwtService.generateAccessToken(owner);

    mockMvc
        .perform(
            post("/api/v1/lists/{id}/collaborators", list.getId())
                .header("Authorization", token)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"userId\": \"" + stranger.getId() + "\"}"))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("LIST_COLLABORATOR_MUST_FOLLOW"));
    mockMvc
        .perform(
            post("/api/v1/lists/{id}/collaborators", list.getId())
                .header("Authorization", token)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"userId\": \"" + follower.getId() + "\"}"))
        .andExpect(status().is2xxSuccessful());
  }

  private MediaListEntity privateList(UserEntity owner) {
    return lists.saveAndFlush(
        new MediaListEntity(
            owner.getId(), "hidden", null, CollectionVisibility.PRIVATE, new LinkedHashSet<>()));
  }

  @Test
  void profileLists_distinguishUnknownUserFromPrivateProfile() throws Exception {
    UserEntity hiddenOwner = user();
    hiddenOwner.setProfileVisibility(CollectionVisibility.PRIVATE);
    users.saveAndFlush(hiddenOwner);

    mockMvc
        .perform(get("/api/v1/lists/profile/{username}", hiddenOwner.getUsername()))
        .andExpect(status().isForbidden())
        .andExpect(jsonPath("$.code").value("PROFILE_PRIVATE"));
    mockMvc
        .perform(get("/api/v1/lists/profile/{username}", "nobody" + UUID.randomUUID()))
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.code").value("USER_NOT_FOUND"));
  }

  private UserEntity user() {
    String name = "u" + UUID.randomUUID().toString().substring(0, 12);
    return users.saveAndFlush(new UserEntity(name + "@example.com", name, "hash"));
  }
}
