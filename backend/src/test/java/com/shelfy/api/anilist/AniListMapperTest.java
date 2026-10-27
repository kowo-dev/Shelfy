package com.shelfy.api.anilist;

import static org.assertj.core.api.Assertions.assertThat;

import com.shelfy.api.anilist.client.AniListCharacterNameResponseDto;
import com.shelfy.api.anilist.client.AniListMediaConnectionResponseDto;
import com.shelfy.api.anilist.client.AniListMediaEdgeResponseDto;
import com.shelfy.api.anilist.client.AniListMediaResponseDto;
import com.shelfy.api.anilist.client.AniListStaffConnectionResponseDto;
import com.shelfy.api.anilist.client.AniListStaffDetailResponseDto;
import com.shelfy.api.anilist.client.AniListStaffEdgeResponseDto;
import com.shelfy.api.anilist.client.AniListStaffResponseDto;
import com.shelfy.api.anilist.client.AniListTitleResponseDto;
import com.shelfy.api.anilist.dto.StaffCreditDto;
import java.util.List;
import org.junit.jupiter.api.Test;

class AniListMapperTest {

  @Test
  void toAnimeDetail_creditsAuthorsThenDirectorsAndSkipsOtherStaff() {
    AniListMediaResponseDto payload =
        media(
            List.of(
                staff(1, "Director"),
                staff(2, "Original Creator"),
                staff(3, "Episode Director (ep 4)"),
                staff(4, "Character Design"),
                staff(2, "Original Story")));

    assertThat(AniListMapper.toAnimeDetail(payload).creators())
        .containsExactly(
            new StaffCreditDto(2, "Name 2", "author"), new StaffCreditDto(1, "Name 1", "director"));
  }

  @Test
  void toAnimeDetail_ignoresRolesThatOnlyStartLikeACreatorRole() {
    AniListMediaResponseDto payload =
        media(
            List.of(
                staff(1, "Art Director"),
                staff(2, "Storyboard (eps 3, 7)"),
                staff(3, "Director of Photography"),
                staff(4, "Director (eps 1-12)"),
                staff(5, "Story & Art")));

    assertThat(AniListMapper.toAnimeDetail(payload).creators())
        .containsExactly(
            new StaffCreditDto(5, "Name 5", "author"), new StaffCreditDto(4, "Name 4", "director"));
  }

  @Test
  void toMangaDetail_creditsStoryAndArtAuthors() {
    AniListMediaResponseDto payload =
        media(List.of(staff(5, "Story"), staff(6, "Art"), staff(7, "Assistant")));

    assertThat(AniListMapper.toMangaDetail(payload).creators())
        .extracting(StaffCreditDto::id)
        .containsExactly(5L, 6L);
  }

  @Test
  void toStaffDetail_listsAWorkOnceWhateverTheNumberOfRoles() {
    AniListMediaResponseDto penguinHighway = media(List.of());
    AniListStaffDetailResponseDto payload =
        new AniListStaffDetailResponseDto(
            104852,
            new AniListCharacterNameResponseDto("Hiroyasu Ishida"),
            null,
            null,
            new AniListMediaConnectionResponseDto(
                List.of(
                    new AniListMediaEdgeResponseDto(penguinHighway),
                    new AniListMediaEdgeResponseDto(penguinHighway)),
                null));

    assertThat(AniListMapper.toStaffDetail(payload).media()).hasSize(1);
  }

  private static AniListStaffEdgeResponseDto staff(long id, String role) {
    return new AniListStaffEdgeResponseDto(
        role, new AniListStaffResponseDto(id, new AniListCharacterNameResponseDto("Name " + id)));
  }

  private static AniListMediaResponseDto media(List<AniListStaffEdgeResponseDto> staff) {
    return new AniListMediaResponseDto(
        1,
        "ANIME",
        new AniListTitleResponseDto("Title", null),
        null,
        null,
        null,
        null,
        null,
        null,
        new AniListStaffConnectionResponseDto(staff),
        null,
        null,
        null,
        null,
        null,
        null,
        "JP",
        80.0,
        1000,
        null,
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
