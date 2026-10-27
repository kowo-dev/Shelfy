package com.shelfy.api.anilist.client;

import java.util.List;

public record AniListCollectionsResponseDto(Data data) {

  public record Data(List<String> GenreCollection, List<Tag> MediaTagCollection) {}

  public record Tag(String name, Boolean isAdult) {}
}
