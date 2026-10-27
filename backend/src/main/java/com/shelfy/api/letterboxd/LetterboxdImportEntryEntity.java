package com.shelfy.api.letterboxd;

import com.shelfy.api.common.ImportEntryEntity;
import com.shelfy.api.common.ImportEntryStatus;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.util.UUID;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "letterboxd_import_entries")
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class LetterboxdImportEntryEntity extends ImportEntryEntity {

  @Column(name = "letterboxd_title", nullable = false)
  private String letterboxdTitle;

  @Column(name = "letterboxd_year")
  private Integer letterboxdYear;

  @Column(name = "letterboxd_uri")
  private String letterboxdUri;

  @Column(name = "tmdb_id")
  private Long tmdbId;

  public LetterboxdImportEntryEntity(
      UUID importId,
      UUID userId,
      String letterboxdTitle,
      Integer letterboxdYear,
      String letterboxdUri,
      ImportEntryStatus status,
      String reason,
      String reasonDetail,
      UUID mediaId,
      Long tmdbId) {
    super(importId, userId, status, reason, reasonDetail, mediaId);
    this.letterboxdTitle = letterboxdTitle;
    this.letterboxdYear = letterboxdYear;
    this.letterboxdUri = letterboxdUri;
    this.tmdbId = tmdbId;
  }
}
