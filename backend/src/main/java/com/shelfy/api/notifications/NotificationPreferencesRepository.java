package com.shelfy.api.notifications;

import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface NotificationPreferencesRepository
    extends JpaRepository<NotificationPreferencesEntity, UUID> {}
