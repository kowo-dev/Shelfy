package com.shelfy.api.common.cache;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Optional;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

@Repository
public class ProviderCacheStore {

  public record StoredEntry(String payload, Instant fetchedAt) {}

  private final JdbcClient jdbcClient;

  public ProviderCacheStore(JdbcClient jdbcClient) {
    this.jdbcClient = jdbcClient;
  }

  public Optional<StoredEntry> find(String namespace, String key) {
    return jdbcClient
        .sql(
            "select payload::text as payload, fetched_at from provider_cache"
                + " where namespace = :namespace and cache_key = :key")
        .param("namespace", namespace)
        .param("key", key)
        .query(
            (rs, rowNum) ->
                new StoredEntry(
                    rs.getString("payload"),
                    rs.getObject("fetched_at", OffsetDateTime.class).toInstant()))
        .optional();
  }

  public void save(String namespace, String key, String payload, Instant fetchedAt) {
    jdbcClient
        .sql(
            "insert into provider_cache (namespace, cache_key, payload, fetched_at)"
                + " values (:namespace, :key, cast(:payload as jsonb), :fetchedAt)"
                + " on conflict (namespace, cache_key)"
                + " do update set payload = excluded.payload, fetched_at = excluded.fetched_at")
        .param("namespace", namespace)
        .param("key", key)
        .param("payload", payload)
        .param("fetchedAt", fetchedAt.atOffset(ZoneOffset.UTC))
        .update();
  }

  public int purgeOlderThan(String namespace, Instant cutoff) {
    return jdbcClient
        .sql("delete from provider_cache where namespace = :namespace and fetched_at < :cutoff")
        .param("namespace", namespace)
        .param("cutoff", cutoff.atOffset(ZoneOffset.UTC))
        .update();
  }
}
