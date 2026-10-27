package com.shelfy.api.collection;

import com.shelfy.api.collection.dto.MediaReferenceDto;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Semaphore;
import java.util.function.Function;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;

@Component
@RequiredArgsConstructor
public class MediaResolver implements AutoCloseable {

  private static final int MAX_CONCURRENT_LOOKUPS = 4;

  private final MediaRepository mediaRepository;
  private final MediaCatalogService mediaCatalogService;
  private final CanonicalWorkService canonicalWorkService;
  private final TransactionTemplate transactionTemplate;
  private final ExecutorService executor = Executors.newVirtualThreadPerTaskExecutor();
  private final Semaphore lookups = new Semaphore(MAX_CONCURRENT_LOOKUPS);

  public Optional<MediaEntity> findExisting(
      String provider, MediaType mediaType, String externalId) {
    return mediaRepository.findByExternalIdAndProviderAndMediaType(externalId, provider, mediaType);
  }

  public MediaEntity findOrCreate(String externalId, String provider, MediaType mediaType) {
    return mediaRepository
        .findByExternalIdAndProviderAndMediaType(externalId, provider, mediaType)
        .orElseGet(() -> create(externalId, provider, mediaType));
  }

  public List<MediaEntity> findOrCreateAll(List<MediaReferenceDto> references) {
    return mapConcurrently(
        references, ref -> findOrCreate(ref.externalId(), ref.provider(), ref.mediaType()));
  }

  private <I, R> List<R> mapConcurrently(List<I> items, Function<I, R> task) {
    List<CompletableFuture<R>> futures =
        items.stream()
            .map(item -> CompletableFuture.supplyAsync(() -> throttled(task, item), executor))
            .toList();
    try {
      return futures.stream().map(CompletableFuture::join).toList();
    } catch (CompletionException ex) {
      if (ex.getCause() instanceof RuntimeException cause) {
        throw cause;
      }
      throw ex;
    }
  }

  private <I, R> R throttled(Function<I, R> task, I item) {
    lookups.acquireUninterruptibly();
    try {
      return task.apply(item);
    } finally {
      lookups.release();
    }
  }

  private MediaEntity create(String externalId, String provider, MediaType mediaType) {
    CanonicalMedia canonical = mediaCatalogService.resolve(provider, mediaType, externalId);
    Set<ExternalMediaReference> references = new LinkedHashSet<>(canonical.externalReferences());
    references.add(new ExternalMediaReference(provider, externalId));
    try {
      return transactionTemplate.execute(
          status ->
              mediaRepository.saveAndFlush(
                  new MediaEntity(
                      externalId,
                      provider,
                      mediaType,
                      canonicalWorkService.resolve(mediaType, references),
                      canonical.title(),
                      canonical.coverUrl(),
                      canonical.metadata(),
                      canonical.isAdult())));
    } catch (DataIntegrityViolationException ex) {
      return mediaRepository
          .findByExternalIdAndProviderAndMediaType(externalId, provider, mediaType)
          .orElseThrow(() -> ex);
    }
  }

  @Override
  public void close() {
    executor.close();
  }
}
