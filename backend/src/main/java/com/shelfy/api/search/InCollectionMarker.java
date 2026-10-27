package com.shelfy.api.search;

import com.shelfy.api.collection.CollectionService;
import com.shelfy.api.collection.dto.CollectionItemResponseDto;
import com.shelfy.api.collection.dto.MediaReferenceDto;
import com.shelfy.api.search.dto.SearchResultResponseDto;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class InCollectionMarker {

  private final CollectionService collectionService;

  public List<SearchResultResponseDto> mark(UUID userId, List<SearchResultResponseDto> results) {
    if (userId == null || results.isEmpty()) {
      return results;
    }
    List<MediaReferenceDto> references =
        results.stream()
            .map(r -> new MediaReferenceDto(r.provider(), r.mediaType(), r.externalId()))
            .toList();
    Map<String, CollectionItemResponseDto> found =
        collectionService.findByExternalReferences(userId, references);
    return results.stream().map(r -> found.containsKey(key(r)) ? r.asInCollection() : r).toList();
  }

  private static String key(SearchResultResponseDto r) {
    return r.provider() + ":" + r.mediaType().getValue() + ":" + r.externalId();
  }
}
