package com.shelfy.api.collection;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest
class CanonicalWorkServiceConcurrencyTest {

  @Autowired private CanonicalWorkService canonicalWorkService;
  @Autowired private CanonicalWorkReferenceRepository referenceRepository;

  @Test
  void concurrentResolveOfTheSameReference_convergesOnOneCanonicalWork() throws Exception {
    String externalId = "concurrency-" + UUID.randomUUID();
    ExternalMediaReference reference = new ExternalMediaReference("tmdb", externalId);
    int threadCount = 8;
    ExecutorService executor = Executors.newFixedThreadPool(threadCount);
    CountDownLatch startLatch = new CountDownLatch(1);
    try {
      List<Callable<CanonicalWorkEntity>> tasks =
          java.util.stream.IntStream.range(0, threadCount)
              .<Callable<CanonicalWorkEntity>>mapToObj(
                  i ->
                      () -> {
                        startLatch.await();
                        return canonicalWorkService.resolve(MediaType.MOVIE, Set.of(reference));
                      })
              .toList();
      List<Future<CanonicalWorkEntity>> futures = tasks.stream().map(executor::submit).toList();
      startLatch.countDown();

      Set<UUID> resolvedWorkIds = new java.util.HashSet<>();
      for (Future<CanonicalWorkEntity> future : futures) {
        resolvedWorkIds.add(future.get(10, TimeUnit.SECONDS).getId());
      }

      assertEquals(
          1, resolvedWorkIds.size(), "all callers must resolve to the same canonical work");
      assertTrue(
          referenceRepository
              .findByProviderAndMediaTypeAndExternalId("tmdb", MediaType.MOVIE, externalId)
              .isPresent());
    } finally {
      executor.shutdownNow();
    }
  }
}
