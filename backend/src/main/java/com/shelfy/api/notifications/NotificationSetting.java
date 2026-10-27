package com.shelfy.api.notifications;

public enum NotificationSetting {
  NEW_FOLLOWERS(NotificationFamily.RELATIONS, true, true),
  COMMENTS_ON_CREATIONS(NotificationFamily.COMMENTS, true, true),
  REPLIES_AND_MENTIONS(NotificationFamily.COMMENTS, true, true),
  THREAD_ACTIVITY(NotificationFamily.COMMENTS, false, true),
  CREATION_LIKES(NotificationFamily.LIKES, true, true),
  COMMENT_UPVOTES(NotificationFamily.LIKES, true, true),
  COLLABORATION_INVITES(NotificationFamily.COLLABORATION, true, false),
  COLLABORATION_CHANGES(NotificationFamily.COLLABORATION, true, false),
  VERSUS_PLAYED(NotificationFamily.VERSUS, false, true),
  REMOTE_FOLLOW_ANSWERS(NotificationFamily.FEDIVERSE, true, false),
  ACCOUNT_MOVES(NotificationFamily.FEDIVERSE, true, false),
  REMOTE_ACCOUNT_DELETED(NotificationFamily.FEDIVERSE, false, false),
  IMPORTS(NotificationFamily.ACCOUNT, true, false),
  ADMIN_REPORTS(NotificationFamily.MODERATION, true, false),
  DELIVERY_FAILURES(NotificationFamily.MODERATION, false, false);

  private final NotificationFamily family;
  private final boolean enabledByDefault;
  private final boolean audienceFiltered;

  NotificationSetting(
      NotificationFamily family, boolean enabledByDefault, boolean audienceFiltered) {
    this.family = family;
    this.enabledByDefault = enabledByDefault;
    this.audienceFiltered = audienceFiltered;
  }

  public NotificationFamily family() {
    return family;
  }

  public boolean enabledByDefault() {
    return enabledByDefault;
  }

  public boolean audienceFiltered() {
    return audienceFiltered;
  }

  public boolean adminOnly() {
    return family == NotificationFamily.MODERATION;
  }
}
