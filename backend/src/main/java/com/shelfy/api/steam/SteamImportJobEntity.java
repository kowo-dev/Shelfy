package com.shelfy.api.steam;

import com.shelfy.api.common.ImportJobEntity;
import jakarta.persistence.AttributeOverride;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.util.UUID;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "steam_imports")
@AttributeOverride(name = "entriesTotal", column = @Column(name = "games_total", nullable = false))
@AttributeOverride(
    name = "entriesImported",
    column = @Column(name = "games_imported", nullable = false))
@AttributeOverride(
    name = "entriesSkipped",
    column = @Column(name = "games_skipped", nullable = false))
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class SteamImportJobEntity extends ImportJobEntity {

  @Column(name = "steam_id", nullable = false)
  private String steamId;

  public SteamImportJobEntity(UUID userId, String steamId) {
    super(userId);
    this.steamId = steamId;
  }
}
