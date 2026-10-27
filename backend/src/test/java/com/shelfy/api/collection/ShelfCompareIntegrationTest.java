package com.shelfy.api.collection;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.shelfy.api.auth.CollectionVisibility;
import com.shelfy.api.auth.JwtService;
import com.shelfy.api.auth.UserEntity;
import com.shelfy.api.auth.UserRepository;
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
class ShelfCompareIntegrationTest {

  @Autowired private MockMvc mockMvc;
  @Autowired private JwtService jwtService;
  @Autowired private UserRepository users;
  @Autowired private CanonicalWorkRepository works;
  @Autowired private MediaRepository medias;
  @Autowired private UserMediaRepository userMedias;

  @Test
  void countsCommonTitlesAveragesTheGapAndRanksBothLoved() throws Exception {
    UserEntity me = user();
    UserEntity them = user();
    shared(me, them, "Tight", 9, 9);
    shared(me, them, "Close", 10, 8);
    shared(me, them, "Far", 10, 8);
    shared(me, them, "Apart", 2, 9);
    shared(me, them, "Unrated", null, 9);
    userMedias.saveAndFlush(
        new UserMediaEntity(
            them.getId(), media(work(), "Theirs only"), UserMediaStatus.DONE, 10, Map.of()));
    userMedias.saveAndFlush(
        new UserMediaEntity(
            me.getId(), media(work(), "Mine only"), UserMediaStatus.DONE, 10, Map.of()));

    mockMvc
        .perform(
            get("/api/v1/users/{u}/compare", them.getUsername())
                .header("Authorization", bearer(me)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.commonCount").value(5))
        .andExpect(jsonPath("$.ratingGapAverage").value(2.75))
        .andExpect(jsonPath("$.bothLoved.length()").value(3))
        .andExpect(jsonPath("$.bothLoved[0].media.title").value("Tight"))
        .andExpect(jsonPath("$.bothLoved[0].theirRating").value(9))
        .andExpect(jsonPath("$.bothLoved[0].yourRating").value(9))
        .andExpect(jsonPath("$.bothLoved[1].media.title").value("Close"))
        .andExpect(jsonPath("$.bothLoved[2].media.title").value("Far"));
  }

  @Test
  void capsBothLovedAtFourAndReturnsNullGapWithoutRatings() throws Exception {
    UserEntity me = user();
    UserEntity them = user();
    for (int i = 0; i < 6; i++) {
      shared(me, them, "Loved " + i, 9, 9);
    }
    UserEntity other = user();
    shared(me, other, "Unrated pair", null, null);

    String token = bearer(me);
    mockMvc
        .perform(
            get("/api/v1/users/{u}/compare", them.getUsername()).header("Authorization", token))
        .andExpect(jsonPath("$.commonCount").value(6))
        .andExpect(jsonPath("$.bothLoved.length()").value(4));
    mockMvc
        .perform(
            get("/api/v1/users/{u}/compare", other.getUsername()).header("Authorization", token))
        .andExpect(jsonPath("$.commonCount").value(1))
        .andExpect(jsonPath("$.ratingGapAverage").doesNotExist())
        .andExpect(jsonPath("$.bothLoved.length()").value(0));
  }

  @Test
  void privateProfileIs403MissingIs404SelfIs400AnonymousIs401() throws Exception {
    UserEntity me = user();
    UserEntity hidden = user();
    hidden.setProfileVisibility(CollectionVisibility.PRIVATE);
    users.saveAndFlush(hidden);
    String token = bearer(me);

    mockMvc
        .perform(
            get("/api/v1/users/{u}/compare", hidden.getUsername()).header("Authorization", token))
        .andExpect(status().isForbidden())
        .andExpect(jsonPath("$.code").value("PROFILE_PRIVATE"));
    mockMvc
        .perform(
            get("/api/v1/users/{u}/compare", "nobody" + UUID.randomUUID())
                .header("Authorization", token))
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.code").value("USER_NOT_FOUND"));
    mockMvc
        .perform(get("/api/v1/users/{u}/compare", me.getUsername()).header("Authorization", token))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("COMPARE_WITH_SELF"));
    mockMvc
        .perform(get("/api/v1/users/{u}/compare", hidden.getUsername()))
        .andExpect(status().isUnauthorized());
  }

  private void shared(UserEntity me, UserEntity them, String title, Integer mine, Integer theirs) {
    CanonicalWorkEntity work = work();
    userMedias.saveAndFlush(
        new UserMediaEntity(
            them.getId(), media(work, title), UserMediaStatus.DONE, theirs, Map.of()));
    userMedias.saveAndFlush(
        new UserMediaEntity(me.getId(), media(work, title), UserMediaStatus.DONE, mine, Map.of()));
  }

  private CanonicalWorkEntity work() {
    return works.saveAndFlush(new CanonicalWorkEntity(MediaType.MOVIE));
  }

  private MediaEntity media(CanonicalWorkEntity work, String title) {
    return medias.saveAndFlush(
        new MediaEntity(
            UUID.randomUUID().toString(),
            "tmdb",
            MediaType.MOVIE,
            work,
            title,
            null,
            Map.of(),
            false));
  }

  private MediaEntity media(CanonicalWorkEntity work) {
    return media(work, "x");
  }

  private String bearer(UserEntity user) {
    return "Bearer " + jwtService.generateAccessToken(user);
  }

  private UserEntity user() {
    String name = "u" + UUID.randomUUID().toString().substring(0, 12);
    return users.saveAndFlush(new UserEntity(name + "@example.com", name, "hash"));
  }
}
