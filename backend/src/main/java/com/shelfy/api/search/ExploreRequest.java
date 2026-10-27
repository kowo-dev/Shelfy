package com.shelfy.api.search;

import com.shelfy.api.collection.MediaType;
import java.time.Year;
import java.util.List;
import java.util.regex.Pattern;

public record ExploreRequest(
    MediaType type,
    String query,
    List<ExploreCriterion> with,
    List<ExploreCriterion> without,
    Integer fromYear,
    Integer toYear,
    ExploreSort sort,
    int page,
    String region) {

  static final int MAX_CRITERIA = 12;
  private static final int MAX_QUERY_LENGTH = 200;
  private static final int MAX_PAGE = 500;
  private static final int MIN_YEAR = 1870;
  private static final Pattern REGION = Pattern.compile("[A-Z]{2}");

  public ExploreRequest {
    if (type == MediaType.BOOK) {
      throw new IllegalArgumentException("Books cannot be explored");
    }
    query = query == null ? "" : query.strip();
    if (query.length() > MAX_QUERY_LENGTH || query.chars().anyMatch(Character::isISOControl)) {
      throw new IllegalArgumentException("Invalid query");
    }
    with = with == null ? List.of() : with.stream().distinct().toList();
    without = without == null ? List.of() : without.stream().distinct().toList();
    if (with.size() > MAX_CRITERIA || without.size() > MAX_CRITERIA) {
      throw new IllegalArgumentException("Too many criteria");
    }
    int maxYear = Year.now().getValue() + 5;
    if ((fromYear != null && (fromYear < MIN_YEAR || fromYear > maxYear))
        || (toYear != null && (toYear < MIN_YEAR || toYear > maxYear))
        || (fromYear != null && toYear != null && fromYear > toYear)) {
      throw new IllegalArgumentException("Invalid years");
    }
    if (sort == null) {
      sort = ExploreSort.POPULAR;
    }
    if (page < 1 || page > MAX_PAGE) {
      throw new IllegalArgumentException("Invalid page");
    }
    if (region == null || !REGION.matcher(region).matches()) {
      throw new IllegalArgumentException("Invalid region");
    }
  }

  public boolean hasQuery() {
    return !query.isEmpty();
  }

  public boolean isPlainSearch() {
    return hasQuery() && with.isEmpty() && without.isEmpty() && fromYear == null && toYear == null;
  }
}
