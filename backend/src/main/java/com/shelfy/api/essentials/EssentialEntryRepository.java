package com.shelfy.api.essentials;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface EssentialEntryRepository extends JpaRepository<EssentialEntryEntity, UUID> {

  List<EssentialEntryEntity> findByUserIdOrderBySlotAsc(UUID userId);

  void deleteByUserId(UUID userId);
}
