package com.shelfy.api.steam;

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
@Table(name = "steam_import_entries")
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class SteamImportEntryEntity extends ImportEntryEntity {

  @Column(name = "steam_app_id", nullable = false)
  private long steamAppId;

  @Column(name = "steam_name", nullable = false)
  private String steamName;

  @Column(name = "igdb_id")
  private Long igdbId;

  @Column(name = "igdb_name")
  private String igdbName;

  public SteamImportEntryEntity(
      UUID importId,
      UUID userId,
      long steamAppId,
      String steamName,
      ImportEntryStatus status,
      String reason,
      String reasonDetail,
      UUID mediaId,
      Long igdbId,
      String igdbName) {
    super(importId, userId, status, reason, reasonDetail, mediaId);
    this.steamAppId = steamAppId;
    this.steamName = steamName;
    this.igdbId = igdbId;
    this.igdbName = igdbName;
  }
}
