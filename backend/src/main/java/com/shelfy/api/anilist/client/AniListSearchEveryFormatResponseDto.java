package com.shelfy.api.anilist.client;

public record AniListSearchEveryFormatResponseDto(Data data) {

  public record Data(
      AniListPageResponseDto anime, AniListPageResponseDto manga, AniListPageResponseDto webtoon) {}
}
