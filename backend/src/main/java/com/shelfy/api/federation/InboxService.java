package com.shelfy.api.federation;

import com.shelfy.api.auth.AvatarStorageService;
import com.shelfy.api.auth.UserEntity;
import com.shelfy.api.auth.UserRepository;
import com.shelfy.api.notifications.NotificationService;
import com.shelfy.api.notifications.NotificationType;
import java.net.URI;
import java.time.Clock;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@Service
public class InboxService {

  private static final Logger LOG = LoggerFactory.getLogger(InboxService.class);

  private final ObjectMapper objectMapper;
  private final RemoteActorService remoteActors;
  private final ActorStore actorStore;
  private final DomainPolicy domainPolicy;
  private final FederationUris uris;
  private final FederatedFollows follows;
  private final InboundActivities inbound;
  private final InboundInteractions interactions;
  private final InboundCollections collections;
  private final InboundCollaborators collaborators;
  private final InboundMoves moves;
  private final ModerationService moderation;
  private final UserRepository userRepository;
  private final AvatarStorageService avatarStorageService;
  private final JdbcClient jdbcClient;
  private final Clock clock;
  private final NotificationService notificationService;

  @Autowired
  public InboxService(
      ObjectMapper objectMapper,
      RemoteActorService remoteActors,
      ActorStore actorStore,
      DomainPolicy domainPolicy,
      FederationUris uris,
      FederatedFollows follows,
      InboundActivities inbound,
      InboundInteractions interactions,
      InboundCollections collections,
      InboundCollaborators collaborators,
      InboundMoves moves,
      ModerationService moderation,
      UserRepository userRepository,
      AvatarStorageService avatarStorageService,
      JdbcClient jdbcClient,
      NotificationService notificationService) {
    this(
        objectMapper,
        remoteActors,
        actorStore,
        domainPolicy,
        uris,
        follows,
        inbound,
        interactions,
        collections,
        collaborators,
        moves,
        moderation,
        userRepository,
        avatarStorageService,
        jdbcClient,
        notificationService,
        Clock.systemUTC());
  }

  InboxService(
      ObjectMapper objectMapper,
      RemoteActorService remoteActors,
      ActorStore actorStore,
      DomainPolicy domainPolicy,
      FederationUris uris,
      FederatedFollows follows,
      InboundActivities inbound,
      InboundInteractions interactions,
      InboundCollections collections,
      InboundCollaborators collaborators,
      InboundMoves moves,
      ModerationService moderation,
      UserRepository userRepository,
      AvatarStorageService avatarStorageService,
      JdbcClient jdbcClient,
      NotificationService notificationService,
      Clock clock) {
    this.objectMapper = objectMapper;
    this.remoteActors = remoteActors;
    this.actorStore = actorStore;
    this.domainPolicy = domainPolicy;
    this.uris = uris;
    this.follows = follows;
    this.inbound = inbound;
    this.interactions = interactions;
    this.collections = collections;
    this.collaborators = collaborators;
    this.moves = moves;
    this.moderation = moderation;
    this.userRepository = userRepository;
    this.avatarStorageService = avatarStorageService;
    this.jdbcClient = jdbcClient;
    this.notificationService = notificationService;
    this.clock = clock;
  }

  public HttpStatus receive(
      String method, String pathAndQuery, Function<String, String> header, byte[] body) {
    JsonNode activity;
    try {
      activity = objectMapper.readTree(body);
    } catch (JacksonException e) {
      return HttpStatus.BAD_REQUEST;
    }
    if (activity == null || !activity.isObject()) {
      return HttpStatus.BAD_REQUEST;
    }
    String id = Activities.text(activity, "id");
    String type = Activities.text(activity, "type");
    String actorUri = Activities.idOf(activity.path("actor"));
    if (id == null || type == null || actorUri == null) {
      return HttpStatus.BAD_REQUEST;
    }
    if (uris.isLocalUri(actorUri) || !isAllowed(actorUri)) {
      return HttpStatus.FORBIDDEN;
    }
    if (type.equals("Delete")
        && actorUri.equals(Activities.idOf(activity.path("object")))
        && actorStore.findRemoteByUri(actorUri).isEmpty()) {
      return HttpStatus.ACCEPTED;
    }
    HttpSignatures.Parsed signature;
    try {
      signature = HttpSignatures.parse(header.apply("signature"));
    } catch (HttpSignatures.SignatureException e) {
      return HttpStatus.UNAUTHORIZED;
    }
    UserEntity signer;
    try {
      signer = verify(signature, method, pathAndQuery, header, body, false);
    } catch (HttpSignatures.SignatureException | RemoteFetcher.RemoteFetchException e) {
      try {
        signer = verify(signature, method, pathAndQuery, header, body, true);
      } catch (HttpSignatures.SignatureException | RemoteFetcher.RemoteFetchException retry) {
        LOG.info("Rejected inbox request signed by {}: {}", signature.keyId(), retry.getMessage());
        return HttpStatus.UNAUTHORIZED;
      }
    }
    String signerUri = actorStore.findRemoteByUserId(signer.getId()).orElseThrow().actorUri();
    if (!signerUri.equals(actorUri)) {
      return HttpStatus.FORBIDDEN;
    }
    if (alreadySeen(id)) {
      return HttpStatus.ACCEPTED;
    }
    dispatch(signer, signerUri, type, activity);
    markSeen(id);
    return HttpStatus.ACCEPTED;
  }

  public HttpStatus authorizeFetch(
      String method, String pathAndQuery, Function<String, String> header) {
    HttpSignatures.Parsed signature;
    try {
      signature = HttpSignatures.parse(header.apply("signature"));
    } catch (HttpSignatures.SignatureException e) {
      return HttpStatus.UNAUTHORIZED;
    }
    UserEntity signer;
    try {
      signer = verify(signature, method, pathAndQuery, header, null, false);
    } catch (HttpSignatures.SignatureException | RemoteFetcher.RemoteFetchException e) {
      try {
        signer = verify(signature, method, pathAndQuery, header, null, true);
      } catch (HttpSignatures.SignatureException | RemoteFetcher.RemoteFetchException retry) {
        LOG.info("Refused fetch signed by {}: {}", signature.keyId(), retry.getMessage());
        return HttpStatus.UNAUTHORIZED;
      }
    }
    String signerUri = actorStore.findRemoteByUserId(signer.getId()).orElseThrow().actorUri();
    return isAllowed(signerUri) ? HttpStatus.OK : HttpStatus.FORBIDDEN;
  }

  private UserEntity verify(
      HttpSignatures.Parsed signature,
      String method,
      String pathAndQuery,
      Function<String, String> header,
      byte[] body,
      boolean refresh) {
    UserEntity signer = remoteActors.resolveByKeyId(signature.keyId(), refresh);
    ActorStore.RemoteActor actor = actorStore.findRemoteByUserId(signer.getId()).orElseThrow();
    HttpSignatures.verify(
        signature,
        method,
        pathAndQuery,
        header,
        body,
        RsaKeys.parsePublic(actor.publicKeyPem()),
        clock.instant());
    return signer;
  }

  private void dispatch(UserEntity signer, String signerUri, String type, JsonNode activity) {
    JsonNode object = activity.path("object");
    switch (type) {
      case "Follow" -> follows.onFollow(signer, signerUri, activity);
      case "Invite" -> collaborators.onInvite(signer, signerUri, activity);
      case "Move" -> moves.onMove(signer, signerUri, activity);
      case "Accept" -> {
        if (InboundCollaborators.isInvite(object)) {
          collaborators.onAnswer(signer, object, true);
        } else {
          follows.onAccept(signer, activity);
        }
      }
      case "Reject" -> {
        if (InboundCollaborators.isInvite(object)) {
          collaborators.onAnswer(signer, object, false);
        } else {
          follows.onReject(signer, activity);
        }
      }
      case "Undo" -> {
        String undone = Activities.text(object, "type");
        if ("Follow".equals(undone)) {
          follows.onUndoFollow(signer, object);
        } else if ("Invite".equals(undone)) {
          collaborators.onUndoInvite(signer, object);
        } else if ("Like".equals(undone)
            && signerUri.equals(Activities.idOf(object.path("actor")))) {
          interactions.onLike(signer, object, false);
        }
      }
      case "Like" -> interactions.onLike(signer, activity, true);
      case "Flag" -> moderation.onFlag(signer, activity);
      case "Create", "Update" -> {
        if (type.equals("Update")
            && signerUri.equals(Activities.idOf(object))
            && object.isObject()) {
          remoteActors.refreshFrom(signer, signerUri, object);
        } else if (object.has("shelfy:activity")) {
          inbound.onCreateOrUpdate(signer, signerUri, object);
        } else if (InboundCollections.isCollection(object)) {
          if (!collaborators.onEdit(signer, object)) {
            collections.onCreateOrUpdate(signer, signerUri, object);
          }
        } else {
          interactions.onReply(signer, signerUri, object);
        }
      }
      case "Delete" -> {
        String objectId = Activities.idOf(object);
        if (signerUri.equals(objectId)) {
          deleteRemoteUser(signer);
        } else if (objectId != null
            && !interactions.onDelete(signer, objectId)
            && !collections.onDelete(signer, objectId)) {
          inbound.onDelete(signer, objectId);
        }
      }
      default -> LOG.debug("Ignoring {} activity from {}", type, signerUri);
    }
  }

  private void deleteRemoteUser(UserEntity signer) {
    String avatar = signer.getAvatarFilename();
    Map<String, Object> who = new HashMap<>();
    who.put("username", signer.getUsername());
    who.put("domain", signer.getDomain());
    who.put("displayName", signer.getDisplayName());
    jdbcClient
        .sql(
            """
            select u.id from users u where u.domain is null and (
                exists (select 1 from follows f where f.follower_id = u.id and f.followed_id = :remote))
            """)
        .param("remote", signer.getId())
        .query(UUID.class)
        .list()
        .forEach(
            local ->
                notificationService.create(
                    local, null, NotificationType.REMOTE_ACCOUNT_DELETED, null, null, who));
    userRepository.deleteById(signer.getId());
    avatarStorageService.delete(avatar);
  }

  private boolean isAllowed(String actorUri) {
    try {
      return domainPolicy.isAllowed(URI.create(actorUri).getHost());
    } catch (IllegalArgumentException e) {
      return false;
    }
  }

  private boolean alreadySeen(String id) {
    return jdbcClient
        .sql("select exists (select 1 from ap_inbox_seen where activity_id = :id)")
        .param("id", id)
        .query(Boolean.class)
        .single();
  }

  private void markSeen(String id) {
    jdbcClient
        .sql("insert into ap_inbox_seen (activity_id) values (:id) on conflict do nothing")
        .param("id", id)
        .update();
  }
}
