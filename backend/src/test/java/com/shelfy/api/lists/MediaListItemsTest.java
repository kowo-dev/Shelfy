package com.shelfy.api.lists;

import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.nullValue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.shelfy.api.auth.CollectionVisibility;
import com.shelfy.api.auth.JwtService;
import com.shelfy.api.auth.UserEntity;
import com.shelfy.api.auth.UserRepository;
import com.shelfy.api.collection.CanonicalWorkEntity;
import com.shelfy.api.collection.CanonicalWorkRepository;
import com.shelfy.api.collection.MediaEntity;
import com.shelfy.api.collection.MediaRepository;
import com.shelfy.api.collection.MediaResolver;
import com.shelfy.api.collection.MediaType;
import com.shelfy.api.collection.dto.MediaReferenceDto;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class MediaListItemsTest {

  @Autowired private MockMvc mockMvc;
  @Autowired private JwtService jwtService;
  @Autowired private UserRepository users;
  @Autowired private MediaListRepository lists;
  @Autowired private MediaListCollaboratorRepository collaborators;
  @Autowired private CanonicalWorkRepository works;
  @Autowired private MediaRepository medias;

  @MockitoBean private MediaResolver resolver;

  private final Map<String, MediaEntity> fixtures = new HashMap<>();

  @BeforeEach
  void resolveFixtures() {
    when(resolver.findOrCreateAll(anyList()))
        .thenAnswer(
            call ->
                call.<List<MediaReferenceDto>>getArgument(0).stream()
                    .map(reference -> fixtures.get(reference.externalId()))
                    .toList());
    when(resolver.findExisting(anyString(), any(), anyString()))
        .thenAnswer(call -> Optional.ofNullable(fixtures.get(call.<String>getArgument(2))));
  }

  @Test
  void eachTitle_creditsWhoAddedIt() throws Exception {
    UserEntity owner = user();
    UserEntity coAuthor = user();
    MediaEntity first = media();
    MediaEntity second = media();
    MediaListEntity list = list(owner);
    list.appendItem(first, owner.getId());
    list.appendItem(second, coAuthor.getId());
    lists.saveAndFlush(list);

    mockMvc
        .perform(get("/api/v1/lists/{id}", list.getId()).header("Authorization", token(owner)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.items[0].mediaId").value(first.getId().toString()))
        .andExpect(jsonPath("$.items[0].addedBy.username").value(owner.getUsername()))
        .andExpect(jsonPath("$.items[1].mediaId").value(second.getId().toString()))
        .andExpect(jsonPath("$.items[1].addedBy.userId").value(coAuthor.getId().toString()));
  }

  @Test
  void coAuthor_addsSeveralTitlesAtOnce_skippingThoseAlreadyThere() throws Exception {
    UserEntity owner = user();
    UserEntity coAuthor = user();
    MediaEntity existing = media();
    MediaEntity fresh = media();
    MediaListEntity list = list(owner);
    list.appendItem(existing);
    lists.saveAndFlush(list);
    accept(list, coAuthor);

    mockMvc
        .perform(
            post("/api/v1/lists/{id}/items/batch", list.getId())
                .header("Authorization", token(coAuthor))
                .contentType(org.springframework.http.MediaType.APPLICATION_JSON)
                .content("{\"media\":[" + reference(existing) + "," + reference(fresh) + "]}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.media.length()").value(2))
        .andExpect(jsonPath("$.items[0].addedBy.userId").value(owner.getId().toString()))
        .andExpect(jsonPath("$.items[1].mediaId").value(fresh.getId().toString()))
        .andExpect(jsonPath("$.items[1].addedBy.userId").value(coAuthor.getId().toString()));
  }

  @Test
  void removingTitles_ignoresOnesAlreadyGone() throws Exception {
    UserEntity owner = user();
    UserEntity coAuthor = user();
    MediaEntity kept = media();
    MediaEntity dropped = media();
    MediaListEntity list = list(owner);
    list.appendItem(kept);
    list.appendItem(dropped);
    lists.saveAndFlush(list);
    accept(list, coAuthor);

    mockMvc
        .perform(
            post("/api/v1/lists/{id}/items/remove", list.getId())
                .header("Authorization", token(coAuthor))
                .contentType(org.springframework.http.MediaType.APPLICATION_JSON)
                .content(ids(dropped.getId(), UUID.randomUUID())))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.media.length()").value(1))
        .andExpect(jsonPath("$.media[0].id").value(kept.getId().toString()));
  }

  @Test
  void strangers_cannotChangeTheTitles() throws Exception {
    MediaEntity media = media();
    MediaListEntity list = list(user());
    list.appendItem(media);
    lists.saveAndFlush(list);

    mockMvc
        .perform(
            post("/api/v1/lists/{id}/items/remove", list.getId())
                .header("Authorization", token(user()))
                .contentType(org.springframework.http.MediaType.APPLICATION_JSON)
                .content(ids(media.getId())))
        .andExpect(status().isForbidden());
  }

  @Test
  void reorder_appliesTheFullOrder() throws Exception {
    UserEntity owner = user();
    MediaEntity a = media();
    MediaEntity b = media();
    MediaEntity c = media();
    MediaListEntity list = list(owner);
    List.of(a, b, c).forEach(list::appendItem);
    lists.saveAndFlush(list);

    mockMvc
        .perform(
            put("/api/v1/lists/{id}/items/order", list.getId())
                .header("Authorization", token(owner))
                .contentType(org.springframework.http.MediaType.APPLICATION_JSON)
                .content(ids(c.getId(), a.getId(), b.getId())))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.media[0].id").value(c.getId().toString()))
        .andExpect(jsonPath("$.media[1].id").value(a.getId().toString()))
        .andExpect(jsonPath("$.media[2].id").value(b.getId().toString()));
    lists.flush();
  }

  @Test
  void reorder_fromAStaleView_isAConflict() throws Exception {
    UserEntity owner = user();
    MediaEntity a = media();
    MediaEntity b = media();
    MediaListEntity list = list(owner);
    List.of(a, b).forEach(list::appendItem);
    lists.saveAndFlush(list);

    mockMvc
        .perform(
            put("/api/v1/lists/{id}/items/order", list.getId())
                .header("Authorization", token(owner))
                .contentType(org.springframework.http.MediaType.APPLICATION_JSON)
                .content(ids(b.getId())))
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.code").value("LIST_ORDER_STALE"));
  }

  @Test
  void detailsUpdate_leavesTheTitlesAlone() throws Exception {
    UserEntity owner = user();
    MediaEntity media = media();
    MediaListEntity list = list(owner);
    list.appendItem(media);
    lists.saveAndFlush(list);

    mockMvc
        .perform(
            patch("/api/v1/lists/{id}", list.getId())
                .header("Authorization", token(owner))
                .contentType(org.springframework.http.MediaType.APPLICATION_JSON)
                .content(
                    "{\"name\":\"Renamed\",\"visibility\":\"public\",\"tags\":[\"cosy\",\"rain\"]}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.name").value("Renamed"))
        .andExpect(jsonPath("$.tags.length()").value(2))
        .andExpect(jsonPath("$.media.length()").value(1));
  }

  @Test
  void detailsUpdate_isForTheOwnerOnly() throws Exception {
    UserEntity owner = user();
    UserEntity coAuthor = user();
    MediaListEntity list = list(owner);
    accept(list, coAuthor);

    mockMvc
        .perform(
            patch("/api/v1/lists/{id}", list.getId())
                .header("Authorization", token(coAuthor))
                .contentType(org.springframework.http.MediaType.APPLICATION_JSON)
                .content("{\"name\":\"Mine now\",\"visibility\":\"public\"}"))
        .andExpect(status().isForbidden());
  }

  @Test
  void adding_pastTheCap_isRefused() throws Exception {
    UserEntity owner = user();
    MediaListEntity list = list(owner);
    for (int i = 0; i < 200; i++) {
      list.appendItem(media());
    }
    lists.saveAndFlush(list);

    mockMvc
        .perform(
            post("/api/v1/lists/{id}/items/batch", list.getId())
                .header("Authorization", token(owner))
                .contentType(org.springframework.http.MediaType.APPLICATION_JSON)
                .content("{\"media\":[" + reference(media()) + "]}"))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("LIST_TOO_LARGE"));
  }

  @Test
  void fullUpdate_keepsWhoAddedTheTitlesThatStay() throws Exception {
    UserEntity owner = user();
    UserEntity coAuthor = user();
    MediaEntity theirs = media();
    MediaListEntity list = list(owner);
    list.appendItem(theirs, coAuthor.getId());
    lists.saveAndFlush(list);

    mockMvc
        .perform(
            put("/api/v1/lists/{id}", list.getId())
                .header("Authorization", token(owner))
                .contentType(org.springframework.http.MediaType.APPLICATION_JSON)
                .content(
                    "{\"name\":\"Comfort picks\",\"visibility\":\"private\",\"tags\":[],"
                        + "\"media\":["
                        + reference(theirs)
                        + "]}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.items[0].addedBy.userId").value(coAuthor.getId().toString()));
  }

  @Test
  void editable_listsWhatTheViewerOwnsOrCoAuthors_andWhetherItHoldsTheTitle() throws Exception {
    UserEntity me = user();
    UserEntity friend = user();
    MediaEntity title = media();
    MediaListEntity mine = list(me);
    mine.appendItem(title);
    lists.saveAndFlush(mine);
    MediaListEntity shared = list(friend);
    accept(shared, me);
    list(friend);

    mockMvc
        .perform(
            get("/api/v1/lists/editable")
                .header("Authorization", token(me))
                .param("provider", title.getProvider())
                .param("mediaType", title.getMediaType().getValue())
                .param("externalId", title.getExternalId()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.length()").value(2))
        .andExpect(
            jsonPath("$[?(@.id == '%s')].containedId", mine.getId())
                .value(title.getId().toString()))
        .andExpect(jsonPath("$[?(@.id == '%s')].isOwner", shared.getId()).value(false))
        .andExpect(
            jsonPath("$[?(@.id == '%s')].containedId", shared.getId()).value(hasItem(nullValue())));
  }

  private void accept(MediaListEntity list, UserEntity user) {
    MediaListCollaboratorEntity collaborator =
        new MediaListCollaboratorEntity(list, user.getId(), list.getUserId());
    collaborator.accept();
    collaborators.saveAndFlush(collaborator);
  }

  private MediaListEntity list(UserEntity owner) {
    return lists.saveAndFlush(
        new MediaListEntity(
            owner.getId(),
            "Comfort picks",
            null,
            CollectionVisibility.PRIVATE,
            new LinkedHashSet<>()));
  }

  private MediaEntity media() {
    CanonicalWorkEntity work = works.saveAndFlush(new CanonicalWorkEntity(MediaType.MOVIE));
    MediaEntity media =
        medias.saveAndFlush(
            new MediaEntity(
                UUID.randomUUID().toString(),
                "tmdb",
                MediaType.MOVIE,
                work,
                "Title",
                null,
                Map.of(),
                false));
    fixtures.put(media.getExternalId(), media);
    return media;
  }

  private static String reference(MediaEntity media) {
    return "{\"provider\":\""
        + media.getProvider()
        + "\",\"mediaType\":\""
        + media.getMediaType().getValue()
        + "\",\"externalId\":\""
        + media.getExternalId()
        + "\"}";
  }

  private static String ids(UUID... ids) {
    return List.of(ids).stream()
        .map(id -> "\"" + id + "\"")
        .collect(Collectors.joining(",", "{\"mediaIds\":[", "]}"));
  }

  private String token(UserEntity user) {
    return "Bearer " + jwtService.generateAccessToken(user);
  }

  private UserEntity user() {
    String name = "u" + UUID.randomUUID().toString().substring(0, 12);
    return users.saveAndFlush(new UserEntity(name + "@example.com", name, "hash"));
  }
}
