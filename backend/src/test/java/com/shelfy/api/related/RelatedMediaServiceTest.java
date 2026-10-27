package com.shelfy.api.related;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.shelfy.api.collection.MediaType;
import com.shelfy.api.related.dto.RelatedEntityDto;
import com.shelfy.api.related.dto.RelatedSectionResponseDto;
import com.shelfy.api.related.dto.SimilarMediaResponseDto;
import com.shelfy.api.search.InCollectionMarker;
import com.shelfy.api.search.dto.SearchResultResponseDto;
import java.util.List;
import java.util.UUID;
import java.util.stream.IntStream;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class RelatedMediaServiceTest {

  private final RelatedMediaSource source = mock(RelatedMediaSource.class);
  private final InCollectionMarker marker = mock(InCollectionMarker.class);
  private final RelatedMediaService service = new RelatedMediaService(List.of(source), marker);
  private final UUID userId = UUID.randomUUID();

  @BeforeEach
  void setUp() {
    when(source.supports(MediaType.MOVIE)).thenReturn(true);
    when(marker.mark(any(), any())).thenAnswer(invocation -> invocation.getArgument(1));
  }

  @Test
  void getRelated_dropsTheSourceMediaDuplicatesAndEmptySections() {
    when(source.sections(MediaType.MOVIE, "1"))
        .thenReturn(
            List.of(
                RelatedSection.similar(List.of(item("1"), item("2"), item("2"), item("3")), false),
                RelatedSection.franchise("Saga", List.of(item("1"))),
                RelatedSection.entity(
                    new RelatedEntityDto("people", "9", "Someone", "director"),
                    List.of(item("4")))));

    List<RelatedSectionResponseDto> sections =
        service.getRelated(userId, MediaType.MOVIE, "1").sections();

    assertThat(sections)
        .extracting(RelatedSectionResponseDto::kind)
        .containsExactly("similar", "entity");
    assertThat(sections.getFirst().items())
        .extracting(SearchResultResponseDto::externalId)
        .containsExactly("2", "3");
  }

  @Test
  void getRelated_skipsInEntitySectionsWhatTheFranchiseSectionShows() {
    when(source.sections(MediaType.MOVIE, "1"))
        .thenReturn(
            List.of(
                RelatedSection.similar(List.of(item("2")), false),
                RelatedSection.franchise("Saga", List.of(item("2"), item("3"))),
                RelatedSection.entity(
                    new RelatedEntityDto("people", "9", "Someone", "director"),
                    List.of(item("3"), item("4")))));

    List<RelatedSectionResponseDto> sections =
        service.getRelated(userId, MediaType.MOVIE, "1").sections();

    assertThat(sections.get(0).items())
        .extracting(SearchResultResponseDto::externalId)
        .containsExactly("2");
    assertThat(sections.get(2).items())
        .extracting(SearchResultResponseDto::externalId)
        .containsExactly("4");
  }

  @Test
  void getRelated_capsSectionsAndReportsTheOverflow() {
    List<SearchResultResponseDto> many =
        IntStream.rangeClosed(10, 40).mapToObj(i -> item(String.valueOf(i))).toList();
    when(source.sections(MediaType.MOVIE, "1"))
        .thenReturn(List.of(RelatedSection.franchise(null, many)));

    RelatedSectionResponseDto section =
        service.getRelated(userId, MediaType.MOVIE, "1").sections().getFirst();

    assertThat(section.items()).hasSize(RelatedMediaService.MAX_SECTION_ITEMS);
    assertThat(section.hasMore()).isTrue();
  }

  @Test
  void getRelated_returnsNoSectionsForAnUnsupportedMediaType() {
    assertThat(service.getRelated(userId, MediaType.BOOK, "OL1W").sections()).isEmpty();
  }

  @Test
  void getSimilar_marksTheItemsOnTheUsersShelf() {
    when(source.similar(MediaType.MOVIE, "1", 2))
        .thenReturn(new SimilarMediaResponseDto(List.of(item("1"), item("2")), 2, true));
    when(marker.mark(userId, List.of(item("2")))).thenReturn(List.of(inCollection(item("2"))));

    SimilarMediaResponseDto result = service.getSimilar(userId, MediaType.MOVIE, "1", 2);

    assertThat(result.results()).containsExactly(inCollection(item("2")));
    assertThat(result.page()).isEqualTo(2);
    assertThat(result.hasMore()).isTrue();
  }

  private static SearchResultResponseDto item(String id) {
    return new SearchResultResponseDto(
        "tmdb",
        MediaType.MOVIE,
        id,
        "Title " + id,
        null,
        null,
        null,
        List.of(),
        null,
        null,
        null,
        false);
  }

  private static SearchResultResponseDto inCollection(SearchResultResponseDto r) {
    return new SearchResultResponseDto(
        r.provider(),
        r.mediaType(),
        r.externalId(),
        r.title(),
        r.posterPath(),
        r.overview(),
        r.releaseYear(),
        r.genres(),
        r.voteAverage(),
        r.voteCount(),
        r.status(),
        true);
  }
}
