package com.shelfy.api.search;

import com.shelfy.api.collection.MediaType;
import com.shelfy.api.search.ExploreCriterion.Kind;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;

@Component
public class ExploreVocabulary {

  public enum Group {
    GENRE,
    THEME
  }

  public enum Catalog {
    TMDB_MOVIE(MediaType.MOVIE),
    TMDB_TV(MediaType.TV_SHOW),
    ANILIST_ANIME(MediaType.ANIME),
    ANILIST_MANGA(MediaType.MANGA, MediaType.WEBTOON),
    IGDB(MediaType.GAME);

    private final List<MediaType> mediaTypes;

    Catalog(MediaType... mediaTypes) {
      this.mediaTypes = List.of(mediaTypes);
    }

    public List<MediaType> mediaTypes() {
      return mediaTypes;
    }

    boolean isTmdb() {
      return this == TMDB_MOVIE || this == TMDB_TV;
    }

    boolean isAniList() {
      return this == ANILIST_ANIME || this == ANILIST_MANGA;
    }
  }

  public record Ref(Kind kind, String value) {}

  public record Entry(String id, Group group, Map<Catalog, Ref> refs) {

    public List<MediaType> mediaTypes() {
      return refs.keySet().stream()
          .sorted()
          .flatMap(catalog -> catalog.mediaTypes().stream())
          .toList();
    }
  }

  public record Platform(String id, String label) {}

  private static final List<Platform> PLATFORMS =
      List.of(
          new Platform("6", "PC"),
          new Platform("167", "PlayStation 5"),
          new Platform("48", "PlayStation 4"),
          new Platform("169", "Xbox Series X|S"),
          new Platform("49", "Xbox One"),
          new Platform("508", "Nintendo Switch 2"),
          new Platform("130", "Nintendo Switch"),
          new Platform("14", "Mac"),
          new Platform("3", "Linux"),
          new Platform("39", "iOS"),
          new Platform("34", "Android"),
          new Platform("390", "PlayStation VR2"));

  private final List<Entry> entries = new ArrayList<>();
  private final Map<String, Entry> byId;

  public ExploreVocabulary() {
    genre("action", tg(28), tg(10759), ag("Action"), it(1));
    genre("adventure", tg(12), tg(10759), ag("Adventure"), ig(31));
    genre("comedy", tg(35), tg(35), ag("Comedy"), it(27));
    genre("drama", tg(18), tg(18), ag("Drama"), it(31));
    genre("fantasy", tg(14), tg(10765), ag("Fantasy"), it(17));
    genre("science-fiction", tg(878), tg(10765), ag("Sci-Fi"), it(18));
    genre("horror", tg(27), tk("horror"), ag("Horror"), it(19));
    genre("mystery", tg(9648), tg(9648), ag("Mystery"), it(43));
    genre("thriller", tg(53), tk("thriller"), ag("Thriller"), it(20));
    genre("romance", tg(10749), tk("romance"), ag("Romance"), it(44));
    genre("crime", tg(80), tg(80), at("Crime"), null);
    genre("war", tg(10752), tg(10768), at("War"), it(39));
    genre("history", tg(36), tk("history"), at("Historical"), it(22));
    genre("family", tg(10751), tg(10751), at("Kids"), it(35));
    genre("music", tg(10402), tk("music"), ag("Music"), ig(7));
    genre("documentary", tg(99), tg(99), at("Non-fiction"), it(32));
    genre("western", tg(37), tg(37), at("Cowboys"), null);
    genre(
        "psychological",
        tk("psychological thriller"),
        tk("psychological"),
        ag("Psychological"),
        null);
    genre("slice-of-life", tk("slice of life"), tk("slice of life"), ag("Slice of Life"), null);
    genre("sports", tk("sport"), tk("sport"), ag("Sports"), ig(14));
    genre(
        "supernatural",
        tk("supernatural"),
        tk("supernatural"),
        ag("Supernatural"),
        ik("supernatural"));
    genre("mecha", tk("mecha"), tk("mecha"), ag("Mecha"), ik("mecha"));
    theme(
        "time-travel",
        tk("time travel"),
        tk("time travel"),
        at("Time Manipulation"),
        ik("time-travel"));
    theme("time-loop", tk("time loop"), tk("time loop"), at("Time Loop"), ik("time-loop"));
    theme("space", tk("space"), tk("space"), at("Space"), ik("space"));
    theme("dystopia", tk("dystopia"), tk("dystopia"), at("Dystopian"), ik("dystopian"));
    theme("cyberpunk", tk("cyberpunk"), tk("cyberpunk"), at("Cyberpunk"), ik("cyberpunk"));
    theme(
        "post-apocalyptic",
        tk("post-apocalyptic future"),
        tk("post-apocalyptic future"),
        at("Post-Apocalyptic"),
        ik("post-apocalyptic"));
    theme("zombies", tk("zombie"), tk("zombie"), at("Zombie"), ik("zombies"));
    theme("vampires", tk("vampire"), tk("vampire"), at("Vampire"), ik("vampire"));
    theme("superheroes", tk("superhero"), tk("superhero"), at("Superhero"), ik("superhero"));
    theme(
        "artificial-intelligence",
        tk("artificial intelligence (a.i.)"),
        tk("artificial intelligence (a.i.)"),
        at("Artificial Intelligence"),
        ik("artificial-intelligence"));
    theme("robots", tk("robot"), tk("robot"), at("Robots"), ik("robots"));
    theme("aliens", tk("alien"), tk("alien"), at("Aliens"), ik("aliens"));
    theme("magic", tk("magic"), tk("magic"), at("Magic"), ik("magic"));
    theme("dragons", tk("dragon"), tk("dragon"), at("Dragons"), ik("dragons"));
    theme("mythology", tk("mythology"), tk("mythology"), at("Mythology"), ik("mythology"));
    theme("witches", tk("witch"), tk("witch"), at("Witch"), ik("witches"));
    theme("isekai", tk("isekai"), tk("isekai"), at("Isekai"), ik("isekai"));
    theme(
        "martial-arts",
        tk("martial arts"),
        tk("martial arts"),
        at("Martial Arts"),
        ik("martial-arts"));
    theme("samurai", tk("samurai"), tk("samurai"), at("Samurai"), ik("samurai"));
    theme("pirates", tk("pirate"), tk("pirate"), at("Pirates"), ik("pirates"));
    theme("heist", tk("heist"), tk("heist"), null, ik("heist"));
    theme("detective", tk("detective"), tk("detective"), at("Detective"), ik("detective"));
    theme("serial-killer", tk("serial killer"), tk("serial killer"), null, ik("serial-killer"));
    theme("espionage", tk("spy"), tk("spy"), at("Espionage"), ik("espionage"));
    theme("military", tk("military"), tk("military"), at("Military"), ik("military"));
    theme("survival", tk("survival"), tk("survival"), at("Survival"), it(21));
    theme("revenge", tk("revenge"), tk("revenge"), at("Revenge"), ik("revenge"));
    theme("school", tk("high school"), tk("high school"), at("School"), ik("school"));
    theme(
        "coming-of-age",
        tk("coming of age"),
        tk("coming of age"),
        at("Coming of Age"),
        ik("coming-of-age"));
    theme("found-family", tk("found family"), tk("found family"), at("Found Family"), null);
    theme("video-games", tk("video game"), tk("video game"), at("Video Games"), null);
    theme("open-world", null, null, null, it(38));
    theme("cozy", tk("feel good"), tk("feel good"), at("Iyashikei"), ik("cozy"));
    byId = entries.stream().collect(Collectors.toMap(Entry::id, Function.identity()));
  }

  public List<Entry> entries() {
    return List.copyOf(entries);
  }

  public List<Platform> platforms() {
    return PLATFORMS;
  }

  public Optional<Entry> find(String id) {
    return Optional.ofNullable(byId.get(id));
  }

  private void genre(String id, Ref movie, Ref tv, Ref anilist, Ref igdb) {
    add(id, Group.GENRE, movie, tv, anilist, igdb);
  }

  private void theme(String id, Ref movie, Ref tv, Ref anilist, Ref igdb) {
    add(id, Group.THEME, movie, tv, anilist, igdb);
  }

  private void add(String id, Group group, Ref movie, Ref tv, Ref anilist, Ref igdb) {
    Map<Catalog, Ref> refs = new EnumMap<>(Catalog.class);
    if (movie != null) {
      refs.put(Catalog.TMDB_MOVIE, movie);
    }
    if (tv != null) {
      refs.put(Catalog.TMDB_TV, tv);
    }
    if (anilist != null) {
      refs.put(Catalog.ANILIST_ANIME, anilist);
      refs.put(Catalog.ANILIST_MANGA, anilist);
    }
    if (igdb != null) {
      refs.put(Catalog.IGDB, igdb);
    }
    entries.add(new Entry(id, group, Map.copyOf(refs)));
  }

  private static Ref tg(int id) {
    return new Ref(Kind.TMDB_GENRE, String.valueOf(id));
  }

  private static Ref tk(String name) {
    return new Ref(Kind.TMDB_KEYWORD, name);
  }

  private static Ref ag(String name) {
    return new Ref(Kind.ANILIST_GENRE, name);
  }

  private static Ref at(String name) {
    return new Ref(Kind.ANILIST_TAG, name);
  }

  private static Ref ig(int id) {
    return new Ref(Kind.IGDB_GENRE, String.valueOf(id));
  }

  private static Ref it(int id) {
    return new Ref(Kind.IGDB_THEME, String.valueOf(id));
  }

  private static Ref ik(String slug) {
    return new Ref(Kind.IGDB_KEYWORD, slug);
  }
}
