package com.shelfy.api.letterboxd;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface LetterboxdImportEntryRepository
    extends JpaRepository<LetterboxdImportEntryEntity, UUID> {

  List<LetterboxdImportEntryEntity> findByImportIdOrderByLetterboxdTitleAsc(UUID importId);
}
