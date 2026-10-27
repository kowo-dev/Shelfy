package com.shelfy.api.community;

public final class CommunityJpql {

  public static final String OWNER_IN_CIRCLE =
      "exists (select 1 from FollowEntity fo where fo.followerId = :viewer and"
          + " fo.followedId = owner.id)";

  public static final String FAVORITES_FIRST =
      " order by case when :circleOnly = true and exists (select 1 from FollowEntity fav"
          + " where fav.followerId = :viewer and fav.followedId = owner.id and fav.favorite ="
          + " true) then 0 else 1 end,";

  public static final String OWNER_MATCHES =
      "unaccent(lower(owner.username)) like unaccent(:q)"
          + " or unaccent(lower(coalesce(owner.displayName, ''))) like unaccent(:q)";

  public static final String CIRCLE_SCOPE =
      " and (:circleOnly = false or (owner.id <> :viewer and " + OWNER_IN_CIRCLE + "))";

  public static final String REMOTE_SCOPE =
      " and (:remoteOnly = false or owner.domain is not null)";

  private CommunityJpql() {}
}
