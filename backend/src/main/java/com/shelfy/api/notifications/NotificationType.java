package com.shelfy.api.notifications;

import java.util.Arrays;
import java.util.List;

public enum NotificationType {
  NEW_FOLLOWER(NotificationSetting.NEW_FOLLOWERS, Shape.GROUPED),
  COMMENT_ON_CREATION(NotificationSetting.COMMENTS_ON_CREATIONS, Shape.SINGLE),
  COMMENT_REPLY(NotificationSetting.REPLIES_AND_MENTIONS, Shape.SINGLE),
  COMMENT_MENTION(NotificationSetting.REPLIES_AND_MENTIONS, Shape.SINGLE),
  COMMENT_IN_THREAD(NotificationSetting.THREAD_ACTIVITY, Shape.SINGLE),
  CREATION_LIKED(NotificationSetting.CREATION_LIKES, Shape.GROUPED),
  COMMENT_UPVOTED(NotificationSetting.COMMENT_UPVOTES, Shape.GROUPED),
  LIST_COLLABORATION_INVITE(NotificationSetting.COLLABORATION_INVITES, Shape.REQUEST),
  LIST_COLLABORATION_ACCEPTED(NotificationSetting.COLLABORATION_INVITES, Shape.SINGLE),
  VERSUS_COLLABORATION_INVITE(NotificationSetting.COLLABORATION_INVITES, Shape.REQUEST),
  VERSUS_COLLABORATION_ACCEPTED(NotificationSetting.COLLABORATION_INVITES, Shape.SINGLE),
  COLLABORATION_DECLINED(NotificationSetting.COLLABORATION_CHANGES, Shape.SINGLE),
  COLLABORATION_REMOVED(NotificationSetting.COLLABORATION_CHANGES, Shape.SINGLE),
  COLLABORATION_EDITED(NotificationSetting.COLLABORATION_CHANGES, Shape.GROUPED),
  VERSUS_PLAYED(NotificationSetting.VERSUS_PLAYED, Shape.GROUPED),
  REMOTE_FOLLOW_ACCEPTED(NotificationSetting.REMOTE_FOLLOW_ANSWERS, Shape.SINGLE),
  REMOTE_FOLLOW_REJECTED(NotificationSetting.REMOTE_FOLLOW_ANSWERS, Shape.SINGLE),
  ACCOUNT_MOVED(NotificationSetting.ACCOUNT_MOVES, Shape.SINGLE),
  REMOTE_ACCOUNT_DELETED(NotificationSetting.REMOTE_ACCOUNT_DELETED, Shape.SINGLE),
  IMPORT_FINISHED(NotificationSetting.IMPORTS, Shape.SINGLE),
  IMPORT_FAILED(NotificationSetting.IMPORTS, Shape.SINGLE),
  REPORT_RECEIVED(NotificationSetting.ADMIN_REPORTS, Shape.SINGLE),
  DELIVERY_FAILING(NotificationSetting.DELIVERY_FAILURES, Shape.GROUPED);

  enum Shape {
    SINGLE,
    GROUPED,
    REQUEST
  }

  private final NotificationSetting setting;
  private final Shape shape;

  NotificationType(NotificationSetting setting, Shape shape) {
    this.setting = setting;
    this.shape = shape;
  }

  public NotificationSetting setting() {
    return setting;
  }

  public NotificationFamily family() {
    return setting.family();
  }

  public boolean grouped() {
    return shape == Shape.GROUPED;
  }

  public boolean request() {
    return shape == Shape.REQUEST;
  }

  public boolean personal() {
    return request() || this == COMMENT_REPLY || this == COMMENT_MENTION;
  }

  public static List<NotificationType> requests() {
    return Arrays.stream(values()).filter(NotificationType::request).toList();
  }

  public static List<NotificationType> of(NotificationFamily family) {
    return Arrays.stream(values()).filter(type -> type.family() == family).toList();
  }
}
