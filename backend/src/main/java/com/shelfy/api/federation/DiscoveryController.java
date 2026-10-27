package com.shelfy.api.federation;

import com.shelfy.api.ShelfyApiApplication;
import com.shelfy.api.auth.CollectionVisibility;
import com.shelfy.api.auth.RegistrationProperties;
import com.shelfy.api.auth.UserEntity;
import com.shelfy.api.auth.UserRepository;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBooleanProperty;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.util.HtmlUtils;

@RestController
@ConditionalOnBooleanProperty("app.federation.enabled")
@RequiredArgsConstructor
public class DiscoveryController {

  private static final MediaType JRD_JSON = MediaType.parseMediaType("application/jrd+json");
  private static final MediaType XRD_XML = MediaType.parseMediaType("application/xrd+xml");
  private static final String NODEINFO_SCHEMA = "http://nodeinfo.diaspora.software/ns/schema/2.1";

  private final UserRepository userRepository;
  private final FederationUris uris;
  private final RegistrationProperties registrationProperties;

  @GetMapping("/.well-known/webfinger")
  public ResponseEntity<Map<String, Object>> getWebFinger(@RequestParam String resource) {
    if (isInstanceActor(resource)) {
      return ResponseEntity.ok().contentType(JRD_JSON).body(instanceDescriptor());
    }
    return findLocalUser(resource)
        .<ResponseEntity<Map<String, Object>>>map(
            user -> {
              String actor = uris.actor(user.getId());
              String profile = uris.profile(user.getUsername());
              Map<String, Object> body =
                  Map.of(
                      "subject",
                      "acct:" + user.getUsername() + "@" + uris.handleDomain(),
                      "aliases",
                      List.of(actor, profile),
                      "links",
                      List.of(
                          Map.of(
                              "rel",
                              "self",
                              "type",
                              ActorDocuments.ACTIVITY_JSON.toString(),
                              "href",
                              actor),
                          Map.of(
                              "rel",
                              "http://webfinger.net/rel/profile-page",
                              "type",
                              "text/html",
                              "href",
                              profile)));
              return ResponseEntity.ok().contentType(JRD_JSON).body(body);
            })
        .orElseGet(() -> ResponseEntity.notFound().build());
  }

  @GetMapping("/.well-known/host-meta")
  public ResponseEntity<String> getHostMeta() {
    String body =
        "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n"
            + "<XRD xmlns=\"http://docs.oasis-open.org/ns/xri/xrd-1.0\">\n"
            + "  <Link rel=\"lrdd\" template=\""
            + HtmlUtils.htmlEscape(uris.webFingerTemplate())
            + "\"/>\n"
            + "</XRD>\n";
    return ResponseEntity.ok().contentType(XRD_XML).body(body);
  }

  @GetMapping("/.well-known/nodeinfo")
  public Map<String, Object> getNodeInfoLinks() {
    return Map.of("links", List.of(Map.of("rel", NODEINFO_SCHEMA, "href", uris.nodeInfo())));
  }

  @GetMapping("/nodeinfo/2.1")
  public ResponseEntity<Map<String, Object>> getNodeInfo() {
    String version = ShelfyApiApplication.class.getPackage().getImplementationVersion();
    Map<String, Object> body =
        Map.of(
            "version",
            "2.1",
            "software",
            Map.of(
                "name",
                "shelfy",
                "version",
                version == null ? "dev" : version,
                "repository",
                "https://github.com/kowo-dev/shelfy",
                "homepage",
                "https://shelfy.dev"),
            "protocols",
            List.of("activitypub"),
            "services",
            Map.of("inbound", List.of(), "outbound", List.of()),
            "openRegistrations",
            registrationProperties.open(),
            "usage",
            Map.of("users", Map.of("total", userRepository.countByDomainIsNull())),
            "metadata",
            Map.of());
    return ResponseEntity.ok()
        .contentType(
            MediaType.parseMediaType("application/json; profile=\"" + NODEINFO_SCHEMA + "#\""))
        .body(body);
  }

  private boolean isInstanceActor(String resource) {
    if (resource == null) {
      return false;
    }
    if (resource.trim().equals(uris.instanceActor())) {
      return true;
    }
    return RemoteActorService.Handle.parse(resource)
        .filter(handle -> handle.username().equalsIgnoreCase(uris.handleDomain()))
        .filter(handle -> uris.isLocalDomain(handle.domain()))
        .isPresent();
  }

  private Map<String, Object> instanceDescriptor() {
    return Map.of(
        "subject",
        "acct:" + uris.handleDomain() + "@" + uris.handleDomain(),
        "aliases",
        List.of(uris.instanceActor()),
        "links",
        List.of(
            Map.of(
                "rel",
                "self",
                "type",
                ActorDocuments.ACTIVITY_JSON.toString(),
                "href",
                uris.instanceActor())));
  }

  private Optional<UserEntity> findLocalUser(String resource) {
    if (resource == null) {
      return Optional.empty();
    }
    Optional<UserEntity> user = Optional.empty();
    String value = resource.trim();
    if (value.toLowerCase(Locale.ROOT).startsWith("acct:")) {
      String handle = value.substring(5);
      if (handle.startsWith("@")) {
        handle = handle.substring(1);
      }
      int at = handle.lastIndexOf('@');
      if (at > 0 && uris.isLocalDomain(handle.substring(at + 1))) {
        user = userRepository.findByUsernameIgnoreCaseAndDomainIsNull(handle.substring(0, at));
      }
    } else {
      user =
          uris.localUserId(value)
              .flatMap(userRepository::findById)
              .filter(found -> found.getDomain() == null);
    }
    return user.filter(found -> found.federatedVisibility() != CollectionVisibility.PRIVATE);
  }
}
