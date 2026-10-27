package com.shelfy.api.notifications.dto;

import com.shelfy.api.notifications.NotificationAudience;
import com.shelfy.api.notifications.NotificationFamily;
import com.shelfy.api.notifications.NotificationSetting;
import java.util.Map;

public record UpdateNotificationPreferencesRequestDto(
    NotificationAudience audience,
    Map<NotificationFamily, Boolean> families,
    Map<NotificationSetting, Boolean> settings) {}
