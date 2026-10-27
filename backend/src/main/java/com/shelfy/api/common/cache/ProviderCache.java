package com.shelfy.api.common.cache;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import com.shelfy.api.common.http.ProviderRateLimiter;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionException;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.function.Supplier;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import tools.jackson.databind.ObjectMapper;

@Service
public class ProviderCache implements AutoCloseable {

  private static final Logger LOG = LoggerFactory.getLogger(ProviderCache.class);
  private static final int MEMORY_MAX_ENTRIES = 10_000;
  private static final Duration MEMORY_IDLE = Duration.ofHours(1);

  private final ProviderCacheStore store;
  private final ObjectMapper objectMapper;
  private final Clock clock;
  private final Cache<String, Entry> memory =
      Caffeine.newBuilder().maximumSize(MEMORY_MAX_ENTRIES).expireAfterAccess(MEMORY_IDLE).build();
  private final ConcurrentMap<String, CompletableFuture<Entry>> loading = new ConcurrentHashMap<>();
  private final ExecutorService refresher = Executors.newVirtualThreadPerTaskExecutor();

  @Autowired
  public ProviderCache(ProviderCacheStore store, ObjectMapper objectMapper) {
    this(store, objectMapper, Clock.systemUTC());
  }

  ProviderCache(ProviderCacheStore store, ObjectMapper objectMapper, Clock clock) {
    this.store = store;
    this.objectMapper = objectMapper;
    this.clock = clock;
  }

  public <T> T get(ProviderCacheSpace space, String key, Class<T> type, Supplier<T> loader) {
    String id = space.namespace() + '\n' + key;
    Entry cached = lookup(space, key, id, type);
    if (cached == null) {
      return type.cast(load(space, key, id, loader).value());
    }
    if (cached.olderThan(space.freshFor(), clock.instant())) {
      refreshInBackground(space, key, id, loader);
    }
    return type.cast(cached.value());
  }

  private Entry lookup(ProviderCacheSpace space, String key, String id, Class<?> type) {
    Instant now = clock.instant();
    Entry entry = memory.getIfPresent(id);
    if (entry != null && !entry.olderThan(space.keptFor(), now)) {
      return entry;
    }
    try {
      entry =
          store
              .find(space.namespace(), key)
              .filter(stored -> !stored.fetchedAt().isBefore(now.minus(space.keptFor())))
              .map(
                  stored ->
                      new Entry(objectMapper.readValue(stored.payload(), type), stored.fetchedAt()))
              .orElse(null);
    } catch (RuntimeException ex) {
      LOG.warn("Ignoring unreadable {} cache entry: {}", space.namespace(), ex.getMessage());
      return null;
    }
    if (entry != null) {
      memory.put(id, entry);
    }
    return entry;
  }

  private Entry load(ProviderCacheSpace space, String key, String id, Supplier<?> loader) {
    CompletableFuture<Entry> mine = new CompletableFuture<>();
    CompletableFuture<Entry> pending = loading.putIfAbsent(id, mine);
    if (pending != null) {
      return await(pending);
    }
    try {
      Entry entry = new Entry(loader.get(), clock.instant());
      remember(space, key, id, entry);
      mine.complete(entry);
      return entry;
    } catch (RuntimeException ex) {
      mine.completeExceptionally(ex);
      throw ex;
    } finally {
      loading.remove(id, mine);
    }
  }

  private void refreshInBackground(
      ProviderCacheSpace space, String key, String id, Supplier<?> loader) {
    if (loading.containsKey(id)) {
      return;
    }
    refresher.execute(
        () ->
            ScopedValue.where(ProviderRateLimiter.MAX_WAIT, Duration.ZERO)
                .run(
                    () -> {
                      try {
                        load(space, key, id, loader);
                      } catch (RuntimeException ex) {
                        LOG.debug(
                            "Keeping stale {} entry; refresh failed: {}",
                            space.namespace(),
                            ex.getMessage());
                      }
                    }));
  }

  private void remember(ProviderCacheSpace space, String key, String id, Entry entry) {
    memory.put(id, entry);
    try {
      store.save(
          space.namespace(),
          key,
          objectMapper.writeValueAsString(entry.value()),
          entry.fetchedAt());
    } catch (RuntimeException ex) {
      LOG.warn("Could not persist {} cache entry: {}", space.namespace(), ex.getMessage());
    }
  }

  private static Entry await(CompletableFuture<Entry> pending) {
    try {
      return pending.join();
    } catch (CompletionException ex) {
      if (ex.getCause() instanceof RuntimeException cause) {
        throw cause;
      }
      throw ex;
    }
  }

  @Override
  public void close() {
    refresher.close();
  }

  private record Entry(Object value, Instant fetchedAt) {

    boolean olderThan(Duration age, Instant now) {
      return fetchedAt.isBefore(now.minus(age));
    }
  }
}
