package com.shelfy.api.versus;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
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
import com.shelfy.api.collection.MediaType;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class VersusPoolItemsTest {

  @Autowired private MockMvc mockMvc;
  @Autowired private JwtService jwtService;
  @Autowired private UserRepository users;
  @Autowired private VersusPoolRepository pools;
  @Autowired private VersusPoolCollaboratorRepository collaborators;
  @Autowired private CanonicalWorkRepository works;
  @Autowired private MediaRepository medias;

  @Test
  void eachEntry_creditsWhoAddedIt() throws Exception {
    UserEntity owner = user();
    UserEntity coAuthor = user();
    VersusPoolEntity pool = pool(owner);
    pool.appendItem(media());
    pool.appendItem(media(), coAuthor.getId());
    pools.saveAndFlush(pool);

    mockMvc
        .perform(
            get("/api/v1/versus/pools/{id}", pool.getId()).header("Authorization", token(owner)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.entries[?(@.addedBy.userId == '%s')]", owner.getId()).exists())
        .andExpect(
            jsonPath("$.entries[?(@.addedBy.username == '%s')]", coAuthor.getUsername()).exists());
  }

  @Test
  void coAuthor_removesSeveralEntries_ignoringOnesAlreadyGone() throws Exception {
    UserEntity owner = user();
    UserEntity coAuthor = user();
    VersusPoolEntity pool = pool(owner);
    MediaEntity keptMedia = media();
    MediaEntity droppedMedia = media();
    pool.appendItem(keptMedia);
    pool.appendItem(droppedMedia);
    pool = pools.saveAndFlush(pool);
    VersusPoolItemEntity kept = entryFor(pool, keptMedia);
    VersusPoolItemEntity dropped = entryFor(pool, droppedMedia);
    VersusPoolCollaboratorEntity collaborator =
        new VersusPoolCollaboratorEntity(pool, coAuthor.getId(), owner.getId());
    collaborator.accept();
    collaborators.saveAndFlush(collaborator);

    mockMvc
        .perform(
            post("/api/v1/versus/pools/{id}/items/remove", pool.getId())
                .header("Authorization", token(coAuthor))
                .contentType(org.springframework.http.MediaType.APPLICATION_JSON)
                .content(
                    "{\"entryIds\":[\"" + dropped.getId() + "\",\"" + UUID.randomUUID() + "\"]}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.entries.length()").value(1))
        .andExpect(jsonPath("$.entries[0].id").value(kept.getId().toString()));
  }

  @Test
  void strangers_cannotRemoveEntries() throws Exception {
    VersusPoolEntity pool = pool(user());
    MediaEntity media = media();
    pool.appendItem(media);
    VersusPoolItemEntity entry = entryFor(pools.saveAndFlush(pool), media);

    mockMvc
        .perform(
            post("/api/v1/versus/pools/{id}/items/remove", pool.getId())
                .header("Authorization", token(user()))
                .contentType(org.springframework.http.MediaType.APPLICATION_JSON)
                .content("{\"entryIds\":[\"" + entry.getId() + "\"]}"))
        .andExpect(status().isForbidden());
  }

  @Test
  void editable_flagsPoolsMadeOfClips() throws Exception {
    UserEntity me = user();
    VersusPoolEntity titles = pool(me);
    titles.appendItem(media());
    pools.saveAndFlush(titles);
    VersusPoolEntity empty = pool(me);

    mockMvc
        .perform(get("/api/v1/versus/pools/editable").header("Authorization", token(me)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.length()").value(2))
        .andExpect(jsonPath("$[?(@.id == '%s')].hasClips", titles.getId()).value(false))
        .andExpect(jsonPath("$[?(@.id == '%s')].itemCount", empty.getId()).value(0));
  }

  private static VersusPoolItemEntity entryFor(VersusPoolEntity pool, MediaEntity media) {
    return pool.getItems().stream()
        .filter(item -> item.getMedia().getId().equals(media.getId()))
        .findFirst()
        .orElseThrow();
  }

  private VersusPoolEntity pool(UserEntity owner) {
    return pools.saveAndFlush(
        new VersusPoolEntity(owner.getId(), "Best duels", null, CollectionVisibility.PRIVATE));
  }

  private MediaEntity media() {
    CanonicalWorkEntity work = works.saveAndFlush(new CanonicalWorkEntity(MediaType.MOVIE));
    return medias.saveAndFlush(
        new MediaEntity(
            UUID.randomUUID().toString(),
            "tmdb",
            MediaType.MOVIE,
            work,
            "Title",
            null,
            Map.of(),
            false));
  }

  private String token(UserEntity user) {
    return "Bearer " + jwtService.generateAccessToken(user);
  }

  private UserEntity user() {
    String name = "u" + UUID.randomUUID().toString().substring(0, 12);
    return users.saveAndFlush(new UserEntity(name + "@example.com", name, "hash"));
  }
}
