package com.shelfy.api.collection;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MediaRepository extends JpaRepository<MediaEntity, UUID> {

  Optional<MediaEntity> findByExternalIdAndProviderAndMediaType(
      String externalId, String provider, MediaType mediaType);

  List<MediaEntity> findByProviderAndMediaTypeAndExternalIdIn(
      String provider, MediaType mediaType, List<String> externalIds);

  List<MediaEntity> findByProviderAndMediaType(String provider, MediaType mediaType);
}
