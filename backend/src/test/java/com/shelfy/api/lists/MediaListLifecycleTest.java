package com.shelfy.api.lists;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.shelfy.api.auth.CollectionVisibility;
import com.shelfy.api.auth.JwtService;
import com.shelfy.api.auth.UserEntity;
import com.shelfy.api.auth.UserRepository;
import com.shelfy.api.comments.CommentRepository;
import com.shelfy.api.comments.CommentTargetType;
import java.util.LinkedHashSet;
import java.util.Set;
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
class MediaListLifecycleTest {

  @Autowired private MockMvc mockMvc;
  @Autowired private JwtService jwtService;
  @Autowired private UserRepository users;
  @Autowired private MediaListRepository lists;
  @Autowired private CommentRepository comments;

  @Test
  void owner_deletesTheirListAndItsDiscussion() throws Exception {
    UserEntity owner = user();
    MediaListEntity list = list(owner, CollectionVisibility.PUBLIC);
    mockMvc
        .perform(
            post("/api/v1/lists/{id}/comments", list.getId())
                .header("Authorization", token(owner))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"content\":\"first\"}"))
        .andExpect(status().isCreated());

    mockMvc
        .perform(delete("/api/v1/lists/{id}", list.getId()).header("Authorization", token(owner)))
        .andExpect(status().isNoContent());

    assertThat(lists.findById(list.getId())).isEmpty();
    assertThat(comments.findByTargetTypeAndTargetId(CommentTargetType.LIST, list.getId()))
        .isEmpty();
  }

  @Test
  void someoneElse_cannotDeleteAList() throws Exception {
    UserEntity owner = user();
    MediaListEntity list = list(owner, CollectionVisibility.PUBLIC);

    mockMvc
        .perform(delete("/api/v1/lists/{id}", list.getId()).header("Authorization", token(user())))
        .andExpect(status().isForbidden());
    assertThat(lists.findById(list.getId())).isPresent();
  }

  @Test
  void duplicate_makesAPrivateCopyThatCreditsTheOriginal() throws Exception {
    UserEntity owner = user();
    UserEntity reader = user();
    MediaListEntity list = list(owner, CollectionVisibility.PUBLIC);

    String body =
        mockMvc
            .perform(
                post("/api/v1/lists/{id}/duplicate", list.getId())
                    .header("Authorization", token(reader))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"name\":\"My take\"}"))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.name").value("My take"))
            .andExpect(jsonPath("$.userId").value(reader.getId().toString()))
            .andExpect(jsonPath("$.visibility").value("private"))
            .andExpect(jsonPath("$.tags[0]").value("cosy"))
            .andExpect(jsonPath("$.source.id").value(list.getId().toString()))
            .andExpect(jsonPath("$.source.creatorUsername").value(owner.getUsername()))
            .andReturn()
            .getResponse()
            .getContentAsString();

    assertThat(body).contains("\"description\":\"Rainy days\"");
  }

  @Test
  void duplicate_ofAListTheViewerCannotSee_isNotFound() throws Exception {
    MediaListEntity hidden = list(user(), CollectionVisibility.PRIVATE);

    mockMvc
        .perform(
            post("/api/v1/lists/{id}/duplicate", hidden.getId())
                .header("Authorization", token(user())))
        .andExpect(status().isNotFound());
  }

  @Test
  void copy_hidesItsSourceOnceTheSourceIsNoLongerVisible() throws Exception {
    UserEntity owner = user();
    UserEntity reader = user();
    MediaListEntity list = list(owner, CollectionVisibility.PUBLIC);
    MediaListEntity copy = list(reader, CollectionVisibility.PRIVATE);
    copy.copiedFrom(list.getId());
    lists.saveAndFlush(copy);
    list.update(list.getName(), list.getDescription(), CollectionVisibility.PRIVATE, Set.of());
    lists.saveAndFlush(list);

    mockMvc
        .perform(get("/api/v1/lists/{id}", copy.getId()).header("Authorization", token(reader)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.source").doesNotExist());
  }

  private MediaListEntity list(UserEntity owner, CollectionVisibility visibility) {
    return lists.saveAndFlush(
        new MediaListEntity(
            owner.getId(),
            "Comfort picks",
            "Rainy days",
            visibility,
            new LinkedHashSet<>(Set.of("cosy"))));
  }

  private String token(UserEntity user) {
    return "Bearer " + jwtService.generateAccessToken(user);
  }

  private UserEntity user() {
    String name = "u" + UUID.randomUUID().toString().substring(0, 12);
    return users.saveAndFlush(new UserEntity(name + "@example.com", name, "hash"));
  }
}
