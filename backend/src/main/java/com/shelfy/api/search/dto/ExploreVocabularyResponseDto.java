package com.shelfy.api.search.dto;

import com.shelfy.api.collection.MediaType;
import java.util.List;

public record ExploreVocabularyResponseDto(
    List<Criterion> criteria, List<ExploreOptionResponseDto> platforms) {

  public record Criterion(String id, String group, List<MediaType> mediaTypes) {}
}
