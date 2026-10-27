package com.shelfy.api.steam;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SteamImportEntryRepository extends JpaRepository<SteamImportEntryEntity, UUID> {

  List<SteamImportEntryEntity> findByImportIdOrderBySteamNameAsc(UUID importId);
}
