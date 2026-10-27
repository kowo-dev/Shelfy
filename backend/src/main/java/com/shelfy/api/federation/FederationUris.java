package com.shelfy.api.federation;

import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashSet;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.springframework.stereotype.Component;

@Component
public class FederationUris {

  private final String serverUrl;
  private final String serverAuthority;
  private final String handleDomain;
  private final String scheme;

  public FederationUris(FederationProperties properties) {
    String url = properties.serverUrl() == null ? "" : properties.serverUrl();
    this.serverUrl = url.endsWith("/") ? url.substring(0, url.length() - 1) : url;
    String authority = serverUrl.isEmpty() ? null : URI.create(serverUrl).getRawAuthority();
    this.serverAuthority = authority == null ? "" : authority.toLowerCase(Locale.ROOT);
    this.handleDomain =
        properties.handleDomain() == null ? "" : properties.handleDomain().toLowerCase(Locale.ROOT);
    this.scheme = properties.devMode() ? "http" : "https";
  }

  public String handleDomain() {
    return handleDomain;
  }

  public String actor(UUID userId) {
    return serverUrl + "/ap/users/" + userId;
  }

  public String keyId(UUID userId) {
    return actor(userId) + "#main-key";
  }

  public String inbox(UUID userId) {
    return actor(userId) + "/inbox";
  }

  public String outbox(UUID userId) {
    return actor(userId) + "/outbox";
  }

  public String followers(UUID userId) {
    return actor(userId) + "/followers";
  }

  public String following(UUID userId) {
    return actor(userId) + "/following";
  }

  public String sharedInbox() {
    return serverUrl + "/ap/inbox";
  }

  public String instanceActor() {
    return serverUrl + "/ap/actor";
  }

  public String instanceKeyId() {
    return instanceActor() + "#main-key";
  }

  public String nodeInfo() {
    return serverUrl + "/nodeinfo/2.1";
  }

  public String webFingerTemplate() {
    return serverUrl + "/.well-known/webfinger?resource={uri}";
  }

  public String profile(String username) {
    return web("/profile/" + username);
  }

  public String web(String path) {
    return scheme + "://" + handleDomain + path;
  }

  public String activity(UUID activityId) {
    return serverUrl + "/ap/activities/" + activityId;
  }

  public URI webFinger(String domain, String resource) {
    return URI.create(
        scheme
            + "://"
            + domain
            + "/.well-known/webfinger?resource="
            + URLEncoder.encode(resource, StandardCharsets.UTF_8));
  }

  public Set<String> localUsernames(Set<String> handles) {
    Set<String> usernames = new LinkedHashSet<>();
    for (String handle : handles) {
      int at = handle.lastIndexOf('@');
      if (at > 0 && isLocalDomain(handle.substring(at + 1))) {
        usernames.add(handle.substring(0, at));
      }
    }
    return usernames;
  }

  public boolean isLocalDomain(String domain) {
    return domain != null
        && (domain.equalsIgnoreCase(handleDomain) || domain.equalsIgnoreCase(serverAuthority));
  }

  public boolean isLocalUri(String uri) {
    return uri != null && uri.startsWith(serverUrl + "/");
  }

  public String list(UUID listId) {
    return serverUrl + "/ap/lists/" + listId;
  }

  public String pool(UUID poolId) {
    return serverUrl + "/ap/versus/" + poolId;
  }

  public Optional<UUID> localListId(String uri) {
    return localId(uri, "/ap/lists/");
  }

  public Optional<UUID> localPoolId(String uri) {
    return localId(uri, "/ap/versus/");
  }

  public String comment(UUID commentId) {
    return serverUrl + "/ap/comments/" + commentId;
  }

  public Optional<UUID> localActivityId(String uri) {
    return localId(uri, "/ap/activities/");
  }

  public Optional<UUID> localCommentId(String uri) {
    return localId(uri, "/ap/comments/");
  }

  public Optional<UUID> localUserId(String uri) {
    return localId(uri, "/ap/users/");
  }

  private Optional<UUID> localId(String uri, String path) {
    String prefix = serverUrl + path;
    if (uri == null || !uri.startsWith(prefix)) {
      return Optional.empty();
    }
    try {
      return Optional.of(UUID.fromString(uri.substring(prefix.length())));
    } catch (IllegalArgumentException e) {
      return Optional.empty();
    }
  }
}
