package com.shelfy.api.notifications.dto;

import java.util.List;

public record NotificationPreferencesResponseDto(String audience, List<Family> families) {

  public record Family(String family, boolean isEnabled, List<Setting> settings) {}

  public record Setting(String setting, boolean isEnabled, boolean isEnabledByDefault) {}
}
