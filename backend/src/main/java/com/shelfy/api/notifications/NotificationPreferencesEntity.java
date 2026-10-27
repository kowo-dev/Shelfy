package com.shelfy.api.notifications;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "notification_preferences")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class NotificationPreferencesEntity {
  static final String FAMILY_PREFIX = "family:";

  @Id
  @Column(name = "user_id")
  private UUID userId;

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(columnDefinition = "jsonb", nullable = false)
  private Map<String, Boolean> overrides = new HashMap<>();

  @Enumerated(EnumType.STRING)
  @Column(nullable = false, length = 20)
  private NotificationAudience audience = NotificationAudience.EVERYONE;

  @Column(name = "updated_at", nullable = false)
  private Instant updatedAt;

  public NotificationPreferencesEntity(UUID userId) {
    this.userId = userId;
  }

  public static NotificationPreferencesEntity defaults(UUID userId) {
    return new NotificationPreferencesEntity(userId);
  }

  public boolean familyEnabled(NotificationFamily family) {
    return overrides.getOrDefault(FAMILY_PREFIX + family.name(), true);
  }

  public boolean settingEnabled(NotificationSetting setting) {
    return overrides.getOrDefault(setting.name(), setting.enabledByDefault());
  }

  public boolean allows(NotificationSetting setting) {
    return familyEnabled(setting.family()) && settingEnabled(setting);
  }

  public void setFamily(NotificationFamily family, boolean enabled) {
    store(FAMILY_PREFIX + family.name(), enabled, true);
  }

  public void setSetting(NotificationSetting setting, boolean enabled) {
    store(setting.name(), enabled, setting.enabledByDefault());
  }

  public void setAudience(NotificationAudience audience) {
    this.audience = audience;
  }

  private void store(String key, boolean enabled, boolean byDefault) {
    Map<String, Boolean> next = new HashMap<>(overrides);
    if (enabled == byDefault) {
      next.remove(key);
    } else {
      next.put(key, enabled);
    }
    overrides = next;
  }

  @PrePersist
  @PreUpdate
  void touched() {
    updatedAt = Instant.now();
  }
}
