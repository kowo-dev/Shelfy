package com.shelfy.api.collaboration;

import com.shelfy.api.comments.CommentTargetType;
import com.shelfy.api.common.exception.ErrorCode;
import com.shelfy.api.notifications.NotificationType;

public record CollaborationKind(
    String noun,
    CommentTargetType commentTarget,
    String notificationTarget,
    String nameParam,
    NotificationType inviteNotification,
    NotificationType acceptedNotification,
    ErrorCode notFound,
    ErrorCode mustFollow,
    ErrorCode alreadyExists,
    ErrorCode collaboratorNotFound) {}
