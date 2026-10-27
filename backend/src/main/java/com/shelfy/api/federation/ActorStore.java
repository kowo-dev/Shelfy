package com.shelfy.api.federation;

import java.security.KeyPair;
import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

@Component
public class ActorStore {

  private final JdbcClient jdbcClient;
  private final FederationUris uris;
  private final TransactionTemplate newTransaction;

  public ActorStore(
      JdbcClient jdbcClient, FederationUris uris, PlatformTransactionManager transactionManager) {
    this.jdbcClient = jdbcClient;
    this.uris = uris;
    this.newTransaction = new TransactionTemplate(transactionManager);
    this.newTransaction.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
  }

  public record KeyPem(String keyId, String publicPem, String privatePem) {}

  public record RemoteActor(
      UUID userId,
      String actorUri,
      String inbox,
      String sharedInbox,
      String outbox,
      String followersUri,
      String followingUri,
      String profileUrl,
      String avatarUrl,
      String publicKeyId,
      String publicKeyPem,
      OffsetDateTime fetchedAt) {}

  public KeyPem localKey(UUID userId) {
    return findLocalKey(userId)
        .orElseGet(
            () -> {
              KeyPair pair = RsaKeys.generate();
              newTransaction.executeWithoutResult(
                  status ->
                      jdbcClient
                          .sql(
                              """
                      insert into ap_actors (user_id, public_key_id, public_key_pem, private_key_pem)
                      values (:userId, :keyId, :publicPem, :privatePem)
                      on conflict (user_id) do nothing
                      """)
                          .param("userId", userId)
                          .param("keyId", uris.keyId(userId))
                          .param("publicPem", RsaKeys.publicPem(pair.getPublic()))
                          .param("privatePem", RsaKeys.privatePem(pair.getPrivate()))
                          .update());
              return findLocalKey(userId).orElseThrow();
            });
  }

  public KeyPem instanceKey() {
    return findInstanceKey()
        .orElseGet(
            () -> {
              KeyPair pair = RsaKeys.generate();
              newTransaction.executeWithoutResult(
                  status ->
                      jdbcClient
                          .sql(
                              """
                      insert into ap_instance_keys (id, public_key_pem, private_key_pem)
                      values (1, :publicPem, :privatePem)
                      on conflict (id) do nothing
                      """)
                          .param("publicPem", RsaKeys.publicPem(pair.getPublic()))
                          .param("privatePem", RsaKeys.privatePem(pair.getPrivate()))
                          .update());
              return findInstanceKey().orElseThrow();
            });
  }

  public Optional<RemoteActor> findRemoteByUri(String actorUri) {
    return jdbcClient
        .sql(
            """
            select user_id, actor_uri, inbox, shared_inbox, outbox, followers_uri, following_uri,
                   profile_url, avatar_url, public_key_id, public_key_pem, fetched_at
            from ap_actors where actor_uri = :actorUri
            """)
        .param("actorUri", actorUri)
        .query(RemoteActor.class)
        .optional();
  }

  public Optional<RemoteActor> findRemoteByKeyId(String keyId) {
    return jdbcClient
        .sql(
            """
            select user_id, actor_uri, inbox, shared_inbox, outbox, followers_uri, following_uri,
                   profile_url, avatar_url, public_key_id, public_key_pem, fetched_at
            from ap_actors where public_key_id = :keyId and actor_uri is not null
            """)
        .param("keyId", keyId)
        .query(RemoteActor.class)
        .optional();
  }

  public Optional<RemoteActor> findRemoteByUserId(UUID userId) {
    return jdbcClient
        .sql(
            """
            select user_id, actor_uri, inbox, shared_inbox, outbox, followers_uri, following_uri,
                   profile_url, avatar_url, public_key_id, public_key_pem, fetched_at
            from ap_actors where user_id = :userId and actor_uri is not null
            """)
        .param("userId", userId)
        .query(RemoteActor.class)
        .optional();
  }

  public void saveRemote(RemoteActor actor) {
    jdbcClient
        .sql(
            """
            insert into ap_actors (user_id, actor_uri, inbox, shared_inbox, outbox, followers_uri,
                                   following_uri, profile_url, avatar_url, public_key_id,
                                   public_key_pem, fetched_at)
            values (:userId, :actorUri, :inbox, :sharedInbox, :outbox, :followersUri,
                    :followingUri, :profileUrl, :avatarUrl, :publicKeyId, :publicKeyPem, :fetchedAt)
            on conflict (user_id) do update set
              actor_uri = excluded.actor_uri,
              inbox = excluded.inbox,
              shared_inbox = excluded.shared_inbox,
              outbox = excluded.outbox,
              followers_uri = excluded.followers_uri,
              following_uri = excluded.following_uri,
              profile_url = excluded.profile_url,
              avatar_url = excluded.avatar_url,
              public_key_id = excluded.public_key_id,
              public_key_pem = excluded.public_key_pem,
              fetched_at = excluded.fetched_at
            """)
        .paramSource(actor)
        .update();
  }

  private Optional<KeyPem> findLocalKey(UUID userId) {
    return jdbcClient
        .sql(
            """
            select public_key_id, public_key_pem, private_key_pem
            from ap_actors where user_id = :userId and actor_uri is null
            """)
        .param("userId", userId)
        .query(
            (rs, row) ->
                new KeyPem(
                    rs.getString("public_key_id"),
                    rs.getString("public_key_pem"),
                    rs.getString("private_key_pem")))
        .optional();
  }

  private Optional<KeyPem> findInstanceKey() {
    return jdbcClient
        .sql("select public_key_pem, private_key_pem from ap_instance_keys where id = 1")
        .query(
            (rs, row) ->
                new KeyPem(
                    uris.instanceKeyId(),
                    rs.getString("public_key_pem"),
                    rs.getString("private_key_pem")))
        .optional();
  }
}
