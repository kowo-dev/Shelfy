package com.shelfy.api.anilist;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.shelfy.api.anilist.client.AniListCharacterNameResponseDto;
import com.shelfy.api.anilist.client.AniListClient;
import com.shelfy.api.anilist.client.AniListDateResponseDto;
import com.shelfy.api.anilist.client.AniListMediaResponseDto;
import com.shelfy.api.anilist.client.AniListPageInfoResponseDto;
import com.shelfy.api.anilist.client.AniListRelatedGraphQlResponseDto.Media;
import com.shelfy.api.anilist.client.AniListRelatedGraphQlResponseDto.RecommendationConnection;
import com.shelfy.api.anilist.client.AniListRelatedGraphQlResponseDto.RecommendationNode;
import com.shelfy.api.anilist.client.AniListRelatedGraphQlResponseDto.RelationConnection;
import com.shelfy.api.anilist.client.AniListRelatedGraphQlResponseDto.RelationEdge;
import com.shelfy.api.anilist.client.AniListRelatedGraphQlResponseDto.StaffWork;
import com.shelfy.api.anilist.client.AniListStaffConnectionResponseDto;
import com.shelfy.api.anilist.client.AniListStaffEdgeResponseDto;
import com.shelfy.api.anilist.client.AniListStaffResponseDto;
import com.shelfy.api.anilist.client.AniListStudioConnectionResponseDto;
import com.shelfy.api.anilist.client.AniListStudioResponseDto;
import com.shelfy.api.anilist.client.AniListTitleResponseDto;
import com.shelfy.api.anilist.dto.AniListEntityMediaResponseDto;
import com.shelfy.api.anilist.dto.StudioDetailResponseDto;
import com.shelfy.api.collection.MediaType;
import com.shelfy.api.related.RelatedSectionFetcher;
import com.shelfy.api.related.dto.RelatedEntityDto;
import com.shelfy.api.related.dto.RelatedSectionResponseDto;
import com.shelfy.api.search.dto.SearchResultResponseDto;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

class AniListRelatedSourceTest {

  private final AniListClient client = mock(AniListClient.class);
  private final AniListService service = mock(AniListService.class);
  private final RelatedSectionFetcher fetcher = new RelatedSectionFetcher();
  private final AniListRelatedSource source = new AniListRelatedSource(client, service, fetcher);

  @AfterEach
  void tearDown() {
    fetcher.close();
  }

  @Test
  void animeSections_listRecommendationsFranchiseCreatorAndStudio() {
    when(client.fetchRelated(1, 1, 20))
        .thenReturn(
            new Media(
                1,
                "ANIME",
                new AniListStudioConnectionResponseDto(
                    List.of(
                        new AniListStudioResponseDto(5, "Aniplex", false),
                        new AniListStudioResponseDto(6, "Wit", true))),
                new AniListStaffConnectionResponseDto(
                    List.of(
                        staff(20, "Director"), staff(21, "Original Creator"), staff(22, "Story"))),
                new RelationConnection(
                    List.of(
                        new RelationEdge("SEQUEL", media(3, "ANIME", "JP", 2015)),
                        new RelationEdge("CHARACTER", media(4, "ANIME", "JP", 2010)),
                        new RelationEdge("SOURCE", media(2, "MANGA", "JP", 2009)))),
                new RecommendationConnection(
                    new AniListPageInfoResponseDto(true),
                    List.of(
                        new RecommendationNode(media(7, "MANGA", "KR", 2018)),
                        new RecommendationNode(null)))));
    when(client.fetchStaffWorks(21))
        .thenReturn(
            List.of(
                new StaffWork("Original Creator", media(2, "MANGA", "JP", 2009)),
                new StaffWork("Story & Art", media(8, "MANGA", "JP", 2011)),
                new StaffWork("Ending Illustration", media(10, "ANIME", "JP", 2016))));
    when(service.getStudio(6))
        .thenReturn(
            new StudioDetailResponseDto(
                6,
                "Wit",
                List.of(new AniListEntityMediaResponseDto(9, "anime", "Vinland", null, 8.8))));

    List<RelatedSectionResponseDto> sections = source.sections(MediaType.ANIME, "1");

    assertThat(sections)
        .extracting(RelatedSectionResponseDto::kind)
        .containsExactly("similar", "franchise", "entity", "entity");
    assertThat(sections.get(0).hasMore()).isTrue();
    assertThat(sections.get(0).items())
        .extracting(SearchResultResponseDto::mediaType)
        .containsExactly(MediaType.WEBTOON);
    assertThat(ids(sections.get(1))).containsExactly("2", "3");
    assertThat(sections.get(2).entity())
        .isEqualTo(new RelatedEntityDto("staff", "21", "Name 21", "creator"));
    assertThat(ids(sections.get(2))).containsExactly("2", "8");
    assertThat(sections.get(3).entity())
        .isEqualTo(new RelatedEntityDto("studios", "6", "Wit", "studio"));
    assertThat(ids(sections.get(3))).containsExactly("9");
  }

  private static List<String> ids(RelatedSectionResponseDto section) {
    return section.items().stream().map(SearchResultResponseDto::externalId).toList();
  }

  private static AniListStaffEdgeResponseDto staff(long id, String role) {
    return new AniListStaffEdgeResponseDto(
        role, new AniListStaffResponseDto(id, new AniListCharacterNameResponseDto("Name " + id)));
  }

  private static AniListMediaResponseDto media(long id, String type, String country, int year) {
    return new AniListMediaResponseDto(
        id,
        type,
        new AniListTitleResponseDto("Title " + id, null),
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        country,
        80.0,
        1000,
        new AniListDateResponseDto(year, 1, 1),
        null,
        null,
        null,
        null,
        "FINISHED",
        false,
        null,
        null);
  }
}
