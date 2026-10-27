package com.shelfy.api.federation;

import com.shelfy.api.auth.AvatarStorageService;
import com.shelfy.api.auth.UserEntity;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.util.HtmlUtils;

@Component
@RequiredArgsConstructor
public class ActorDocuments {

  public static final MediaType ACTIVITY_JSON =
      MediaType.parseMediaType("application/activity+json");
  public static final String ACTIVITY_STREAMS = "https://www.w3.org/ns/activitystreams";
  public static final List<Object> CONTEXT =
      List.of(
          ACTIVITY_STREAMS,
          "https://w3id.org/security/v1",
          Map.of(
              "manuallyApprovesFollowers", "as:manuallyApprovesFollowers",
              "toot", "http://joinmastodon.org/ns#",
              "discoverable", "toot:discoverable",
              "alsoKnownAs", Map.of("@id", "as:alsoKnownAs", "@type", "@id"),
              "movedTo", Map.of("@id", "as:movedTo", "@type", "@id"),
              "shelfy", "https://shelfy.dev/ns#"));

  private final FederationUris uris;
  private final ActorStore actorStore;
  private final AvatarStorageService avatarStorageService;

  public Map<String, Object> person(UserEntity user) {
    String id = uris.actor(user.getId());
    Map<String, Object> doc = new LinkedHashMap<>();
    doc.put("@context", CONTEXT);
    doc.put("id", id);
    doc.put("type", "Person");
    doc.put("preferredUsername", user.getUsername());
    doc.put("name", user.getDisplayName() == null ? user.getUsername() : user.getDisplayName());
    if (user.getBio() != null && !user.getBio().isBlank()) {
      doc.put("summary", html(user.getBio()));
    }
    doc.put("url", uris.profile(user.getUsername()));
    doc.put("inbox", uris.inbox(user.getId()));
    doc.put("outbox", uris.outbox(user.getId()));
    doc.put("followers", uris.followers(user.getId()));
    doc.put("following", uris.following(user.getId()));
    doc.put("endpoints", Map.of("sharedInbox", uris.sharedInbox()));
    doc.put("manuallyApprovesFollowers", false);
    doc.put("discoverable", true);
    if (user.getAlsoKnownAs() != null) {
      doc.put("alsoKnownAs", List.of(user.getAlsoKnownAs()));
    }
    if (user.getMovedTo() != null) {
      doc.put("movedTo", user.getMovedTo());
    }
    doc.put("shelfy:profileVisibility", user.getProfileVisibility().getValue());
    doc.put("published", user.getCreatedAt().toString());
    String avatar = avatarStorageService.urlFor(user.getAvatarFilename());
    if (avatar != null) {
      doc.put("icon", Map.of("type", "Image", "url", avatar));
    }
    if (user.getProfileBannerUrl() != null && !user.isAdultContentAllowed()) {
      doc.put("image", Map.of("type", "Image", "url", user.getProfileBannerUrl()));
    }
    doc.put("publicKey", publicKey(id, actorStore.localKey(user.getId())));
    return doc;
  }

  public Map<String, Object> instance() {
    String id = uris.instanceActor();
    Map<String, Object> doc = new LinkedHashMap<>();
    doc.put("@context", CONTEXT);
    doc.put("id", id);
    doc.put("type", "Application");
    doc.put("preferredUsername", uris.handleDomain());
    doc.put("name", "Shelfy");
    doc.put("inbox", uris.sharedInbox());
    doc.put("outbox", id + "/outbox");
    doc.put("endpoints", Map.of("sharedInbox", uris.sharedInbox()));
    doc.put("manuallyApprovesFollowers", true);
    doc.put("discoverable", false);
    doc.put("publicKey", publicKey(id, actorStore.instanceKey()));
    return doc;
  }

  private static Map<String, Object> publicKey(String owner, ActorStore.KeyPem key) {
    return Map.of("id", key.keyId(), "owner", owner, "publicKeyPem", key.publicPem());
  }

  private static String html(String text) {
    return "<p>" + HtmlUtils.htmlEscape(text).replace("\n", "<br>") + "</p>";
  }
}
