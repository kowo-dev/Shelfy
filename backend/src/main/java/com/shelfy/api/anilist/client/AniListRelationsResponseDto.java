package com.shelfy.api.anilist.client;

import java.util.List;

public record AniListRelationsResponseDto(List<Edge> edges) {

  public record Edge(String relationType) {}

  public boolean hasPrequel() {
    return edges != null && edges.stream().anyMatch(edge -> "PREQUEL".equals(edge.relationType()));
  }
}
