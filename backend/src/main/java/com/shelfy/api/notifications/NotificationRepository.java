package com.shelfy.api.notifications;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface NotificationRepository extends JpaRepository<NotificationEntity, UUID> {
  @Query(
      value =
          "select n from NotificationEntity n where n.recipient.id = :recipientId "
              + "and n.type in :types and (n.resolvedAt is not null or n.type not in :requests) "
              + "order by n.updatedAt desc",
      countQuery =
          "select count(n) from NotificationEntity n where n.recipient.id = :recipientId "
              + "and n.type in :types and (n.resolvedAt is not null or n.type not in :requests)")
  Page<NotificationEntity> findHistory(
      @Param("recipientId") UUID recipientId,
      @Param("types") Collection<NotificationType> types,
      @Param("requests") Collection<NotificationType> requests,
      Pageable pageable);

  @Query(
      "select n from NotificationEntity n where n.recipient.id = :recipientId "
          + "and n.type in :requests and n.resolvedAt is null order by n.updatedAt desc")
  List<NotificationEntity> findOpenRequests(
      @Param("recipientId") UUID recipientId,
      @Param("requests") Collection<NotificationType> requests,
      Pageable pageable);

  Optional<NotificationEntity> findByIdAndRecipientId(UUID id, UUID recipientId);

  @Modifying
  @Query(
      "update NotificationEntity n set n.readAt = CURRENT_TIMESTAMP "
          + "where n.recipient.id = :recipientId and n.readAt is null")
  void markAllReadForRecipient(@Param("recipientId") UUID recipientId);

  @Modifying
  @Query(
      "delete from NotificationEntity n where n.id = :id and n.recipient.id = :recipientId "
          + "and (n.resolvedAt is not null or n.type not in :requests)")
  int deleteHistoryItem(
      @Param("id") UUID id,
      @Param("recipientId") UUID recipientId,
      @Param("requests") Collection<NotificationType> requests);

  @Modifying
  @Query(
      "delete from NotificationEntity n where n.recipient.id = :recipientId "
          + "and (n.resolvedAt is not null or n.type not in :requests)")
  int deleteHistory(
      @Param("recipientId") UUID recipientId,
      @Param("requests") Collection<NotificationType> requests);

  @Modifying
  @Query(
      "delete from NotificationEntity n where n.readAt < :before "
          + "and (n.resolvedAt is not null or n.type not in :requests)")
  int purgeReadBefore(
      @Param("before") Instant before, @Param("requests") Collection<NotificationType> requests);
}
