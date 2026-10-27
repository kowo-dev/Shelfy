package com.shelfy.api.collection;

import java.util.LinkedHashSet;
import java.util.Optional;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class CanonicalWorkService {

  private final CanonicalWorkRepository canonicalWorkRepository;
  private final CanonicalWorkReferenceRepository referenceRepository;

  @Transactional
  public CanonicalWorkEntity resolve(MediaType mediaType, Set<ExternalMediaReference> references) {
    Set<ExternalMediaReference> uniqueReferences = new LinkedHashSet<>(references);
    CanonicalWorkEntity work =
        uniqueReferences.stream()
            .map(reference -> existingWork(mediaType, reference))
            .flatMap(Optional::stream)
            .findFirst()
            .orElseGet(() -> canonicalWorkRepository.save(new CanonicalWorkEntity(mediaType)));

    for (ExternalMediaReference reference : uniqueReferences) {
      referenceRepository.insertIfAbsent(
          work.getId(), reference.provider(), mediaType.name(), reference.externalId());
      work =
          existingWork(mediaType, reference)
              .orElseThrow(
                  () -> new IllegalStateException("Reference must exist right after insert"));
    }
    return work;
  }

  private Optional<CanonicalWorkEntity> existingWork(
      MediaType mediaType, ExternalMediaReference reference) {
    return referenceRepository
        .findByProviderAndMediaTypeAndExternalId(
            reference.provider(), mediaType, reference.externalId())
        .map(CanonicalWorkReferenceEntity::getCanonicalWork);
  }
}
