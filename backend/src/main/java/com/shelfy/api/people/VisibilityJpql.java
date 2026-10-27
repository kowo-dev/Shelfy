package com.shelfy.api.people;

public final class VisibilityJpql {

  private static final String PUBLIC = "com.shelfy.api.auth.CollectionVisibility.PUBLIC";

  public static final String PROFILE_VISIBLE =
      "(owner.id = :viewer or owner.profileVisibility = " + PUBLIC + ")";

  public static final String CONTENT_VISIBLE =
      "(owner.id = :viewer or content.visibility = " + PUBLIC + ")";

  private VisibilityJpql() {}
}
