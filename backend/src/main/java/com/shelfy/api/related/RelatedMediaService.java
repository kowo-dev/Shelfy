package com.shelfy.api.related;

import com.shelfy.api.collection.MediaType;
import com.shelfy.api.related.dto.RelatedMediaResponseDto;
import com.shelfy.api.related.dto.RelatedSectionResponseDto;
import com.shelfy.api.related.dto.SimilarMediaResponseDto;
import com.shelfy.api.search.InCollectionMarker;
import com.shelfy.api.search.dto.SearchResultResponseDto;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class RelatedMediaService {

  static final int MAX_SECTION_ITEMS = 20;

  private final List<RelatedMediaSource> sources;
  private final InCollectionMarker inCollectionMarker;

  public RelatedMediaResponseDto getRelated(UUID userId, MediaType mediaType, String externalId) {
    List<RelatedSectionResponseDto> sections =
        source(mediaType).map(source -> source.sections(mediaType, externalId)).orElse(List.of());
    Set<String> franchiseKeys =
        sections.stream()
            .filter(section -> RelatedSection.FRANCHISE.equals(section.kind()))
            .flatMap(section -> section.items().stream())
            .map(RelatedMediaService::key)
            .collect(Collectors.toSet());
    return new RelatedMediaResponseDto(
        sections.stream()
            .map(section -> withoutFranchiseEntries(section, franchiseKeys))
            .map(section -> clean(userId, section, externalId))
            .filter(section -> !section.items().isEmpty())
            .toList());
  }

  private static RelatedSectionResponseDto withoutFranchiseEntries(
      RelatedSectionResponseDto section, Set<String> franchiseKeys) {
    if (!RelatedSection.ENTITY.equals(section.kind()) || franchiseKeys.isEmpty()) {
      return section;
    }
    return new RelatedSectionResponseDto(
        section.kind(),
        section.label(),
        section.entity(),
        section.items().stream().filter(item -> !franchiseKeys.contains(key(item))).toList(),
        section.hasMore());
  }

  private static String key(SearchResultResponseDto item) {
    return item.mediaType().getValue() + ":" + item.externalId();
  }

  public SimilarMediaResponseDto getSimilar(
      UUID userId, MediaType mediaType, String externalId, int page) {
    return source(mediaType)
        .map(source -> source.similar(mediaType, externalId, page))
        .map(
            result ->
                new SimilarMediaResponseDto(
                    inCollectionMarker.mark(
                        userId, distinctExcluding(result.results(), externalId, Integer.MAX_VALUE)),
                    result.page(),
                    result.hasMore()))
        .orElseGet(() -> new SimilarMediaResponseDto(List.of(), page, false));
  }

  private Optional<RelatedMediaSource> source(MediaType mediaType) {
    return sources.stream().filter(source -> source.supports(mediaType)).findFirst();
  }

  private RelatedSectionResponseDto clean(
      UUID userId, RelatedSectionResponseDto section, String externalId) {
    List<SearchResultResponseDto> items =
        distinctExcluding(section.items(), externalId, MAX_SECTION_ITEMS);
    return new RelatedSectionResponseDto(
        section.kind(),
        section.label(),
        section.entity(),
        inCollectionMarker.mark(userId, items),
        section.hasMore() || section.items().size() > MAX_SECTION_ITEMS);
  }

  private static List<SearchResultResponseDto> distinctExcluding(
      List<SearchResultResponseDto> items, String externalId, int limit) {
    Set<String> seen = new HashSet<>();
    return items.stream()
        .filter(item -> !item.externalId().equals(externalId))
        .filter(item -> seen.add(key(item)))
        .limit(limit)
        .toList();
  }
}
