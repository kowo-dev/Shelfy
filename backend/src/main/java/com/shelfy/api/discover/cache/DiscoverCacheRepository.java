package com.shelfy.api.discover.cache;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DiscoverCacheRepository extends JpaRepository<DiscoverCacheEntity, UUID> {

  Optional<DiscoverCacheEntity> findByCategory(String category);
}
