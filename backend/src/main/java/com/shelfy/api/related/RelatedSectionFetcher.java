package com.shelfy.api.related;

import com.shelfy.api.related.dto.RelatedSectionResponseDto;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.function.Supplier;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

@Component
public class RelatedSectionFetcher implements AutoCloseable {

  private static final Logger LOG = LoggerFactory.getLogger(RelatedSectionFetcher.class);

  private final ExecutorService executor = Executors.newVirtualThreadPerTaskExecutor();

  public List<RelatedSectionResponseDto> fetchAll(
      List<Supplier<Optional<RelatedSectionResponseDto>>> lookups) {
    List<CompletableFuture<Optional<RelatedSectionResponseDto>>> futures =
        lookups.stream().map(lookup -> CompletableFuture.supplyAsync(lookup, executor)).toList();
    return futures.stream()
        .map(RelatedSectionFetcher::joinQuietly)
        .flatMap(Optional::stream)
        .toList();
  }

  private static Optional<RelatedSectionResponseDto> joinQuietly(
      CompletableFuture<Optional<RelatedSectionResponseDto>> future) {
    try {
      return future.join();
    } catch (RuntimeException ex) {
      LOG.warn("Related media section lookup failed: {}", ex.getMessage());
      return Optional.empty();
    }
  }

  @Override
  public void close() {
    executor.close();
  }
}
