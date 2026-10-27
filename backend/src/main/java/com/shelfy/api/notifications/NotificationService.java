package com.shelfy.api.notifications;

import com.shelfy.api.auth.AvatarStorageService;
import com.shelfy.api.auth.UserEntity;
import com.shelfy.api.auth.UserRepository;
import com.shelfy.api.common.dto.PagedResponseDto;
import com.shelfy.api.common.exception.ErrorCode;
import com.shelfy.api.common.exception.ResourceNotFoundException;
import com.shelfy.api.federation.FederationProperties;
import com.shelfy.api.notifications.dto.NotificationActorDto;
import com.shelfy.api.notifications.dto.NotificationPreferencesResponseDto;
import com.shelfy.api.notifications.dto.NotificationResponseDto;
import com.shelfy.api.notifications.dto.NotificationSummaryResponseDto;
import com.shelfy.api.notifications.dto.UpdateNotificationPreferencesRequestDto;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collection;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.ObjectMapper;

@Service
public class NotificationService {
  private static final Logger LOG = LoggerFactory.getLogger(NotificationService.class);
  private static final int ACTOR_PREVIEW = 3;
  private static final int MAX_OPEN_REQUESTS = 50;

  private final NotificationRepository repository;
  private final NotificationPreferencesRepository preferencesRepository;
  private final UserRepository userRepository;
  private final AvatarStorageService avatarStorageService;
  private final NotificationTargets targets;
  private final FederationProperties federationProperties;
  private final JdbcClient jdbcClient;
  private final ObjectMapper objectMapper;
  private final TransactionTemplate separateTransaction;

  public NotificationService(
      NotificationRepository repository,
      NotificationPreferencesRepository preferencesRepository,
      UserRepository userRepository,
      AvatarStorageService avatarStorageService,
      NotificationTargets targets,
      FederationProperties federationProperties,
      JdbcClient jdbcClient,
      ObjectMapper objectMapper,
      PlatformTransactionManager transactionManager) {
    this.repository = repository;
    this.preferencesRepository = preferencesRepository;
    this.userRepository = userRepository;
    this.avatarStorageService = avatarStorageService;
    this.targets = targets;
    this.federationProperties = federationProperties;
    this.jdbcClient = jdbcClient;
    this.objectMapper = objectMapper;
    this.separateTransaction = new TransactionTemplate(transactionManager);
    this.separateTransaction.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
  }

  public void create(
      UUID recipientId,
      UUID actorId,
      NotificationType type,
      String targetType,
      UUID targetId,
      Map<String, Object> payload) {
    if (recipientId == null || recipientId.equals(actorId)) {
      return;
    }
    Map<String, Object> extra = payload == null ? Map.of() : new HashMap<>(payload);
    afterCommit(() -> deliver(recipientId, actorId, type, targetType, targetId, extra, null));
  }

  public void notifyAdmins(
      NotificationType type,
      UUID actorId,
      String targetType,
      UUID targetId,
      Map<String, Object> payload,
      String groupKey) {
    Map<String, Object> extra = payload == null ? Map.of() : new HashMap<>(payload);
    afterCommit(
        () ->
            adminIds().stream()
                .filter(id -> !id.equals(actorId))
                .forEach(id -> deliver(id, actorId, type, targetType, targetId, extra, groupKey)));
  }

  public void retract(
      UUID recipientId, UUID actorId, NotificationType type, String targetType, UUID targetId) {
    if (recipientId == null || actorId == null || !type.grouped()) {
      return;
    }
    String groupKey = groupKey(type, targetType, targetId);
    afterCommit(
        () -> {
          jdbcClient
              .sql(
                  """
                  delete from notification_actors na using notifications n
                  where na.notification_id = n.id and n.recipient_id = :recipient
                    and n.group_key = :groupKey and n.read_at is null and na.actor_id = :actor
                  """)
              .param("recipient", recipientId)
              .param("groupKey", groupKey)
              .param("actor", actorId)
              .update();
          jdbcClient
              .sql(
                  """
                  delete from notifications n
                  where n.recipient_id = :recipient and n.group_key = :groupKey and n.read_at is null
                    and not exists (select 1 from notification_actors na where na.notification_id = n.id)
                  """)
              .param("recipient", recipientId)
              .param("groupKey", groupKey)
              .update();
          jdbcClient
              .sql(
                  """
                  update notifications n set actor_id = (
                      select na.actor_id from notification_actors na
                      where na.notification_id = n.id order by na.created_at desc limit 1)
                  where n.recipient_id = :recipient and n.group_key = :groupKey and n.read_at is null
                  """)
              .param("recipient", recipientId)
              .param("groupKey", groupKey)
              .update();
        });
  }

  public void resolve(
      UUID recipientId, NotificationType type, String targetType, UUID targetId, String outcome) {
    afterCommit(
        () ->
            jdbcClient
                .sql(
                    """
                    update notifications
                    set resolved_at = now(), read_at = coalesce(read_at, now()),
                        payload = coalesce(payload, '{}'::jsonb) || jsonb_build_object('outcome', :outcome)
                    where recipient_id = :recipient and type = :type and target_type = :targetType
                      and target_id = :targetId and resolved_at is null
                    """)
                .param("outcome", outcome)
                .param("recipient", recipientId)
                .param("type", type.name())
                .param("targetType", targetType)
                .param("targetId", targetId)
                .update());
  }

  public void withdraw(UUID recipientId, NotificationType type, String targetType, UUID targetId) {
    afterCommit(
        () ->
            jdbcClient
                .sql(
                    """
                    delete from notifications
                    where recipient_id = :recipient and type = :type and target_type = :targetType
                      and target_id = :targetId and resolved_at is null
                    """)
                .param("recipient", recipientId)
                .param("type", type.name())
                .param("targetType", targetType)
                .param("targetId", targetId)
                .update());
  }

  @Transactional
  public void deleteForTargets(String targetType, Collection<UUID> targetIds) {
    if (targetIds.isEmpty()) {
      return;
    }
    jdbcClient
        .sql("delete from notifications where target_type = :targetType and target_id in (:ids)")
        .param("targetType", targetType)
        .param("ids", targetIds)
        .update();
  }

  @Transactional(readOnly = true)
  public PagedResponseDto<NotificationResponseDto> list(
      UUID userId, NotificationFamily family, Pageable pageable) {
    List<NotificationType> types =
        family == null ? Arrays.asList(NotificationType.values()) : NotificationType.of(family);
    Page<NotificationEntity> page =
        repository.findHistory(userId, types, NotificationType.requests(), pageable);
    return new PagedResponseDto<>(
        responses(page.getContent()), page.getNumber(), page.getSize(), page.getTotalElements());
  }

  @Transactional(readOnly = true)
  public List<NotificationResponseDto> openRequests(UUID userId) {
    return responses(
        repository.findOpenRequests(
            userId, NotificationType.requests(), PageRequest.of(0, MAX_OPEN_REQUESTS)));
  }

  @Transactional(readOnly = true)
  public NotificationSummaryResponseDto getSummary(UUID userId) {
    Map<String, NotificationType> byName =
        Arrays.stream(NotificationType.values())
            .collect(Collectors.toMap(NotificationType::name, Function.identity()));
    Map<String, Long> families = new LinkedHashMap<>();
    Map<String, Long> totals = new LinkedHashMap<>();
    long total = 0;
    long personal = 0;
    long all = 0;
    List<TypeCount> counts =
        jdbcClient
            .sql(
                """
                select type, count(*) as kept, count(*) filter (where read_at is null) as unread
                from notifications where recipient_id = :recipient group by type
                """)
            .param("recipient", userId)
            .query(
                (rs, row) ->
                    new TypeCount(rs.getString("type"), rs.getLong("kept"), rs.getLong("unread")))
            .list();
    for (TypeCount count : counts) {
      NotificationType type = byName.get(count.type());
      if (type == null) {
        continue;
      }
      String family = type.family().name();
      all += count.kept();
      totals.merge(family, count.kept(), Long::sum);
      if (count.unread() > 0) {
        total += count.unread();
        families.merge(family, count.unread(), Long::sum);
        if (type.personal()) {
          personal += count.unread();
        }
      }
    }
    return new NotificationSummaryResponseDto(total, personal, families, all, totals);
  }

  @Transactional
  public void markRead(UUID userId, UUID notificationId) {
    NotificationEntity notification =
        repository
            .findByIdAndRecipientId(notificationId, userId)
            .orElseThrow(
                () ->
                    new ResourceNotFoundException(
                        ErrorCode.NOTIFICATION_NOT_FOUND, "Notification not found"));
    notification.markRead();
  }

  @Transactional
  public void markAllRead(UUID userId) {
    repository.markAllReadForRecipient(userId);
  }

  @Transactional
  public void clear(UUID userId, UUID notificationId) {
    if (repository.deleteHistoryItem(notificationId, userId, NotificationType.requests()) == 0) {
      throw new ResourceNotFoundException(
          ErrorCode.NOTIFICATION_NOT_FOUND, "Notification not found");
    }
  }

  @Transactional
  public void clearAll(UUID userId) {
    repository.deleteHistory(userId, NotificationType.requests());
  }

  @Transactional(readOnly = true)
  public NotificationPreferencesResponseDto getPreferences(UUID userId) {
    return preferencesResponse(userId, loadPreferences(userId));
  }

  @Transactional
  public NotificationPreferencesResponseDto updatePreferences(
      UUID userId, UpdateNotificationPreferencesRequestDto request) {
    NotificationPreferencesEntity preferences = loadPreferences(userId);
    if (request.audience() != null) {
      preferences.setAudience(request.audience());
    }
    if (request.families() != null) {
      request.families().forEach(preferences::setFamily);
    }
    if (request.settings() != null) {
      request.settings().forEach(preferences::setSetting);
    }
    return preferencesResponse(userId, preferencesRepository.save(preferences));
  }

  private NotificationPreferencesEntity loadPreferences(UUID userId) {
    return preferencesRepository
        .findById(userId)
        .orElseGet(() -> NotificationPreferencesEntity.defaults(userId));
  }

  private NotificationPreferencesResponseDto preferencesResponse(
      UUID userId, NotificationPreferencesEntity preferences) {
    boolean admin = userRepository.findById(userId).map(this::isAdmin).orElse(false);
    Map<NotificationFamily, List<NotificationPreferencesResponseDto.Setting>> settings =
        new LinkedHashMap<>();
    for (NotificationSetting setting : NotificationSetting.values()) {
      if (setting.adminOnly() && !admin) {
        continue;
      }
      settings
          .computeIfAbsent(setting.family(), family -> new ArrayList<>())
          .add(
              new NotificationPreferencesResponseDto.Setting(
                  setting.name(), preferences.settingEnabled(setting), setting.enabledByDefault()));
    }
    List<NotificationPreferencesResponseDto.Family> families =
        settings.entrySet().stream()
            .map(
                entry ->
                    new NotificationPreferencesResponseDto.Family(
                        entry.getKey().name(),
                        preferences.familyEnabled(entry.getKey()),
                        entry.getValue()))
            .toList();
    return new NotificationPreferencesResponseDto(preferences.getAudience().name(), families);
  }

  private void afterCommit(Runnable work) {
    Runnable guarded =
        () -> {
          try {
            separateTransaction.executeWithoutResult(status -> work.run());
          } catch (RuntimeException e) {
            LOG.warn("Notification skipped: {}", e.getMessage());
          }
        };
    if (TransactionSynchronizationManager.isActualTransactionActive()) {
      TransactionSynchronizationManager.registerSynchronization(
          new TransactionSynchronization() {
            @Override
            public void afterCommit() {
              guarded.run();
            }
          });
    } else {
      guarded.run();
    }
  }

  private void deliver(
      UUID recipientId,
      UUID actorId,
      NotificationType type,
      String targetType,
      UUID targetId,
      Map<String, Object> payload,
      String explicitGroupKey) {
    UserEntity recipient = userRepository.findById(recipientId).orElse(null);
    if (recipient == null || recipient.getDomain() != null) {
      return;
    }
    NotificationSetting setting = type.setting();
    if (setting.adminOnly() && !isAdmin(recipient)) {
      return;
    }
    NotificationPreferencesEntity preferences = loadPreferences(recipientId);
    if (!preferences.allows(setting)) {
      return;
    }
    if (actorId != null
        && setting.audienceFiltered()
        && preferences.getAudience() == NotificationAudience.CONNECTIONS
        && !connected(recipientId, actorId)) {
      return;
    }
    Map<String, Object> full = new HashMap<>(targets.describe(targetType, targetId));
    full.putAll(payload);
    String groupKey =
        explicitGroupKey != null
            ? explicitGroupKey
            : type.grouped() ? groupKey(type, targetType, targetId) : null;
    if (groupKey != null && actorId != null && alreadyCounted(recipientId, groupKey, actorId)) {
      return;
    }
    UUID notificationId =
        jdbcClient
            .sql(
                """
                insert into notifications (id, recipient_id, actor_id, type, target_type, target_id,
                                           payload, group_key, created_at, updated_at)
                values (gen_random_uuid(), :recipient, :actor, :type, :targetType, :targetId,
                        cast(:payload as jsonb), :groupKey, now(), now())
                on conflict (recipient_id, group_key) where read_at is null and group_key is not null
                do update set actor_id = coalesce(excluded.actor_id, notifications.actor_id),
                              payload = excluded.payload, updated_at = now()
                returning id
                """)
            .param("recipient", recipientId)
            .param("actor", actorId)
            .param("type", type.name())
            .param("targetType", targetType)
            .param("targetId", targetId)
            .param("payload", objectMapper.writeValueAsString(full))
            .param("groupKey", groupKey)
            .query(UUID.class)
            .single();
    if (actorId != null) {
      jdbcClient
          .sql(
              """
              insert into notification_actors (notification_id, actor_id)
              values (:notification, :actor) on conflict do nothing
              """)
          .param("notification", notificationId)
          .param("actor", actorId)
          .update();
    }
  }

  private boolean alreadyCounted(UUID recipientId, String groupKey, UUID actorId) {
    return jdbcClient
        .sql(
            """
            select exists (
                select 1 from notification_actors na join notifications n on n.id = na.notification_id
                where n.recipient_id = :recipient and n.group_key = :groupKey and na.actor_id = :actor)
            """)
        .param("recipient", recipientId)
        .param("groupKey", groupKey)
        .param("actor", actorId)
        .query(Boolean.class)
        .single();
  }

  private boolean connected(UUID recipientId, UUID actorId) {
    return jdbcClient
        .sql(
            """
            select exists (select 1 from follows where follower_id = :me and followed_id = :other)
            """)
        .param("me", recipientId)
        .param("other", actorId)
        .query(Boolean.class)
        .single();
  }

  private List<UUID> adminIds() {
    List<String> emails =
        federationProperties.admins() == null
            ? List.of()
            : federationProperties.admins().stream()
                .map(email -> email.strip().toLowerCase(Locale.ROOT))
                .filter(email -> !email.isEmpty())
                .toList();
    if (emails.isEmpty()) {
      return List.of();
    }
    return jdbcClient
        .sql(
            """
            select id from users
            where domain is null and email_verified and lower(email) in (:emails)
            """)
        .param("emails", emails)
        .query(UUID.class)
        .list();
  }

  private boolean isAdmin(UserEntity user) {
    return federationProperties.isAdmin(
        user.getEmail(), user.isEmailVerified(), user.getDomain() == null);
  }

  static String groupKey(NotificationType type, String targetType, UUID targetId) {
    return targetId == null ? type.name() : type.name() + ":" + targetType + ":" + targetId;
  }

  private List<NotificationResponseDto> responses(List<NotificationEntity> notifications) {
    if (notifications.isEmpty()) {
      return List.of();
    }
    List<UUID> ids = notifications.stream().map(NotificationEntity::getId).toList();
    List<ActorRow> rows =
        jdbcClient
            .sql(
                """
                select notification_id, actor_id, total from (
                    select na.notification_id, na.actor_id,
                           count(*) over (partition by na.notification_id) as total,
                           row_number() over (partition by na.notification_id
                                              order by na.created_at desc) as rank
                    from notification_actors na where na.notification_id in (:ids)) ranked
                where rank <= :limit order by notification_id, rank
                """)
            .param("ids", ids)
            .param("limit", ACTOR_PREVIEW)
            .query(
                (rs, row) ->
                    new ActorRow(
                        rs.getObject("notification_id", UUID.class),
                        rs.getObject("actor_id", UUID.class),
                        rs.getInt("total")))
            .list();
    Map<UUID, NotificationActorDto> actors =
        userRepository
            .findAllById(rows.stream().map(ActorRow::actorId).distinct().toList())
            .stream()
            .map(this::actor)
            .collect(Collectors.toMap(NotificationActorDto::id, Function.identity()));
    Map<UUID, List<ActorRow>> byNotification =
        rows.stream().collect(Collectors.groupingBy(ActorRow::notificationId));
    Map<UUID, String> currentTitles = currentCreationTitles(notifications);
    return notifications.stream()
        .map(
            notification -> {
              List<ActorRow> mine = byNotification.getOrDefault(notification.getId(), List.of());
              List<NotificationActorDto> previews =
                  mine.stream()
                      .map(row -> actors.get(row.actorId()))
                      .filter(actor -> actor != null)
                      .toList();
              return new NotificationResponseDto(
                  notification.getId(),
                  notification.getType().name(),
                  notification.getType().family().name(),
                  previews.isEmpty() ? null : previews.getFirst(),
                  previews,
                  mine.isEmpty() ? 0 : mine.getFirst().total(),
                  notification.getTargetType(),
                  notification.getTargetId(),
                  withCurrentTitle(notification, currentTitles),
                  notification.getCreatedAt(),
                  notification.getUpdatedAt(),
                  notification.isRead(),
                  notification.isResolved());
            })
        .toList();
  }

  private Map<UUID, String> currentCreationTitles(List<NotificationEntity> notifications) {
    List<UUID> ids =
        notifications.stream()
            .filter(n -> isCreationTarget(n.getTargetType()) && n.getTargetId() != null)
            .map(NotificationEntity::getTargetId)
            .distinct()
            .toList();
    if (ids.isEmpty()) {
      return Map.of();
    }
    return jdbcClient
        .sql(
            """
            select id, name from media_lists where id in (:ids)
            union all
            select id, name from versus_pools where id in (:ids)
            """)
        .param("ids", ids)
        .query((rs, row) -> Map.entry(rs.getObject("id", UUID.class), rs.getString("name")))
        .list()
        .stream()
        .collect(Collectors.toMap(Map.Entry::getKey, Map.Entry::getValue, (first, next) -> first));
  }

  private static Map<String, Object> withCurrentTitle(
      NotificationEntity notification, Map<UUID, String> currentTitles) {
    Map<String, Object> payload =
        notification.getPayload() == null ? Map.of() : notification.getPayload();
    String title =
        isCreationTarget(notification.getTargetType())
            ? currentTitles.get(notification.getTargetId())
            : null;
    if (title == null) {
      return payload;
    }
    Map<String, Object> current = new HashMap<>(payload);
    current.put("title", title);
    return current;
  }

  private static boolean isCreationTarget(String targetType) {
    return "LIST".equals(targetType) || "VERSUS_POOL".equals(targetType);
  }

  private NotificationActorDto actor(UserEntity user) {
    return new NotificationActorDto(
        user.getId(),
        user.getUsername(),
        user.getDisplayName(),
        avatarStorageService.urlFor(user.getAvatarFilename()),
        user.getDomain());
  }

  private record ActorRow(UUID notificationId, UUID actorId, int total) {}

  private record TypeCount(String type, long kept, long unread) {}
}
