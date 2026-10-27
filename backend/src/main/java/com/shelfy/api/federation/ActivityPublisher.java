package com.shelfy.api.federation;

import com.shelfy.api.activity.ActivityType;
import com.shelfy.api.activity.UserActivityEntity;
import com.shelfy.api.activity.UserActivityRepository;
import com.shelfy.api.auth.CollectionVisibility;
import com.shelfy.api.auth.UserRepository;
import com.shelfy.api.collection.MediaEntity;
import com.shelfy.api.collection.UserMediaEntity;
import com.shelfy.api.collection.UserMediaStatus;
import java.util.EnumSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.util.HtmlUtils;

@Component
@RequiredArgsConstructor
public class ActivityPublisher {

  public static final String PUBLIC = "https://www.w3.org/ns/activitystreams#Public";
  public static final Set<ActivityType> FEDERATED =
      EnumSet.of(
          ActivityType.ADDED,
          ActivityType.REVIEWED,
          ActivityType.RATED,
          ActivityType.STATUS_CHANGED);

  private final FederationProperties properties;
  private final FederationUris uris;
  private final JdbcClient jdbcClient;
  private final DeliveryService deliveryService;
  private final UserRepository userRepository;
  private final UserActivityRepository activityRepository;
  private final Works works;

  @Transactional(readOnly = true)
  public Optional<Map<String, Object>> noteDocument(UUID activityId) {
    return activityRepository
        .findById(activityId)
        .filter(this::isPublic)
        .map(
            activity -> {
              Map<String, Object> note = new LinkedHashMap<>();
              note.put("@context", ActorDocuments.CONTEXT);
              note.putAll(note(activity, publicAudience(activity.getUserId())));
              return note;
            });
  }

  @Transactional(readOnly = true)
  public Map<String, Object> outbox(UUID userId, int size) {
    List<Object> items =
        activityRepository
            .findByUserIdAndActivityTypeInOrderByCreatedAtDesc(
                userId, FEDERATED, PageRequest.of(0, size))
            .stream()
            .filter(this::isPublic)
            .<Object>map(this::create)
            .toList();
    Map<String, Object> outbox = new LinkedHashMap<>();
    outbox.put("@context", ActorDocuments.CONTEXT);
    outbox.put("id", uris.outbox(userId));
    outbox.put("type", "OrderedCollection");
    outbox.put("totalItems", activityRepository.countByUserIdAndActivityTypeIn(userId, FEDERATED));
    outbox.put("orderedItems", items);
    return outbox;
  }

  record Audience(List<String> to, List<String> cc, List<String> inboxes) {}

  public void published(UserActivityEntity activity, boolean created) {
    if (!properties.enabled()
        || activity.getUserMedia() == null
        || !FEDERATED.contains(activity.getActivityType())) {
      return;
    }
    Optional<Audience> audience = audience(activity.getUserId(), CollectionVisibility.PUBLIC);
    if (audience.isEmpty() || audience.get().inboxes().isEmpty()) {
      return;
    }
    List<String> inboxes = audience.get().inboxes();
    Map<String, Object> note = note(activity, audience.get());
    String id =
        created
            ? note.get("id") + "/create"
            : note.get("id") + "/update/" + activity.getCreatedAt().toEpochMilli();
    Map<String, Object> wrapped = wrap(created ? "Create" : "Update", id, note);
    inboxes.forEach(inbox -> deliveryService.enqueue(activity.getUserId(), inbox, wrapped));
  }

  public void deleted(List<UserActivityEntity> activities) {
    if (!properties.enabled()) {
      return;
    }
    for (UserActivityEntity activity : activities) {
      Optional<Audience> audience =
          FEDERATED.contains(activity.getActivityType())
              ? audience(activity.getUserId(), CollectionVisibility.PUBLIC)
              : Optional.empty();
      if (audience.isEmpty()) {
        continue;
      }
      String objectId = objectId(activity.getId());
      String actor = uris.actor(activity.getUserId());
      Map<String, Object> delete = new LinkedHashMap<>();
      delete.put("@context", ActorDocuments.ACTIVITY_STREAMS);
      delete.put("id", objectId + "/delete");
      delete.put("type", "Delete");
      delete.put("actor", actor);
      delete.put("to", audience.get().to());
      delete.put("object", Map.of("id", objectId, "type", "Tombstone"));
      audience
          .get()
          .inboxes()
          .forEach(inbox -> deliveryService.enqueue(activity.getUserId(), inbox, delete));
    }
  }

  public boolean isPublic(UserActivityEntity activity) {
    return properties.enabled()
        && activity.getUserMedia() != null
        && FEDERATED.contains(activity.getActivityType())
        && userRepository
            .findById(activity.getUserId())
            .filter(user -> user.getDomain() == null)
            .filter(user -> user.federatedVisibility() == CollectionVisibility.PUBLIC)
            .isPresent();
  }

  public Map<String, Object> create(UserActivityEntity activity) {
    Map<String, Object> note = note(activity, publicAudience(activity.getUserId()));
    return wrap("Create", note.get("id") + "/create", note);
  }

  public String objectId(UUID activityId) {
    return uris.activity(activityId);
  }

  Map<String, Object> note(UserActivityEntity activity, Audience audience) {
    UserMediaEntity item = activity.getUserMedia();
    MediaEntity media = item.getMedia();
    String actor = uris.actor(activity.getUserId());
    Map<String, Object> note = new LinkedHashMap<>();
    note.put("id", objectId(activity.getId()));
    note.put("type", "Note");
    note.put("attributedTo", actor);
    note.put("to", audience.to());
    note.put("cc", audience.cc());
    note.put("published", activity.getCreatedAt().toString());
    note.put("url", uris.web(webPath(activity, media)));
    boolean spoilers =
        activity.getActivityType() == ActivityType.REVIEWED && item.isContainsSpoilers();
    if (spoilers) {
      note.put("summary", "Spoilers: " + media.getTitle());
    }
    note.put("sensitive", spoilers || media.isAdult());
    List<String> hashtags = hashtags(media);
    note.put("content", content(activity, item, media) + hashtagLine(hashtags));
    note.put("tag", hashtags.stream().map(this::hashtag).toList());
    if (media.getCoverUrl() != null && !media.isAdult()) {
      note.put(
          "attachment",
          List.of(Map.of("type", "Image", "url", media.getCoverUrl(), "name", media.getTitle())));
    }
    note.put(
        "shelfy:activity",
        Map.of("type", activity.getActivityType().name(), "payload", activity.getPayload()));
    note.put("shelfy:work", works.describe(media));
    note.put("shelfy:item", item(item));
    return note;
  }

  private static List<String> hashtags(MediaEntity media) {
    String type = media.getMediaType().getValue().replaceAll("[^A-Za-z0-9]", "");
    return type.isEmpty() ? List.of("shelfy") : List.of(type, "shelfy");
  }

  private Map<String, Object> hashtag(String name) {
    return Map.of("type", "Hashtag", "name", "#" + name, "href", tagUrl(name));
  }

  private String tagUrl(String name) {
    return name.equals("shelfy") ? uris.web("/discover") : uris.web("/explore?type=" + name);
  }

  private String hashtagLine(List<String> hashtags) {
    return "<p>"
        + hashtags.stream()
            .map(
                name ->
                    "<a href=\""
                        + tagUrl(name)
                        + "\" class=\"mention hashtag\" rel=\"tag\">#<span>"
                        + name
                        + "</span></a>")
            .collect(java.util.stream.Collectors.joining(" "))
        + "</p>";
  }

  private Map<String, Object> wrap(String type, String id, Map<String, Object> note) {
    Map<String, Object> activity = new LinkedHashMap<>();
    activity.put("@context", ActorDocuments.CONTEXT);
    activity.put("id", id);
    activity.put("type", type);
    activity.put("actor", note.get("attributedTo"));
    activity.put("to", note.get("to"));
    activity.put("cc", note.get("cc"));
    activity.put("object", note);
    return activity;
  }

  private String content(UserActivityEntity activity, UserMediaEntity item, MediaEntity media) {
    String title =
        "<a href=\"" + uris.web(mediaPath(media)) + "\">" + escape(media.getTitle()) + "</a>";
    return switch (activity.getActivityType()) {
      case ADDED -> "<p>Added " + title + " to their shelf</p>";
      case RATED ->
          item.getRating() == null
              ? "<p>Cleared their rating of " + title + "</p>"
              : "<p>Rated " + title + " " + item.getRating() + "/10</p>";
      case STATUS_CHANGED -> "<p>" + statusVerb(item.getStatus()) + " " + title + "</p>";
      case REVIEWED -> {
        String rating = item.getRating() == null ? "" : " · " + item.getRating() + "/10";
        String body = item.getNote() == null ? "" : RichTextHtml.render(item.getNote());
        yield "<p>Review of " + title + rating + "</p>" + body;
      }
      default -> "<p>" + title + "</p>";
    };
  }

  private static String statusVerb(UserMediaStatus status) {
    return switch (status) {
      case PLANNED -> "Plans to start";
      case ONGOING -> "Started";
      case DONE -> "Finished";
      case DROPPED -> "Dropped";
    };
  }

  private static Map<String, Object> item(UserMediaEntity item) {
    Map<String, Object> state = new LinkedHashMap<>();
    state.put("status", item.getStatus().getValue());
    state.put("rating", item.getRating());
    state.put("containsSpoilers", item.isContainsSpoilers());
    state.put("note", item.getNote());
    return state;
  }

  private static String webPath(UserActivityEntity activity, MediaEntity media) {
    if (activity.getActivityType() == ActivityType.REVIEWED) {
      return "/reviews/" + activity.getUserMedia().getId();
    }
    return mediaPath(media);
  }

  private static String mediaPath(MediaEntity media) {
    return "/media/" + media.getMediaType().getValue() + "/" + media.getExternalId();
  }

  Optional<Audience> audience(UUID userId, CollectionVisibility objectVisibility) {
    boolean federated =
        objectVisibility == CollectionVisibility.PUBLIC
            && userRepository
                .findById(userId)
                .filter(user -> user.getDomain() == null)
                .map(user -> user.federatedVisibility() == CollectionVisibility.PUBLIC)
                .orElse(false);
    return federated ? Optional.of(publicAudience(userId)) : Optional.empty();
  }

  Audience publicAudience(UUID userId) {
    List<String> inboxes =
        jdbcClient
            .sql(
                """
                    select distinct coalesce(a.shared_inbox, a.inbox) from follows f
                    join ap_actors a on a.user_id = f.follower_id
                    where f.followed_id = :userId and a.actor_uri is not null
                    """)
            .param("userId", userId)
            .query(String.class)
            .list();
    return new Audience(List.of(PUBLIC), List.of(uris.followers(userId)), inboxes);
  }

  private static String escape(String text) {
    return HtmlUtils.htmlEscape(text);
  }
}
