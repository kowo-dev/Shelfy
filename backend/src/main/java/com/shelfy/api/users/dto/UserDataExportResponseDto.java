package com.shelfy.api.users.dto;

import com.shelfy.api.auth.CollectionVisibility;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public record UserDataExportResponseDto(
    ExportedProfile profile,
    List<ExportedCollectionItem> collection,
    List<ExportedEssentialEntry> essentials,
    List<ExportedSteamImport> steamImports,
    List<ExportedList> lists,
    List<ExportedComment> comments,
    ExportedFollows follows,
    List<ExportedWatchLog> watchLogs,
    List<ExportedVersusPool> versusPools,
    Instant exportedAt) {

  public record ExportedProfile(
      UUID id,
      String email,
      String username,
      String displayName,
      String bio,
      String profileBannerUrl,
      String profileBannerTitle,
      String profileBannerProvider,
      String profileBannerSourceUrl,
      Integer profileBannerPosition,
      CollectionVisibility profileVisibility,
      boolean allowAdultContent,
      boolean emailVerified,
      String steamId,
      String steamDisplayName,
      String steamAvatarUrl,
      Instant steamConnectedAt,
      Instant createdAt) {}

  public record ExportedCollectionItem(
      UUID id,
      String mediaTitle,
      String mediaType,
      String status,
      Integer rating,
      Map<String, Object> note,
      Map<String, Object> progress,
      Instant createdAt,
      Instant updatedAt) {}

  public record ExportedEssentialEntry(
      int slot, String mediaType, String mediaTitle, Instant createdAt) {}

  public record ExportedSteamImport(
      UUID jobId,
      String steamId,
      String status,
      int gamesTotal,
      int gamesImported,
      int gamesSkipped,
      Instant createdAt,
      List<ExportedSteamImportEntry> entries) {}

  public record ExportedList(
      UUID id,
      String name,
      String description,
      CollectionVisibility visibility,
      List<String> tags,
      List<String> mediaTitles,
      Instant createdAt) {}

  public record ExportedComment(
      UUID id, String targetType, UUID targetId, String content, Instant createdAt) {}

  public record ExportedFollows(List<ExportedFollow> following, List<ExportedFollow> followers) {}

  public record ExportedFollow(UUID otherUserId, Instant createdAt) {}

  public record ExportedWatchLog(
      UUID id,
      String mediaTitle,
      LocalDate occurredAt,
      boolean repeat,
      String name,
      Integer rating,
      Map<String, Object> review,
      boolean containsSpoilers,
      String source,
      Instant createdAt) {}

  public record ExportedVersusPool(
      UUID id,
      String name,
      String description,
      CollectionVisibility visibility,
      Instant createdAt) {}

  public record ExportedSteamImportEntry(
      long steamAppId, String steamName, String status, String reason, Instant createdAt) {}
}
