package com.shelfy.api.federation;

import com.shelfy.api.auth.UserEntity;
import com.shelfy.api.collection.MediaEntity;
import com.shelfy.api.comments.CommentTargetType;
import com.shelfy.api.common.exception.ApiException;
import com.shelfy.api.lists.MediaListCollaboratorService;
import com.shelfy.api.lists.MediaListRepository;
import com.shelfy.api.notifications.NotificationService;
import com.shelfy.api.notifications.NotificationType;
import com.shelfy.api.versus.VersusPoolCollaboratorService;
import com.shelfy.api.versus.VersusPoolRepository;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.JsonNode;

@Component
@RequiredArgsConstructor
public class InboundCollaborators {

  private static final Logger LOG = LoggerFactory.getLogger(InboundCollaborators.class);

  private final ObjectLookup lookup;
  private final FederationUris uris;
  private final InboundCollections collections;
  private final CollectionPublisher collectionPublisher;
  private final MediaListCollaboratorService listCollaborators;
  private final VersusPoolCollaboratorService poolCollaborators;
  private final MediaListRepository listRepository;
  private final VersusPoolRepository poolRepository;
  private final JdbcClient jdbcClient;
  private final TransactionTemplate transactionTemplate;
  private final NotificationService notificationService;

  public static boolean isInvite(JsonNode object) {
    return "Invite".equals(Activities.text(object, "type"));
  }

  public void onInvite(UserEntity signer, String signerUri, JsonNode invite) {
    Optional<UUID> invitee =
        uris.localUserId(Activities.idOf(invite.path("object"))).filter(this::isLocalUser);
    JsonNode target = invite.path("target");
    if (invitee.isEmpty()) {
      return;
    }
    if (target.isObject() && InboundCollections.isCollection(target)) {
      collections.onSnapshot(signer, signerUri, target);
    }
    lookup
        .targetOf(Activities.idOf(target))
        .filter(found -> found.ownerId().equals(signer.getId()))
        .ifPresent(
            found ->
                refusable(
                    () -> {
                      if (found.type() == CommentTargetType.LIST) {
                        listCollaborators.invite(signer.getId(), found.id(), invitee.get());
                      } else {
                        poolCollaborators.invite(signer.getId(), found.id(), invitee.get());
                      }
                    }));
  }

  public void onAnswer(UserEntity signer, JsonNode invite, boolean accepted) {
    ownedTarget(invite)
        .ifPresent(
            target ->
                refusable(
                    () -> {
                      boolean pending = status(target, signer.getId()).equals("PENDING");
                      if (target.type() == CommentTargetType.LIST) {
                        if (accepted) {
                          listCollaborators.accept(signer.getId(), target.id());
                        } else if (pending) {
                          listCollaborators.decline(signer.getId(), target.id());
                        } else {
                          listCollaborators.remove(signer.getId(), target.id(), signer.getId());
                        }
                      } else if (accepted) {
                        poolCollaborators.accept(signer.getId(), target.id());
                      } else if (pending) {
                        poolCollaborators.decline(signer.getId(), target.id());
                      } else {
                        poolCollaborators.remove(signer.getId(), target.id(), signer.getId());
                      }
                    }));
  }

  public void onUndoInvite(UserEntity signer, JsonNode invite) {
    Optional<UUID> collaborator = uris.localUserId(Activities.idOf(invite.path("object")));
    lookup
        .targetOf(Activities.idOf(invite.path("target")))
        .filter(found -> found.ownerId().equals(signer.getId()))
        .ifPresent(
            target ->
                collaborator.ifPresent(
                    local ->
                        refusable(
                            () -> {
                              if (target.type() == CommentTargetType.LIST) {
                                listCollaborators.remove(signer.getId(), target.id(), local);
                              } else {
                                poolCollaborators.remove(signer.getId(), target.id(), local);
                              }
                            })));
  }

  public boolean onEdit(UserEntity signer, JsonNode object) {
    Optional<ObjectLookup.Target> target =
        lookup
            .targetOf(Activities.idOf(object))
            .filter(found -> found.type() != CommentTargetType.REVIEW)
            .filter(found -> isLocalUser(found.ownerId()));
    if (target.isEmpty()) {
      return false;
    }
    if (!status(target.get(), signer.getId()).equals("ACCEPTED")) {
      return true;
    }
    UUID ownerId = target.get().ownerId();
    notificationService.create(
        ownerId,
        signer.getId(),
        NotificationType.COLLABORATION_EDITED,
        target.get().type().name(),
        target.get().id(),
        Map.of());
    if (target.get().type() == CommentTargetType.LIST) {
      List<MediaEntity> media = collections.resolveListItems(object.path("shelfy:list"));
      transactionTemplate.executeWithoutResult(
          status ->
              listRepository
                  .findById(target.get().id())
                  .ifPresent(
                      list -> {
                        collections.applyListItems(list, media, signer.getId());
                        collectionPublisher.listChanged(listRepository.save(list), ownerId);
                      }));
    } else {
      InboundCollections.PoolItems items =
          collections.resolvePoolItems(object.path("shelfy:versusPool"));
      transactionTemplate.executeWithoutResult(
          status ->
              poolRepository
                  .findById(target.get().id())
                  .ifPresent(
                      pool -> {
                        collections.applyPoolItems(pool, items, signer.getId());
                        collectionPublisher.poolChanged(poolRepository.save(pool), ownerId);
                      }));
    }
    return true;
  }

  private Optional<ObjectLookup.Target> ownedTarget(JsonNode invite) {
    return lookup
        .targetOf(Activities.idOf(invite.path("target")))
        .filter(found -> found.type() != CommentTargetType.REVIEW)
        .filter(found -> isLocalUser(found.ownerId()));
  }

  private String status(ObjectLookup.Target target, UUID userId) {
    String sql =
        target.type() == CommentTargetType.LIST
            ? "select status from media_list_collaborators where list_id = :id and user_id = :user"
            : "select status from versus_pool_collaborators where pool_id = :id and user_id = :user";
    return jdbcClient
        .sql(sql)
        .param("id", target.id())
        .param("user", userId)
        .query(String.class)
        .optional()
        .orElse("");
  }

  private boolean isLocalUser(UUID userId) {
    return jdbcClient
        .sql("select exists (select 1 from users where id = :id and domain is null)")
        .param("id", userId)
        .query(Boolean.class)
        .single();
  }

  private static void refusable(Runnable action) {
    try {
      action.run();
    } catch (ApiException e) {
      LOG.info("Remote collaboration refused: {}", e.getMessage());
    }
  }
}
