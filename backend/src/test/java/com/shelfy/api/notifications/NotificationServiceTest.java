package com.shelfy.api.notifications;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import com.shelfy.api.auth.CollectionVisibility;
import com.shelfy.api.auth.JwtService;
import com.shelfy.api.auth.UserEntity;
import com.shelfy.api.auth.UserRepository;
import com.shelfy.api.lists.MediaListEntity;
import com.shelfy.api.lists.MediaListRepository;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

@SpringBootTest
@AutoConfigureMockMvc
class NotificationServiceTest {

  @Autowired private MockMvc mockMvc;
  @Autowired private JwtService jwtService;
  @Autowired private UserRepository users;
  @Autowired private MediaListRepository lists;

  @Test
  void likes_areGroupedPerCreationAndWithdrawnOnUnlike() throws Exception {
    UserEntity owner = user();
    UserEntity first = user();
    UserEntity second = user();
    UUID listId = list(owner);

    send(first, post("/api/v1/lists/" + listId + "/likes"));
    send(second, post("/api/v1/lists/" + listId + "/likes"));

    String body = send(owner, get("/api/v1/notifications"));
    assertThat(JsonPath.<List<String>>read(body, "$.content[*].type"))
        .containsExactly("CREATION_LIKED");
    assertThat(JsonPath.<Integer>read(body, "$.content[0].actorCount")).isEqualTo(2);
    assertThat(JsonPath.<String>read(body, "$.content[0].actor.id"))
        .isEqualTo(second.getId().toString());
    assertThat(JsonPath.<String>read(body, "$.content[0].payload.title")).isEqualTo("Favourites");
    assertThat(unread(owner)).isEqualTo(1);

    send(second, delete("/api/v1/lists/" + listId + "/likes"));
    body = send(owner, get("/api/v1/notifications"));
    assertThat(JsonPath.<Integer>read(body, "$.content[0].actorCount")).isEqualTo(1);
    assertThat(JsonPath.<String>read(body, "$.content[0].actor.id"))
        .isEqualTo(first.getId().toString());

    send(first, delete("/api/v1/lists/" + listId + "/likes"));
    assertThat(JsonPath.<List<String>>read(send(owner, get("/api/v1/notifications")), "$.content"))
        .isEmpty();
  }

  @Test
  void clear_removesOneNotificationThenTheHistoryButKeepsOpenRequests() throws Exception {
    UserEntity owner = user();
    UserEntity fan = user();
    UserEntity other = user();
    UUID listId = list(owner);
    UUID otherList = list(other);
    send(owner, post("/api/v1/follows/" + other.getId()));
    send(other, post("/api/v1/follows/" + owner.getId()));
    send(fan, post("/api/v1/lists/" + listId + "/likes"));
    send(
        other,
        post("/api/v1/lists/" + otherList + "/collaborators")
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"userId\": \"" + owner.getId() + "\"}"));

    String liked = JsonPath.read(send(owner, get("/api/v1/notifications")), "$.content[0].id");
    send(owner, delete("/api/v1/notifications/" + liked));
    assertThat(types(owner)).doesNotContain("CREATION_LIKED").isNotEmpty();

    send(owner, delete("/api/v1/notifications"));
    assertThat(types(owner)).isEmpty();
    assertThat(
            JsonPath.<List<String>>read(
                send(owner, get("/api/v1/notifications/requests")), "$[*].type"))
        .hasSize(1);

    String request = JsonPath.read(send(owner, get("/api/v1/notifications/requests")), "$[0].id");
    mockMvc
        .perform(
            delete("/api/v1/notifications/" + request)
                .header("Authorization", "Bearer " + jwtService.generateAccessToken(owner)))
        .andExpect(status().isNotFound());
    mockMvc
        .perform(
            delete("/api/v1/notifications/" + request)
                .header("Authorization", "Bearer " + jwtService.generateAccessToken(fan)))
        .andExpect(status().isNotFound());
  }

  @Test
  void creationNotifications_showTheCurrentNameAfterARename() throws Exception {
    UserEntity owner = user();
    UserEntity fan = user();
    UUID listId = list(owner);
    send(fan, post("/api/v1/lists/" + listId + "/likes"));

    send(
        owner,
        patch("/api/v1/lists/" + listId)
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"name\": \"Rainy evenings\", \"visibility\": \"public\", \"tags\": []}"));

    String body = send(owner, get("/api/v1/notifications"));
    assertThat(JsonPath.<String>read(body, "$.content[0].payload.title"))
        .isEqualTo("Rainy evenings");
  }

  @Test
  void likes_doNotNotifyTwiceForTheSamePersonOnceRead() throws Exception {
    UserEntity owner = user();
    UserEntity fan = user();
    UUID listId = list(owner);

    send(fan, post("/api/v1/lists/" + listId + "/likes"));
    send(owner, put("/api/v1/notifications/read-all"));
    send(fan, delete("/api/v1/lists/" + listId + "/likes"));
    send(fan, post("/api/v1/lists/" + listId + "/likes"));

    assertThat(unread(owner)).isZero();
  }

  @Test
  void preferences_silenceAFamilyAndStrangers() throws Exception {
    UserEntity owner = user();
    UserEntity stranger = user();
    UserEntity followed = user();
    send(owner, post("/api/v1/follows/" + followed.getId()));

    send(
        owner,
        put("/api/v1/notifications/preferences")
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"audience\": \"CONNECTIONS\"}"));
    send(stranger, post("/api/v1/follows/" + owner.getId()));
    send(followed, post("/api/v1/follows/" + owner.getId()));

    String body = send(owner, get("/api/v1/notifications"));
    assertThat(JsonPath.<List<String>>read(body, "$.content[*].actor.id"))
        .containsExactly(followed.getId().toString());

    send(
        owner,
        put("/api/v1/notifications/preferences")
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"families\": {\"LIKES\": false}}"));
    send(followed, post("/api/v1/lists/" + list(owner) + "/likes"));
    assertThat(JsonPath.<List<String>>read(send(owner, get("/api/v1/notifications")), "$.content"))
        .hasSize(1);
  }

  @Test
  void preferences_listDefaultsWithoutModerationForMembers() throws Exception {
    String body = send(user(), get("/api/v1/notifications/preferences"));

    assertThat(JsonPath.<String>read(body, "$.audience")).isEqualTo("EVERYONE");
    assertThat(JsonPath.<List<String>>read(body, "$.families[*].family"))
        .doesNotContain("MODERATION")
        .contains("RELATIONS", "COMMENTS", "LIKES", "FEDIVERSE");
    assertThat(
            JsonPath.<List<Boolean>>read(
                body, "$.families[*].settings[?(@.setting == 'THREAD_ACTIVITY')].isEnabled"))
        .containsExactly(false);
    assertThat(
            JsonPath.<List<Boolean>>read(
                body, "$.families[*].settings[?(@.setting == 'COLLABORATION_CHANGES')].isEnabled"))
        .containsExactly(true);
  }

  @Test
  void comments_notifyTheParentAuthorAndTheOwnerOnce() throws Exception {
    UserEntity owner = user();
    UserEntity first = user();
    UserEntity replier = user();
    UserEntity bystander = user();
    UUID listId = list(owner);

    String parent =
        send(
            first,
            post("/api/v1/lists/" + listId + "/comments")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"content\": \"Great list\"}"));
    send(
        bystander,
        post("/api/v1/lists/" + listId + "/comments")
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"content\": \"Agreed\"}"));
    send(
        replier,
        post("/api/v1/lists/" + listId + "/comments")
            .contentType(MediaType.APPLICATION_JSON)
            .content(
                "{\"content\": \"Not sure\", \"parentCommentId\": \""
                    + JsonPath.read(parent, "$.id")
                    + "\"}"));

    assertThat(types(first)).containsExactly("COMMENT_REPLY");
    assertThat(types(owner))
        .containsExactly("COMMENT_ON_CREATION", "COMMENT_ON_CREATION", "COMMENT_ON_CREATION");
    assertThat(types(bystander)).isEmpty();
    String firstSummary = send(first, get("/api/v1/notifications/summary"));
    assertThat(JsonPath.<Integer>read(firstSummary, "$.total")).isEqualTo(1);
    assertThat(JsonPath.<Integer>read(firstSummary, "$.personal")).isEqualTo(1);
    assertThat(JsonPath.<Integer>read(firstSummary, "$.families.COMMENTS")).isEqualTo(1);
    String ownerSummary = send(owner, get("/api/v1/notifications/summary"));
    assertThat(JsonPath.<Integer>read(ownerSummary, "$.total")).isEqualTo(3);
    assertThat(JsonPath.<Integer>read(ownerSummary, "$.personal")).isZero();
    send(owner, put("/api/v1/notifications/read-all"));
    String readSummary = send(owner, get("/api/v1/notifications/summary"));
    assertThat(JsonPath.<Integer>read(readSummary, "$.total")).isZero();
    assertThat(JsonPath.<Integer>read(readSummary, "$.all")).isEqualTo(3);
    assertThat(JsonPath.<Integer>read(readSummary, "$.totals.COMMENTS")).isEqualTo(3);
    String body = send(first, get("/api/v1/notifications"));
    assertThat(JsonPath.<String>read(body, "$.content[0].payload.excerpt")).isEqualTo("Not sure");
    assertThat(JsonPath.<String>read(body, "$.content[0].payload.listId"))
        .isEqualTo(listId.toString());
  }

  private List<String> types(UserEntity user) throws Exception {
    return JsonPath.read(send(user, get("/api/v1/notifications")), "$.content[*].type");
  }

  private long unread(UserEntity user) throws Exception {
    return JsonPath.<Integer>read(send(user, get("/api/v1/notifications/summary")), "$.total");
  }

  private String send(UserEntity user, MockHttpServletRequestBuilder request) throws Exception {
    return mockMvc
        .perform(request.header("Authorization", "Bearer " + jwtService.generateAccessToken(user)))
        .andExpect(status().is2xxSuccessful())
        .andReturn()
        .getResponse()
        .getContentAsString();
  }

  private UUID list(UserEntity owner) {
    return lists
        .saveAndFlush(
            new MediaListEntity(
                owner.getId(), "Favourites", null, CollectionVisibility.PUBLIC, Set.of()))
        .getId();
  }

  private UserEntity user() {
    String name = "n" + UUID.randomUUID().toString().substring(0, 12);
    UserEntity user = new UserEntity(name + "@example.com", name, "hash");
    user.setEmailVerified(true);
    return users.saveAndFlush(user);
  }
}
