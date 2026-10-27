package com.shelfy.api.federation;

import com.shelfy.api.activity.ActivityType;
import com.shelfy.api.activity.UserActivityEntity;
import com.shelfy.api.activity.UserActivityRepository;
import com.shelfy.api.auth.UserEntity;
import com.shelfy.api.collection.MediaEntity;
import com.shelfy.api.collection.RichTextContentValidator;
import com.shelfy.api.collection.UserMediaEntity;
import com.shelfy.api.collection.UserMediaRepository;
import com.shelfy.api.collection.UserMediaStatus;
import com.shelfy.api.common.exception.ApiException;
import java.net.URI;
import java.time.Instant;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@Component
@RequiredArgsConstructor
public class InboundActivities {

  private static final Logger LOG = LoggerFactory.getLogger(InboundActivities.class);

  private final JdbcClient jdbcClient;
  private final ObjectMapper objectMapper;
  private final Works works;
  private final ObjectLookup lookup;
  private final UserMediaRepository userMediaRepository;
  private final UserActivityRepository activityRepository;
  private final RichTextContentValidator richTextValidator;
  private final TransactionTemplate transactionTemplate;

  record ItemState(
      UserMediaStatus status, Integer rating, boolean containsSpoilers, Map<String, Object> note) {}

  public void onCreateOrUpdate(UserEntity signer, String signerUri, JsonNode object) {
    String noteId = Activities.idOf(object);
    if (noteId == null
        || !object.isObject()
        || !signerUri.equals(Activities.idOf(object.path("attributedTo")))
        || !sameHost(noteId, signerUri)
        || !lookup.hasLocalAudience(signer.getId())) {
      return;
    }
    Optional<ActivityType> type =
        Arrays.stream(ActivityType.values())
            .filter(
                value ->
                    value.name().equals(Activities.text(object.path("shelfy:activity"), "type")))
            .filter(ActivityPublisher.FEDERATED::contains)
            .findFirst();
    Optional<ItemState> state = itemState(object.path("shelfy:item"));
    if (type.isEmpty() || state.isEmpty()) {
      return;
    }
    Optional<MediaEntity> media = works.resolve(object.path("shelfy:work"));
    if (media.isEmpty()) {
      LOG.info("No local media for remote activity {}", noteId);
      return;
    }
    Map<String, Object> payload = payload(object.path("shelfy:activity").path("payload"));
    transactionTemplate.executeWithoutResult(
        status -> store(signer, noteId, type.get(), payload, media.get(), state.get()));
  }

  public void onDelete(UserEntity signer, String objectId) {
    transactionTemplate.executeWithoutResult(
        status -> {
          Optional<UUID> activityId =
              jdbcClient
                  .sql(
                      """
                      select activity_id from ap_remote_activities
                      where ap_id = :apId and user_id = :userId
                      """)
                  .param("apId", objectId)
                  .param("userId", signer.getId())
                  .query(UUID.class)
                  .optional();
          activityId
              .flatMap(activityRepository::findById)
              .ifPresent(
                  activity -> {
                    UserMediaEntity item = activity.getUserMedia();
                    activityRepository.delete(activity);
                    activityRepository.flush();
                    if (item != null
                        && item.getUserId().equals(signer.getId())
                        && activityRepository
                            .findByUserMedia_IdIn(List.of(item.getId()))
                            .isEmpty()) {
                      userMediaRepository.delete(item);
                    }
                  });
        });
  }

  private void store(
      UserEntity signer,
      String noteId,
      ActivityType type,
      Map<String, Object> payload,
      MediaEntity media,
      ItemState state) {
    UserMediaEntity item =
        userMediaRepository
            .findByUserIdAndMediaId(signer.getId(), media.getId())
            .orElseGet(
                () ->
                    new UserMediaEntity(
                        signer.getId(), media, state.status(), state.rating(), new HashMap<>()));
    if (state.note() != null && item.getNote() == null) {
      item.setReviewedAt(Instant.now());
    }
    item.setStatus(state.status());
    item.setRating(state.rating());
    item.setContainsSpoilers(state.containsSpoilers());
    item.setNote(state.note());
    UserMediaEntity saved = userMediaRepository.save(item);
    Optional<UserActivityEntity> existing =
        jdbcClient
            .sql(
                """
                select activity_id from ap_remote_activities
                where ap_id = :apId and user_id = :userId
                """)
            .param("apId", noteId)
            .param("userId", signer.getId())
            .query(UUID.class)
            .optional()
            .flatMap(activityRepository::findById);
    if (existing.isPresent()) {
      existing.get().merge(payload);
      activityRepository.save(existing.get());
      return;
    }
    UserActivityEntity activity =
        activityRepository.saveAndFlush(
            new UserActivityEntity(signer.getId(), saved, type, payload));
    jdbcClient
        .sql(
            """
            insert into ap_remote_activities (ap_id, activity_id, user_id)
            values (:apId, :activityId, :userId) on conflict do nothing
            """)
        .param("apId", noteId)
        .param("activityId", activity.getId())
        .param("userId", signer.getId())
        .update();
  }

  private Optional<ItemState> itemState(JsonNode item) {
    Optional<UserMediaStatus> status = UserMediaStatus.parse(Activities.text(item, "status"));
    if (status.isEmpty()) {
      return Optional.empty();
    }
    JsonNode ratingNode = item.path("rating");
    Integer rating = null;
    if (ratingNode.isInt() && ratingNode.asInt() >= 0 && ratingNode.asInt() <= 10) {
      rating = ratingNode.asInt();
    }
    return Optional.of(
        new ItemState(
            status.get(),
            rating,
            item.path("containsSpoilers").asBoolean(false),
            note(item.path("note"))));
  }

  @SuppressWarnings("unchecked")
  private Map<String, Object> note(JsonNode node) {
    if (!node.isObject()) {
      return null;
    }
    Map<String, Object> note = objectMapper.convertValue(node, Map.class);
    try {
      richTextValidator.validate(note);
      return note;
    } catch (ApiException e) {
      return null;
    }
  }

  @SuppressWarnings("unchecked")
  private Map<String, Object> payload(JsonNode node) {
    if (!node.isObject()) {
      return Map.of();
    }
    Map<String, Object> payload = new HashMap<>();
    objectMapper
        .convertValue(node, Map.class)
        .forEach(
            (key, value) -> {
              if (value == null
                  || value instanceof String
                  || value instanceof Number
                  || value instanceof Boolean
                  || value instanceof List<?>) {
                payload.put(String.valueOf(key), value);
              }
            });
    return payload;
  }

  private static boolean sameHost(String a, String b) {
    try {
      return Objects.equals(URI.create(a).getRawAuthority(), URI.create(b).getRawAuthority());
    } catch (IllegalArgumentException e) {
      return false;
    }
  }
}
