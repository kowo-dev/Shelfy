package com.shelfy.api.common.cache;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.timeout;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.shelfy.api.common.cache.ProviderCacheStore.StoredEntry;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

class ProviderCacheTest {

  private static final Instant NOW = Instant.parse("2026-10-16T12:00:00Z");
  private static final ProviderCacheSpace SPACE = ProviderCacheSpace.TMDB_MOVIE;

  record Title(String name, List<String> genres) {}

  private final ProviderCacheStore store = mock(ProviderCacheStore.class);
  private final ProviderCache cache =
      new ProviderCache(store, JsonMapper.builder().build(), Clock.fixed(NOW, ZoneOffset.UTC));
  private final AtomicInteger loads = new AtomicInteger();

  @AfterEach
  void close() {
    cache.close();
  }

  @Test
  void get_loadsOnceThenServesFromMemoryAndPersists() {
    when(store.find(anyString(), anyString())).thenReturn(Optional.empty());

    Title first = cache.get(SPACE, "1", Title.class, this::load);
    Title second = cache.get(SPACE, "1", Title.class, this::load);

    assertEquals(new Title("Dune", List.of("Sci-Fi")), first);
    assertEquals(first, second);
    assertEquals(1, loads.get());
    verify(store).save(eq(SPACE.namespace()), eq("1"), anyString(), eq(NOW));
  }

  @Test
  void get_usesAFreshStoredEntryWithoutCallingTheProvider() {
    when(store.find(SPACE.namespace(), "1"))
        .thenReturn(
            Optional.of(
                new StoredEntry(
                    "{\"name\":\"Arrival\",\"genres\":[\"Drama\"]}", NOW.minusSeconds(60))));

    Title title = cache.get(SPACE, "1", Title.class, this::load);

    assertEquals(new Title("Arrival", List.of("Drama")), title);
    assertEquals(0, loads.get());
    verify(store, never()).save(anyString(), anyString(), anyString(), any());
  }

  @Test
  void get_servesAStaleEntryAndRefreshesItInTheBackground() {
    Instant stale = NOW.minus(SPACE.freshFor()).minus(Duration.ofMinutes(1));
    when(store.find(SPACE.namespace(), "1"))
        .thenReturn(Optional.of(new StoredEntry("{\"name\":\"Old\",\"genres\":[]}", stale)));

    Title title = cache.get(SPACE, "1", Title.class, this::load);

    assertEquals("Old", title.name());
    verify(store, timeout(2_000)).save(eq(SPACE.namespace()), eq("1"), anyString(), eq(NOW));
    assertEquals(1, loads.get());
  }

  @Test
  void get_ignoresEntriesPastTheirRetention() {
    Instant expired = NOW.minus(SPACE.keptFor()).minusSeconds(1);
    when(store.find(SPACE.namespace(), "1"))
        .thenReturn(Optional.of(new StoredEntry("{\"name\":\"Gone\",\"genres\":[]}", expired)));

    Title title = cache.get(SPACE, "1", Title.class, this::load);

    assertEquals("Dune", title.name());
    assertEquals(1, loads.get());
  }

  @Test
  void get_propagatesProviderFailuresWhenNothingIsCached() {
    when(store.find(anyString(), anyString())).thenReturn(Optional.empty());

    assertThrows(
        IllegalStateException.class,
        () ->
            cache.get(
                SPACE,
                "1",
                Title.class,
                () -> {
                  throw new IllegalStateException("provider down");
                }));
    assertTrue(cache.get(SPACE, "1", Title.class, this::load).genres().contains("Sci-Fi"));
  }

  private Title load() {
    loads.incrementAndGet();
    return new Title("Dune", List.of("Sci-Fi"));
  }
}
