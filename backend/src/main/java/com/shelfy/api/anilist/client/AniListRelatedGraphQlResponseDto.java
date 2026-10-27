package com.shelfy.api.anilist.client;

import java.util.List;

public record AniListRelatedGraphQlResponseDto(Data data) {

  public record Data(Media Media) {}

  public record Media(
      long id,
      String type,
      AniListStudioConnectionResponseDto studios,
      AniListStaffConnectionResponseDto staff,
      RelationConnection relations,
      RecommendationConnection recommendations) {}

  public record RelationConnection(List<RelationEdge> edges) {}

  public record RelationEdge(String relationType, AniListMediaResponseDto node) {}

  public record RecommendationConnection(
      AniListPageInfoResponseDto pageInfo, List<RecommendationNode> nodes) {}

  public record RecommendationNode(AniListMediaResponseDto mediaRecommendation) {}

  public record StaffWorks(StaffWorksData data) {}

  public record StaffWorksData(StaffWorksStaff Staff) {}

  public record StaffWorksStaff(StaffWorksConnection staffMedia) {}

  public record StaffWorksConnection(List<StaffWork> edges) {}

  public record StaffWork(String staffRole, AniListMediaResponseDto node) {}
}
