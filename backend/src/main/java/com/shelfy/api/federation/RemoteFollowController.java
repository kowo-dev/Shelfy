package com.shelfy.api.federation;

import com.shelfy.api.auth.CollectionVisibility;
import com.shelfy.api.auth.UserEntity;
import com.shelfy.api.auth.UserRepository;
import com.shelfy.api.common.exception.ApiException;
import com.shelfy.api.common.exception.ErrorCode;
import com.shelfy.api.common.exception.ResourceNotFoundException;
import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBooleanProperty;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import tools.jackson.databind.JsonNode;

@RestController
@ConditionalOnBooleanProperty("app.federation.enabled")
@RequiredArgsConstructor
public class RemoteFollowController {

  private static final String SUBSCRIBE_REL = "http://ostatus.org/schema/1.0/subscribe";
  private static final String PLACEHOLDER = "{uri}";

  public record RemoteFollowResponse(String url) {}

  private final UserRepository userRepository;
  private final RemoteFetcher fetcher;
  private final FederationUris uris;
  private final FederationProperties properties;

  @GetMapping("/api/v1/federation/remote-follow")
  public RemoteFollowResponse resolveRemoteFollow(
      @RequestParam String handle, @RequestParam String username) {
    RemoteActorService.Handle visitor =
        RemoteActorService.Handle.parse(handle)
            .filter(parsed -> !uris.isLocalDomain(parsed.domain()))
            .orElseThrow(
                () ->
                    unavailable(
                        ErrorCode.REMOTE_FOLLOW_INVALID_ADDRESS,
                        "Enter your address on another server, like @you@example.social"));
    UserEntity target =
        userRepository
            .findByUsernameIgnoreCaseAndDomainIsNull(username)
            .filter(user -> user.federatedVisibility() != CollectionVisibility.PRIVATE)
            .orElseThrow(
                () -> new ResourceNotFoundException(ErrorCode.USER_NOT_FOUND, "User not found"));
    JsonNode descriptor;
    try {
      descriptor = fetcher.fetchJrd(uris.webFinger(visitor.domain(), visitor.acct()));
    } catch (RemoteFetcher.RemoteFetchException e) {
      throw e.status() == 404 || e.status() == 410
          ? unavailable(
              ErrorCode.REMOTE_FOLLOW_ACCOUNT_NOT_FOUND,
              "No account " + visitor.display() + " on " + visitor.domain())
          : unavailable(
              ErrorCode.REMOTE_FOLLOW_SERVER_UNREACHABLE, "Could not reach " + visitor.domain());
    }
    String template = subscribeTemplate(descriptor, visitor.domain());
    return new RemoteFollowResponse(
        template.replace(
            PLACEHOLDER, URLEncoder.encode(uris.actor(target.getId()), StandardCharsets.UTF_8)));
  }

  private String subscribeTemplate(JsonNode descriptor, String domain) {
    for (JsonNode link : descriptor.path("links")) {
      String template = link.path("template").asString("");
      if (SUBSCRIBE_REL.equals(link.path("rel").asString("")) && sameServer(template, domain)) {
        return template;
      }
    }
    throw unavailable(
        ErrorCode.REMOTE_FOLLOW_UNSUPPORTED,
        "Your server does not support following from another site");
  }

  private boolean sameServer(String template, String domain) {
    if (!template.contains(PLACEHOLDER)) {
      return false;
    }
    try {
      URI uri = URI.create(template.replace(PLACEHOLDER, "x"));
      String scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase(Locale.ROOT);
      boolean schemeAllowed =
          scheme.equals("https") || (properties.devMode() && scheme.equals("http"));
      return schemeAllowed
          && uri.getRawUserInfo() == null
          && uri.getRawAuthority() != null
          && uri.getRawAuthority().equalsIgnoreCase(domain);
    } catch (IllegalArgumentException e) {
      return false;
    }
  }

  private static ApiException unavailable(ErrorCode code, String message) {
    return new ApiException(HttpStatus.BAD_REQUEST, code, message);
  }
}
