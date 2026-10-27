package com.shelfy.api.federation;

import com.shelfy.api.auth.UserEntity;
import com.shelfy.api.auth.UserRepository;
import com.shelfy.api.common.exception.ApiException;
import com.shelfy.api.common.exception.ConflictException;
import com.shelfy.api.common.exception.ErrorCode;
import com.shelfy.api.common.exception.ResourceNotFoundException;
import java.net.URI;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;

@Service
@RequiredArgsConstructor
public class AccountMigration {

  public record Status(String actor, String alias, String movedTo) {}

  private final UserRepository userRepository;
  private final RemoteActorService remoteActors;
  private final ActorStore actorStore;
  private final RemoteFetcher fetcher;
  private final ProfilePublisher profilePublisher;
  private final FederationUris uris;
  private final FederationProperties properties;

  public Status status(UUID userId) {
    UserEntity user = local(userId);
    return new Status(uris.actor(userId), user.getAlsoKnownAs(), user.getMovedTo());
  }

  @Transactional
  public Status setAlias(UUID userId, String handle) {
    UserEntity user = local(userId);
    user.setAlsoKnownAs(actorUri(resolve(handle)));
    userRepository.save(user);
    profilePublisher.updated(userId);
    return status(userId);
  }

  @Transactional
  public Status clearAlias(UUID userId) {
    UserEntity user = local(userId);
    user.setAlsoKnownAs(null);
    userRepository.save(user);
    profilePublisher.updated(userId);
    return status(userId);
  }

  @Transactional
  public Status moveTo(UUID userId, String handle) {
    UserEntity user = local(userId);
    if (user.getMovedTo() != null) {
      throw new ConflictException(
          ErrorCode.FEDERATION_UNAVAILABLE, "This account has already moved");
    }
    String targetUri = actorUri(resolve(handle));
    JsonNode target;
    try {
      target = fetcher.fetchActivity(URI.create(targetUri));
    } catch (RemoteFetcher.RemoteFetchException e) {
      throw unavailable("Could not reach the new account");
    }
    if (!aliases(target).contains(uris.actor(userId))) {
      throw unavailable(
          "Add " + uris.actor(userId) + " as an alias of the new account first, then try again");
    }
    user.setMovedTo(targetUri);
    userRepository.save(user);
    profilePublisher.moved(userId, targetUri);
    return status(userId);
  }

  static java.util.List<String> aliases(JsonNode actor) {
    JsonNode value = actor.path("alsoKnownAs");
    java.util.List<String> aliases = new java.util.ArrayList<>();
    if (value.isString()) {
      aliases.add(value.asString());
    } else if (value.isArray()) {
      value.forEach(
          item -> {
            if (item.isString()) {
              aliases.add(item.asString());
            }
          });
    }
    return aliases;
  }

  private UserEntity resolve(String handle) {
    UserEntity remote;
    try {
      remote = remoteActors.resolveHandle(handle);
    } catch (RemoteFetcher.RemoteFetchException e) {
      throw unavailable("Could not find " + handle);
    }
    if (remote.getDomain() == null) {
      throw unavailable("Enter an account on another server");
    }
    return remote;
  }

  private String actorUri(UserEntity remote) {
    return actorStore.findRemoteByUserId(remote.getId()).orElseThrow().actorUri();
  }

  private UserEntity local(UUID userId) {
    return userRepository
        .findById(userId)
        .filter(user -> user.getDomain() == null)
        .orElseThrow(
            () -> new ResourceNotFoundException(ErrorCode.USER_NOT_FOUND, "User not found"));
  }

  private ApiException unavailable(String message) {
    return new ApiException(HttpStatus.BAD_REQUEST, ErrorCode.FEDERATION_UNAVAILABLE, message);
  }
}
