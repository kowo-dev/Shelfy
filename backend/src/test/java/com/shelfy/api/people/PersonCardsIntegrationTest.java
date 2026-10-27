package com.shelfy.api.people;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import com.shelfy.api.auth.CollectionVisibility;
import com.shelfy.api.auth.JwtService;
import com.shelfy.api.auth.UserEntity;
import com.shelfy.api.auth.UserRepository;
import com.shelfy.api.collection.CanonicalWorkEntity;
import com.shelfy.api.collection.CanonicalWorkRepository;
import com.shelfy.api.collection.MediaEntity;
import com.shelfy.api.collection.MediaRepository;
import com.shelfy.api.collection.MediaType;
import com.shelfy.api.collection.UserMediaEntity;
import com.shelfy.api.collection.UserMediaRepository;
import com.shelfy.api.collection.UserMediaStatus;
import com.shelfy.api.follows.FollowEntity;
import com.shelfy.api.follows.FollowRepository;
import java.util.List;
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
class PersonCardsIntegrationTest {

  @Autowired private MockMvc mockMvc;
  @Autowired private JwtService jwtService;
  @Autowired private UserRepository users;
  @Autowired private CanonicalWorkRepository works;
  @Autowired private MediaRepository medias;
  @Autowired private UserMediaRepository userMedias;
  @Autowired private FollowRepository follows;

  @Test
  void publicCollectionGivesTheBannerTheCountAndTheThreeNewestCovers() throws Exception {
    UserEntity viewer = user(CollectionVisibility.PUBLIC);
    UserEntity fan = user(CollectionVisibility.PUBLIC);
    fan.setProfileBannerUrl("https://img.example/banner.jpg");
    users.saveAndFlush(fan);
    for (int i = 1; i <= 4; i++) {
      add(fan, "https://img.example/c" + i + ".jpg", false);
    }
    follows.saveAndFlush(new FollowEntity(fan.getId(), viewer.getId()));
    follows.saveAndFlush(new FollowEntity(viewer.getId(), fan.getId()));

    Map<String, Object> card = card(followers(viewer), fan);

    assertThat(card.get("bannerUrl")).isEqualTo("https://img.example/banner.jpg");
    assertThat(card.get("titleCount")).isEqualTo(4);
    assertThat(card.get("followersCount")).isEqualTo(1);
    assertThat(card.get("coverUrls"))
        .isEqualTo(
            List.of(
                "https://img.example/c4.jpg",
                "https://img.example/c3.jpg",
                "https://img.example/c2.jpg"));
  }

  @Test
  void privateCollectionHidesTheCountTheCoversAndTheBannerFromEveryoneElse() throws Exception {
    UserEntity viewer = user(CollectionVisibility.PUBLIC);
    UserEntity hidden = user(CollectionVisibility.PRIVATE);
    hidden.setProfileBannerUrl("https://img.example/banner.jpg");
    users.saveAndFlush(hidden);
    add(hidden, "https://img.example/secret.jpg", false);
    follows.saveAndFlush(new FollowEntity(hidden.getId(), viewer.getId()));

    Map<String, Object> card = card(followers(viewer), hidden);

    assertThat(card.get("bannerUrl")).isNull();
    assertThat(card.get("titleCount")).isNull();
    assertThat(card.get("followersCount")).isNull();
    assertThat(card.get("coverUrls")).isEqualTo(List.of());
  }

  @Test
  void adultCoversStayOutUnlessTheViewerAllowsAdultContent() throws Exception {
    UserEntity viewer = user(CollectionVisibility.PUBLIC);
    UserEntity fan = user(CollectionVisibility.PUBLIC);
    add(fan, "https://img.example/safe.jpg", false);
    add(fan, "https://img.example/adult.jpg", true);
    follows.saveAndFlush(new FollowEntity(fan.getId(), viewer.getId()));

    assertThat(card(followers(viewer), fan).get("coverUrls"))
        .isEqualTo(List.of("https://img.example/safe.jpg"));

    viewer.setAdultContentAllowed(true);
    users.saveAndFlush(viewer);

    assertThat(card(followers(viewer), fan).get("coverUrls"))
        .isEqualTo(List.of("https://img.example/adult.jpg", "https://img.example/safe.jpg"));
  }

  @Test
  void bookCoversStayOut() throws Exception {
    UserEntity viewer = user(CollectionVisibility.PUBLIC);
    UserEntity fan = user(CollectionVisibility.PUBLIC);
    add(fan, "https://img.example/movie.jpg", false);
    add(fan, MediaType.BOOK, "https://img.example/book.jpg", false);
    follows.saveAndFlush(new FollowEntity(fan.getId(), viewer.getId()));

    assertThat(card(followers(viewer), fan).get("coverUrls"))
        .isEqualTo(List.of("https://img.example/movie.jpg"));
  }

  @Test
  void searchCarriesTheCardAndWhetherTheViewerFollows() throws Exception {
    UserEntity me = user(CollectionVisibility.PUBLIC);
    UserEntity followed = user(CollectionVisibility.PUBLIC);
    UserEntity other = user(CollectionVisibility.PUBLIC);
    add(followed, "https://img.example/followed.jpg", false);
    follows.saveAndFlush(new FollowEntity(me.getId(), followed.getId()));

    String found = list("/api/v1/people/search?query=" + followed.getUsername(), me);
    String notFound = list("/api/v1/people/search?query=" + other.getUsername(), me);

    assertThat(card(found, followed).get("isFollowedByCurrentUser")).isEqualTo(true);
    assertThat(card(found, followed).get("coverUrls"))
        .isEqualTo(List.of("https://img.example/followed.jpg"));
    assertThat(card(notFound, other).get("isFollowedByCurrentUser")).isEqualTo(false);
  }

  @Test
  void searchMatchesTheDisplayNameIgnoringAccents() throws Exception {
    UserEntity me = user(CollectionVisibility.PUBLIC);
    UserEntity named = user(CollectionVisibility.PUBLIC);
    String tag = UUID.randomUUID().toString().substring(0, 8);
    named.setDisplayName("Zoé" + tag);
    users.saveAndFlush(named);

    List<String> found =
        JsonPath.read(list("/api/v1/people/search?query=zoe" + tag, me), "$.content[*].id");

    assertThat(found).containsExactly(named.getId().toString());
  }

  @Test
  void followersNarrowByUsernameOrDisplayNameAndReviewsByTitleIgnoringAccents() throws Exception {
    UserEntity me = user(CollectionVisibility.PUBLIC);
    UserEntity margot = user(CollectionVisibility.PUBLIC);
    margot.setDisplayName("Margot Lüne");
    users.saveAndFlush(margot);
    UserEntity other = user(CollectionVisibility.PUBLIC);
    follows.saveAndFlush(new FollowEntity(margot.getId(), me.getId()));
    follows.saveAndFlush(new FollowEntity(other.getId(), me.getId()));
    review(me, "Paddington au Pérou");
    review(me, "Flow");

    List<String> byDisplayName =
        JsonPath.read(list("/api/v1/follows/followers?q=lune", me), "$.content[*].id");
    List<String> byUsername =
        JsonPath.read(
            list("/api/v1/follows/followers?q=" + other.getUsername(), me), "$.content[*].id");
    List<String> reviews =
        JsonPath.read(
            list("/api/v1/users/" + me.getUsername() + "/reviews?q=PEROU", me),
            "$.content[*].media.title");

    assertThat(byDisplayName).containsExactly(margot.getId().toString());
    assertThat(byUsername).containsExactly(other.getId().toString());
    assertThat(reviews).containsExactly("Paddington au Pérou");
  }

  private void review(UserEntity owner, String title) {
    CanonicalWorkEntity work = works.saveAndFlush(new CanonicalWorkEntity(MediaType.MOVIE));
    MediaEntity media =
        medias.saveAndFlush(
            new MediaEntity(
                UUID.randomUUID().toString(),
                "tmdb",
                MediaType.MOVIE,
                work,
                title,
                null,
                Map.of(),
                false));
    UserMediaEntity entry =
        new UserMediaEntity(owner.getId(), media, UserMediaStatus.DONE, null, Map.of());
    entry.setNote(Map.of("type", "doc"));
    userMedias.saveAndFlush(entry);
  }

  private String followers(UserEntity viewer) throws Exception {
    return list("/api/v1/follows/followers", viewer);
  }

  private String list(String path, UserEntity viewer) throws Exception {
    return mockMvc
        .perform(
            get(path).header("Authorization", "Bearer " + jwtService.generateAccessToken(viewer)))
        .andExpect(status().isOk())
        .andReturn()
        .getResponse()
        .getContentAsString();
  }

  private Map<String, Object> card(String body, UserEntity person) {
    List<Map<String, Object>> found =
        JsonPath.read(body, "$.content[?(@.id == '" + person.getId() + "')]");
    return found.getFirst();
  }

  private void add(UserEntity owner, String coverUrl, boolean adult) throws InterruptedException {
    add(owner, MediaType.MOVIE, coverUrl, adult);
  }

  private void add(UserEntity owner, MediaType type, String coverUrl, boolean adult)
      throws InterruptedException {
    CanonicalWorkEntity work = works.saveAndFlush(new CanonicalWorkEntity(type));
    MediaEntity media =
        medias.saveAndFlush(
            new MediaEntity(
                UUID.randomUUID().toString(),
                "tmdb",
                type,
                work,
                "Title",
                coverUrl,
                Map.of(),
                adult));
    userMedias.saveAndFlush(
        new UserMediaEntity(owner.getId(), media, UserMediaStatus.DONE, null, Map.of()));
    Thread.sleep(5);
  }

  private UserEntity user(CollectionVisibility visibility) {
    String name = "u" + UUID.randomUUID().toString().substring(0, 12);
    UserEntity user = new UserEntity(name + "@example.com", name, "hash");
    user.setProfileVisibility(visibility);
    return users.saveAndFlush(user);
  }
}
