package com.shelfy.api.related;

import com.shelfy.api.related.dto.RelatedEntityDto;
import com.shelfy.api.related.dto.RelatedSectionResponseDto;
import com.shelfy.api.search.dto.SearchResultResponseDto;
import java.util.List;

public final class RelatedSection {

  public static final String SIMILAR = "similar";
  public static final String FRANCHISE = "franchise";
  public static final String ENTITY = "entity";

  private RelatedSection() {}

  public static RelatedSectionResponseDto similar(
      List<SearchResultResponseDto> items, boolean hasMore) {
    return new RelatedSectionResponseDto(SIMILAR, null, null, items, hasMore);
  }

  public static RelatedSectionResponseDto franchise(
      String label, List<SearchResultResponseDto> items) {
    return franchise(label, null, items);
  }

  public static RelatedSectionResponseDto franchise(
      String label, RelatedEntityDto entity, List<SearchResultResponseDto> items) {
    return new RelatedSectionResponseDto(FRANCHISE, label, entity, items, false);
  }

  public static RelatedSectionResponseDto entity(
      RelatedEntityDto entity, List<SearchResultResponseDto> items) {
    return new RelatedSectionResponseDto(ENTITY, null, entity, items, false);
  }
}
