package com.shelfy.api.anilist;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.shelfy.api.anilist.client.AniListCharacterNameResponseDto;
import com.shelfy.api.anilist.client.AniListClient;
import com.shelfy.api.anilist.client.AniListMediaConnectionResponseDto;
import com.shelfy.api.anilist.client.AniListMediaEdgeResponseDto;
import com.shelfy.api.anilist.client.AniListMediaResponseDto;
import com.shelfy.api.anilist.client.AniListPageInfoResponseDto;
import com.shelfy.api.anilist.client.AniListStaffDataResponseDto;
import com.shelfy.api.anilist.client.AniListStaffDetailResponseDto;
import com.shelfy.api.anilist.client.AniListStaffGraphQlResponseDto;
import com.shelfy.api.anilist.client.AniListTitleResponseDto;
import com.shelfy.api.anilist.dto.AniListEntityMediaResponseDto;
import com.shelfy.api.common.cache.ProviderCache;
import java.time.Duration;
import java.util.List;
import java.util.stream.LongStream;
import org.junit.jupiter.api.Test;

class AniListServiceTest {

  private final AniListClient client = mock(AniListClient.class);
  private final AniListService service =
      new AniListService(client, mock(ProviderCache.class), Duration.ZERO);

  @Test
  void getStaff_readsMoreCreditPagesWhenRolesCrowdOutTheWorks() {
    when(client.fetchStaffById(1, 1)).thenReturn(staffPage(true, 10, 10, 10, 11, 11));
    when(client.fetchStaffById(1, 2)).thenReturn(staffPage(false, 11, 12, 13));

    List<AniListEntityMediaResponseDto> media = service.getStaff(1).media();

    assertThat(media)
        .extracting(AniListEntityMediaResponseDto::id)
        .containsExactly(10L, 11L, 12L, 13L);
  }

  @Test
  void getStaff_stopsOnceThereAreEnoughWorks() {
    long[] works = LongStream.rangeClosed(1, 25).toArray();
    when(client.fetchStaffById(1, 1)).thenReturn(staffPage(true, works));

    assertThat(service.getStaff(1).media()).hasSize(25);
    verify(client, never()).fetchStaffById(1, 2);
  }

  private static AniListStaffGraphQlResponseDto staffPage(boolean hasNextPage, long... workIds) {
    List<AniListMediaEdgeResponseDto> edges =
        LongStream.of(workIds).mapToObj(id -> new AniListMediaEdgeResponseDto(work(id))).toList();
    return new AniListStaffGraphQlResponseDto(
        new AniListStaffDataResponseDto(
            new AniListStaffDetailResponseDto(
                1,
                new AniListCharacterNameResponseDto("Masaaki Yuasa"),
                null,
                null,
                new AniListMediaConnectionResponseDto(
                    edges, new AniListPageInfoResponseDto(hasNextPage)))));
  }

  private static AniListMediaResponseDto work(long id) {
    return new AniListMediaResponseDto(
        id,
        "ANIME",
        new AniListTitleResponseDto("Work " + id, null),
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
