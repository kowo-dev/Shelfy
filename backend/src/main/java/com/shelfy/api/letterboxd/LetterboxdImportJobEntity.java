package com.shelfy.api.letterboxd;

import com.shelfy.api.common.ImportJobEntity;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.util.UUID;
import lombok.AccessLevel;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "letterboxd_imports")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class LetterboxdImportJobEntity extends ImportJobEntity {

  public LetterboxdImportJobEntity(UUID userId) {
    super(userId);
  }
}
