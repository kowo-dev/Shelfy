package com.shelfy.api.search;

import java.util.Arrays;
import java.util.regex.Pattern;

public record ExploreCriterion(Kind kind, String value) {

  private static final Pattern SHARED_ID = Pattern.compile("[a-z][a-z-]{1,40}");
  private static final Pattern NUMERIC_ID = Pattern.compile("[1-9][0-9]{0,9}");
  private static final Pattern NAME = Pattern.compile("[\\p{L}\\p{N}][\\p{L}\\p{N} '&+.\\-]{0,79}");

  public enum Kind {
    SHARED(null, false),
    TMDB_GENRE("tmdb-genre", true),
    TMDB_KEYWORD("tmdb-keyword", true),
    ANILIST_GENRE("anilist-genre", false),
    ANILIST_TAG("anilist-tag", false),
    IGDB_GENRE("igdb-genre", true),
    IGDB_THEME("igdb-theme", true),
    IGDB_KEYWORD("igdb-keyword", true),
    PLATFORM("platform", true),
    STREAMING("streaming", true);

    private final String prefix;
    private final boolean numeric;

    Kind(String prefix, boolean numeric) {
      this.prefix = prefix;
      this.numeric = numeric;
    }

    public String prefix() {
      return prefix;
    }
  }

  public static ExploreCriterion parse(String token) {
    if (token == null) {
      throw new IllegalArgumentException("Missing criterion");
    }
    int separator = token.indexOf(':');
    if (separator < 0) {
      if (!SHARED_ID.matcher(token).matches()) {
        throw new IllegalArgumentException("Invalid criterion");
      }
      return new ExploreCriterion(Kind.SHARED, token);
    }
    String prefix = token.substring(0, separator);
    String value = token.substring(separator + 1);
    Kind kind =
        Arrays.stream(Kind.values())
            .filter(candidate -> prefix.equals(candidate.prefix))
            .findFirst()
            .orElseThrow(() -> new IllegalArgumentException("Invalid criterion"));
    Pattern pattern = kind.numeric ? NUMERIC_ID : NAME;
    if (!pattern.matcher(value).matches()) {
      throw new IllegalArgumentException("Invalid criterion");
    }
    return new ExploreCriterion(kind, value);
  }

  public String token() {
    return kind == Kind.SHARED ? value : kind.prefix + ":" + value;
  }
}
