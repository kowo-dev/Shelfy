package com.shelfy.api.collection;

import static org.junit.jupiter.api.Assertions.assertSame;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.LinkedHashSet;
import java.util.Optional;
import java.util.Set;
import org.junit.jupiter.api.Test;

class CanonicalWorkServiceTest {

  private final CanonicalWorkRepository canonicalWorkRepository =
      mock(CanonicalWorkRepository.class);
  private final CanonicalWorkReferenceRepository referenceRepository =
      mock(CanonicalWorkReferenceRepository.class);
  private final CanonicalWorkService service =
      new CanonicalWorkService(canonicalWorkRepository, referenceRepository);

  @Test
  void resolve_reusesWorkKnownByAnotherProviderReference() {
    CanonicalWorkEntity existingWork = new CanonicalWorkEntity(MediaType.GAME);
    CanonicalWorkReferenceEntity steamReference =
        new CanonicalWorkReferenceEntity(existingWork, "steam", MediaType.GAME, "123");
    CanonicalWorkReferenceEntity igdbReference =
        new CanonicalWorkReferenceEntity(existingWork, "igdb", MediaType.GAME, "456");
    Set<ExternalMediaReference> references = new LinkedHashSet<>();
    references.add(new ExternalMediaReference("igdb", "456"));
    references.add(new ExternalMediaReference("steam", "123"));
    when(referenceRepository.findByProviderAndMediaTypeAndExternalId(
            "steam", MediaType.GAME, "123"))
        .thenReturn(Optional.of(steamReference));
    when(referenceRepository.findByProviderAndMediaTypeAndExternalId("igdb", MediaType.GAME, "456"))
        .thenReturn(Optional.empty())
        .thenReturn(Optional.of(igdbReference));

    CanonicalWorkEntity resolved = service.resolve(MediaType.GAME, references);

    assertSame(existingWork, resolved);
    verify(canonicalWorkRepository, never()).save(any());
    verify(referenceRepository)
        .insertIfAbsent(eq(existingWork.getId()), eq("igdb"), eq("GAME"), eq("456"));
    verify(referenceRepository)
        .insertIfAbsent(eq(existingWork.getId()), eq("steam"), eq("GAME"), eq("123"));
  }
}
