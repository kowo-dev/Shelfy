package com.shelfy.api.collection;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface CanonicalWorkReferenceRepository
    extends JpaRepository<CanonicalWorkReferenceEntity, UUID> {

  Optional<CanonicalWorkReferenceEntity> findByProviderAndMediaTypeAndExternalId(
      String provider, MediaType mediaType, String externalId);

  @Modifying(clearAutomatically = true)
  @Query(
      value =
          "insert into canonical_work_references"
              + " (id, canonical_work_id, provider, media_type, external_id, created_at)"
              + " values (gen_random_uuid(), :workId, :provider, :mediaType, :externalId, now())"
              + " on conflict (provider, media_type, external_id) do nothing",
      nativeQuery = true)
  int insertIfAbsent(
      @Param("workId") UUID workId,
      @Param("provider") String provider,
      @Param("mediaType") String mediaType,
      @Param("externalId") String externalId);
}
