package com.shelfy.api.anilist;

import com.shelfy.api.anilist.client.AniListClient;
import com.shelfy.api.anilist.client.AniListMediaResponseDto;
import com.shelfy.api.anilist.client.AniListRelatedGraphQlResponseDto;
import com.shelfy.api.anilist.client.AniListRelatedGraphQlResponseDto.RecommendationConnection;
import com.shelfy.api.anilist.client.AniListRelatedGraphQlResponseDto.RecommendationNode;
import com.shelfy.api.anilist.client.AniListRelatedGraphQlResponseDto.RelationEdge;
import com.shelfy.api.anilist.client.AniListStaffEdgeResponseDto;
import com.shelfy.api.anilist.client.AniListStudioResponseDto;
import com.shelfy.api.anilist.dto.AniListEntityMediaResponseDto;
import com.shelfy.api.collection.MediaType;
import com.shelfy.api.related.RelatedMediaSource;
import com.shelfy.api.related.RelatedSection;
import com.shelfy.api.related.RelatedSectionFetcher;
import com.shelfy.api.related.dto.RelatedEntityDto;
import com.shelfy.api.related.dto.RelatedSectionResponseDto;
import com.shelfy.api.related.dto.SimilarMediaResponseDto;
import com.shelfy.api.search.dto.SearchResultResponseDto;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.function.Supplier;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class AniListRelatedSource implements RelatedMediaSource {

  private static final String PROVIDER = "anilist";
  private static final String WEBTOON_COUNTRY_OF_ORIGIN = "KR";
  private static final int SECTION_SIZE = 20;
  private static final int SIMILAR_PAGE_SIZE = 24;

  private static final Set<String> FRANCHISE_RELATIONS =
      Set.of(
          "PREQUEL",
          "SEQUEL",
          "PARENT",
          "SIDE_STORY",
          "SPIN_OFF",
          "ALTERNATIVE",
          "ADAPTATION",
          "SOURCE",
          "SUMMARY",
          "COMPILATION");

  private static final List<CreatorRole> CREATOR_ROLES =
      List.of(
          new CreatorRole(List.of("Original Creator"), "creator", AniListStaffRoles.AUTHOR_ROLES),
          new CreatorRole(
              List.of("Original Story", "Story & Art", "Story"),
              "author",
              AniListStaffRoles.AUTHOR_ROLES),
          new CreatorRole(
              AniListStaffRoles.DIRECTOR_ROLES, "director", AniListStaffRoles.DIRECTOR_ROLES));

  private final AniListClient aniListClient;
  private final AniListService aniListService;
  private final RelatedSectionFetcher fetcher;

  @Override
  public boolean supports(MediaType mediaType) {
    return mediaType == MediaType.ANIME
        || mediaType == MediaType.MANGA
        || mediaType == MediaType.WEBTOON;
  }

  @Override
  public List<RelatedSectionResponseDto> sections(MediaType mediaType, String externalId) {
    var media = aniListClient.fetchRelated(Long.parseLong(externalId), 1, SECTION_SIZE);
    List<Supplier<Optional<RelatedSectionResponseDto>>> lookups = new ArrayList<>();
    lookups.add(
        () ->
            Optional.of(
                RelatedSection.similar(
                    recommendations(media.recommendations()),
                    hasNextPage(media.recommendations()))));
    lookups.add(() -> Optional.of(RelatedSection.franchise(null, franchise(media))));
    creator(media)
        .ifPresent(
            creator ->
                lookups.add(
                    () ->
                        Optional.of(
                            RelatedSection.entity(
                                new RelatedEntityDto(
                                    "staff",
                                    String.valueOf(creator.edge().node().id()),
                                    creator.edge().node().name().full(),
                                    creator.creatorRole().role()),
                                staffWorks(creator)))));
    mainStudio(media)
        .ifPresent(
            studio ->
                lookups.add(
                    () ->
                        Optional.of(
                            RelatedSection.entity(
                                new RelatedEntityDto(
                                    "studios",
                                    String.valueOf(studio.id()),
                                    studio.name(),
                                    "studio"),
                                entityMedia(aniListService.getStudio(studio.id()).media())))));
    return fetcher.fetchAll(lookups);
  }

  @Override
  public SimilarMediaResponseDto similar(MediaType mediaType, String externalId, int page) {
    var media = aniListClient.fetchRelated(Long.parseLong(externalId), page, SIMILAR_PAGE_SIZE);
    return new SimilarMediaResponseDto(
        recommendations(media.recommendations()), page, hasNextPage(media.recommendations()));
  }

  private static List<SearchResultResponseDto> recommendations(
      RecommendationConnection connection) {
    if (connection == null || connection.nodes() == null) {
      return List.of();
    }
    return connection.nodes().stream()
        .map(RecommendationNode::mediaRecommendation)
        .filter(Objects::nonNull)
        .filter(media -> !Boolean.TRUE.equals(media.isAdult()))
        .map(AniListRelatedSource::toItem)
        .flatMap(Optional::stream)
        .toList();
  }

  private static boolean hasNextPage(RecommendationConnection connection) {
    return connection != null
        && connection.pageInfo() != null
        && connection.pageInfo().hasNextPage();
  }

  private static List<SearchResultResponseDto> franchise(
      AniListRelatedGraphQlResponseDto.Media media) {
    if (media.relations() == null || media.relations().edges() == null) {
      return List.of();
    }
    return media.relations().edges().stream()
        .filter(edge -> FRANCHISE_RELATIONS.contains(edge.relationType()))
        .map(RelationEdge::node)
        .filter(Objects::nonNull)
        .filter(node -> !Boolean.TRUE.equals(node.isAdult()))
        .sorted(
            Comparator.comparing(
                AniListMapper::releaseDate,
                Comparator.nullsLast(Comparator.<LocalDate>naturalOrder())))
        .map(AniListRelatedSource::toItem)
        .flatMap(Optional::stream)
        .toList();
  }

  private static Optional<Creator> creator(AniListRelatedGraphQlResponseDto.Media media) {
    if (media.staff() == null || media.staff().edges() == null) {
      return Optional.empty();
    }
    for (CreatorRole creatorRole : CREATOR_ROLES) {
      Optional<AniListStaffEdgeResponseDto> match =
          media.staff().edges().stream()
              .filter(edge -> AniListStaffRoles.matches(edge.role(), creatorRole.roles()))
              .filter(edge -> edge.node() != null && edge.node().name() != null)
              .filter(edge -> edge.node().name().full() != null)
              .findFirst();
      if (match.isPresent()) {
        return Optional.of(new Creator(match.get(), creatorRole));
      }
    }
    return Optional.empty();
  }

  private static Optional<AniListStudioResponseDto> mainStudio(
      AniListRelatedGraphQlResponseDto.Media media) {
    if (media.studios() == null || media.studios().nodes() == null) {
      return Optional.empty();
    }
    return media.studios().nodes().stream()
        .filter(AniListStudioResponseDto::isAnimationStudio)
        .filter(studio -> studio.name() != null)
        .findFirst();
  }

  private List<SearchResultResponseDto> staffWorks(Creator creator) {
    return aniListClient.fetchStaffWorks(creator.edge().node().id()).stream()
        .filter(work -> work.staffRole() != null && work.node() != null)
        .filter(work -> !Boolean.TRUE.equals(work.node().isAdult()))
        .filter(
            work -> AniListStaffRoles.matches(work.staffRole(), creator.creatorRole().worksRoles()))
        .map(work -> toItem(work.node()))
        .flatMap(Optional::stream)
        .toList();
  }

  private static List<SearchResultResponseDto> entityMedia(
      List<AniListEntityMediaResponseDto> media) {
    return media.stream()
        .map(
            entry ->
                new SearchResultResponseDto(
                    PROVIDER,
                    MediaType.fromString(entry.mediaType()),
                    String.valueOf(entry.id()),
                    entry.title(),
                    entry.coverImageUrl(),
                    null,
                    null,
                    List.of(),
                    entry.rating(),
                    null,
                    null,
                    false))
        .toList();
  }

  private static Optional<SearchResultResponseDto> toItem(AniListMediaResponseDto media) {
    String title = AniListMapper.title(media);
    if (title == null || media.type() == null) {
      return Optional.empty();
    }
    LocalDate releaseDate = AniListMapper.releaseDate(media);
    return Optional.of(
        new SearchResultResponseDto(
            PROVIDER,
            mediaType(media),
            String.valueOf(media.id()),
            title,
            AniListMapper.coverUrl(media),
            media.description(),
            releaseDate == null ? null : releaseDate.getYear(),
            List.of(),
            AniListMapper.rating(media),
            media.popularity(),
            media.status(),
            false));
  }

  private static MediaType mediaType(AniListMediaResponseDto media) {
    if ("ANIME".equals(media.type())) {
      return MediaType.ANIME;
    }
    return WEBTOON_COUNTRY_OF_ORIGIN.equals(media.countryOfOrigin())
        ? MediaType.WEBTOON
        : MediaType.MANGA;
  }

  private record CreatorRole(List<String> roles, String role, List<String> worksRoles) {}

  private record Creator(AniListStaffEdgeResponseDto edge, CreatorRole creatorRole) {}
}
