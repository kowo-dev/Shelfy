package com.shelfy.api.igdb;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.shelfy.api.collection.MediaType;
import com.shelfy.api.igdb.client.IgdbClient;
import com.shelfy.api.igdb.client.IgdbCompanyResponseDto;
import com.shelfy.api.igdb.client.IgdbFranchiseResponseDto;
import com.shelfy.api.igdb.client.IgdbGameResponseDto;
import com.shelfy.api.igdb.client.IgdbImageResponseDto;
import com.shelfy.api.igdb.client.IgdbInvolvedCompanyResponseDto;
import com.shelfy.api.igdb.client.IgdbThemeResponseDto;
import com.shelfy.api.related.RelatedSectionFetcher;
import com.shelfy.api.related.dto.RelatedEntityDto;
import com.shelfy.api.related.dto.RelatedSectionResponseDto;
import com.shelfy.api.search.dto.SearchResultResponseDto;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

class IgdbRelatedSourceTest {

  private static final long JAN_2017 = 1483228800L;
  private static final long JAN_1998 = 883612800L;

  private final IgdbClient client = mock(IgdbClient.class);
  private final RelatedSectionFetcher fetcher = new RelatedSectionFetcher();
  private final IgdbRelatedSource source = new IgdbRelatedSource(client, fetcher);

  @AfterEach
  void tearDown() {
    fetcher.close();
  }

  @Test
  void sections_listSimilarGamesFranchiseAndDeveloper() {
    when(client.fetchGameRelated(1))
        .thenReturn(
            game(1, null)
                .withFranchise(new IgdbFranchiseResponseDto(5, "Zelda"))
                .withCompanies(
                    List.of(
                        new IgdbInvolvedCompanyResponseDto(
                            1, new IgdbCompanyResponseDto(70, "Publisher Co"), false, true),
                        new IgdbInvolvedCompanyResponseDto(
                            2, new IgdbCompanyResponseDto(71, "Nintendo EPD"), true, false)))
                .withSimilar(List.of(game(2, JAN_2017).build(), adultGame(3)))
                .build());
    when(client.fetchFranchiseTopGames(5, 1))
        .thenReturn(List.of(game(4, JAN_2017).build(), game(6, JAN_1998).build()));
    when(client.fetchDeveloperTopGames(71)).thenReturn(List.of(game(8, JAN_2017).build()));

    List<RelatedSectionResponseDto> sections = source.sections(MediaType.GAME, "1");

    assertThat(sections)
        .extracting(RelatedSectionResponseDto::kind)
        .containsExactly("similar", "franchise", "entity");
    assertThat(ids(sections.get(0))).containsExactly("2");
    assertThat(sections.get(0).items().getFirst().posterPath()).isEqualTo("cover2");
    assertThat(sections.get(1).label()).isEqualTo("Zelda");
    assertThat(sections.get(1).entity())
        .isEqualTo(new RelatedEntityDto("franchises", "5", "Zelda", "franchise"));
    assertThat(ids(sections.get(1))).containsExactly("6", "4");
    assertThat(sections.get(2).entity())
        .isEqualTo(new RelatedEntityDto("game-companies", "71", "Nintendo EPD", "developer"));
    assertThat(ids(sections.get(2))).containsExactly("8");
  }

  @Test
  void sections_lookUpTheFranchiseNameWhenOnlyItsIdIsKnown() {
    when(client.fetchGameRelated(1))
        .thenReturn(game(1, null).withFranchiseIds(List.of(9L)).build());
    when(client.findFranchise(9)).thenReturn(Optional.of(new IgdbFranchiseResponseDto(9, "Mario")));
    when(client.fetchFranchiseTopGames(9, 1)).thenReturn(List.of(game(4, JAN_2017).build()));

    List<RelatedSectionResponseDto> sections = source.sections(MediaType.GAME, "1");

    assertThat(sections.get(1).label()).isEqualTo("Mario");
  }

  private static List<String> ids(RelatedSectionResponseDto section) {
    return section.items().stream().map(SearchResultResponseDto::externalId).toList();
  }

  private static IgdbGameResponseDto adultGame(long id) {
    return game(id, JAN_2017)
        .withThemes(List.of(new IgdbThemeResponseDto(IgdbClient.EROTIC_THEME_ID, "Erotic")))
        .build();
  }

  private static GameBuilder game(long id, Long releaseDate) {
    return new GameBuilder(id, releaseDate);
  }

  private static final class GameBuilder {
    private final long id;
    private final Long releaseDate;
    private IgdbFranchiseResponseDto franchise;
    private List<Long> franchises;
    private List<IgdbInvolvedCompanyResponseDto> companies;
    private List<IgdbGameResponseDto> similar;
    private List<IgdbThemeResponseDto> themes;

    GameBuilder(long id, Long releaseDate) {
      this.id = id;
      this.releaseDate = releaseDate;
    }

    GameBuilder withFranchise(IgdbFranchiseResponseDto value) {
      franchise = value;
      return this;
    }

    GameBuilder withFranchiseIds(List<Long> value) {
      franchises = value;
      return this;
    }

    GameBuilder withCompanies(List<IgdbInvolvedCompanyResponseDto> value) {
      companies = value;
      return this;
    }

    GameBuilder withSimilar(List<IgdbGameResponseDto> value) {
      similar = value;
      return this;
    }

    GameBuilder withThemes(List<IgdbThemeResponseDto> value) {
      themes = value;
      return this;
    }

    IgdbGameResponseDto build() {
      return new IgdbGameResponseDto(
          id,
          "Game " + id,
          null,
          null,
          new IgdbImageResponseDto(id, "//images.igdb.com/t_thumb/cover" + id + ".jpg"),
          null,
          null,
          releaseDate,
          null,
          null,
          themes,
          companies,
          null,
          80.0,
          10,
          null,
          franchise,
          franchises,
          null,
          null,
          similar);
    }
  }
}
