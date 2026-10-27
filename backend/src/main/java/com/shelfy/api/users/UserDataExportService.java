package com.shelfy.api.users;

import com.shelfy.api.auth.UserEntity;
import com.shelfy.api.auth.UserRepository;
import com.shelfy.api.collection.UserMediaEntity;
import com.shelfy.api.collection.UserMediaRepository;
import com.shelfy.api.collection.WatchLogRepository;
import com.shelfy.api.comments.CommentRepository;
import com.shelfy.api.common.exception.ErrorCode;
import com.shelfy.api.common.exception.ResourceNotFoundException;
import com.shelfy.api.essentials.EssentialEntryRepository;
import com.shelfy.api.follows.FollowRepository;
import com.shelfy.api.lists.MediaListRepository;
import com.shelfy.api.steam.SteamImportEntryEntity;
import com.shelfy.api.steam.SteamImportEntryRepository;
import com.shelfy.api.steam.SteamImportJobEntity;
import com.shelfy.api.steam.SteamImportJobRepository;
import com.shelfy.api.users.dto.UserDataExportResponseDto;
import com.shelfy.api.users.dto.UserDataExportResponseDto.ExportedCollectionItem;
import com.shelfy.api.users.dto.UserDataExportResponseDto.ExportedComment;
import com.shelfy.api.users.dto.UserDataExportResponseDto.ExportedEssentialEntry;
import com.shelfy.api.users.dto.UserDataExportResponseDto.ExportedFollow;
import com.shelfy.api.users.dto.UserDataExportResponseDto.ExportedFollows;
import com.shelfy.api.users.dto.UserDataExportResponseDto.ExportedList;
import com.shelfy.api.users.dto.UserDataExportResponseDto.ExportedProfile;
import com.shelfy.api.users.dto.UserDataExportResponseDto.ExportedSteamImport;
import com.shelfy.api.users.dto.UserDataExportResponseDto.ExportedSteamImportEntry;
import com.shelfy.api.users.dto.UserDataExportResponseDto.ExportedVersusPool;
import com.shelfy.api.users.dto.UserDataExportResponseDto.ExportedWatchLog;
import com.shelfy.api.versus.VersusPoolRepository;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class UserDataExportService {

  private final UserRepository userRepository;
  private final UserMediaRepository userMediaRepository;
  private final EssentialEntryRepository essentialEntryRepository;
  private final SteamImportJobRepository steamImportJobRepository;
  private final SteamImportEntryRepository steamImportEntryRepository;

  private final MediaListRepository mediaListRepository;
  private final CommentRepository commentRepository;
  private final FollowRepository followRepository;
  private final WatchLogRepository watchLogRepository;
  private final VersusPoolRepository versusPoolRepository;

  @Transactional(readOnly = true)
  public UserDataExportResponseDto export(UUID userId) {
    UserEntity user =
        userRepository
            .findById(userId)
            .orElseThrow(
                () -> new ResourceNotFoundException(ErrorCode.USER_NOT_FOUND, "User not found"));

    return new UserDataExportResponseDto(
        toProfile(user),
        toCollection(userId),
        toEssentials(userId),
        toSteamImports(userId),
        toLists(userId),
        toComments(userId),
        toFollows(userId),
        toWatchLogs(userId),
        toVersusPools(userId),
        Instant.now());
  }

  private List<ExportedList> toLists(UUID userId) {
    return mediaListRepository.findByUserIdOrderByUpdatedAtDesc(userId).stream()
        .map(
            list ->
                new ExportedList(
                    list.getId(),
                    list.getName(),
                    list.getDescription(),
                    list.getVisibility(),
                    List.copyOf(list.getTags()),
                    list.getItems().stream().map(item -> item.getMedia().getTitle()).toList(),
                    list.getCreatedAt()))
        .toList();
  }

  private List<ExportedComment> toComments(UUID userId) {
    return commentRepository.findByAuthorIdOrderByCreatedAtAsc(userId).stream()
        .filter(comment -> !comment.isDeleted())
        .map(
            comment ->
                new ExportedComment(
                    comment.getId(),
                    comment.getTargetType().name(),
                    comment.getTargetId(),
                    comment.getContent(),
                    comment.getCreatedAt()))
        .toList();
  }

  private ExportedFollows toFollows(UUID userId) {
    return new ExportedFollows(
        followRepository.findByFollowerId(userId).stream()
            .map(follow -> new ExportedFollow(follow.getFollowedId(), follow.getCreatedAt()))
            .toList(),
        followRepository.findByFollowedId(userId).stream()
            .map(follow -> new ExportedFollow(follow.getFollowerId(), follow.getCreatedAt()))
            .toList());
  }

  private List<ExportedWatchLog> toWatchLogs(UUID userId) {
    return watchLogRepository.findByUserMediaUserIdOrderByOccurredAtAsc(userId).stream()
        .map(
            log ->
                new ExportedWatchLog(
                    log.getId(),
                    log.getUserMedia().getMedia().getTitle(),
                    log.getOccurredAt(),
                    log.isRepeat(),
                    log.getName(),
                    log.getRating(),
                    log.getReview(),
                    log.isContainsSpoilers(),
                    log.getSource(),
                    log.getCreatedAt()))
        .toList();
  }

  private List<ExportedVersusPool> toVersusPools(UUID userId) {
    return versusPoolRepository.findByUserIdOrderByCreatedAtAsc(userId).stream()
        .map(
            pool ->
                new ExportedVersusPool(
                    pool.getId(),
                    pool.getName(),
                    pool.getDescription(),
                    pool.getVisibility(),
                    pool.getCreatedAt()))
        .toList();
  }

  private ExportedProfile toProfile(UserEntity user) {
    return new ExportedProfile(
        user.getId(),
        user.getEmail(),
        user.getUsername(),
        user.getDisplayName(),
        user.getBio(),
        user.getProfileBannerUrl(),
        user.getProfileBannerTitle(),
        user.getProfileBannerProvider(),
        user.getProfileBannerSourceUrl(),
        user.getProfileBannerPosition(),
        user.getProfileVisibility(),
        user.isAdultContentAllowed(),
        user.isEmailVerified(),
        user.getSteamId(),
        user.getSteamDisplayName(),
        user.getSteamAvatarUrl(),
        user.getSteamConnectedAt(),
        user.getCreatedAt());
  }

  private List<ExportedCollectionItem> toCollection(UUID userId) {
    return userMediaRepository.findAllByUserId(userId).stream()
        .map(this::toCollectionItem)
        .toList();
  }

  private ExportedCollectionItem toCollectionItem(UserMediaEntity userMedia) {
    return new ExportedCollectionItem(
        userMedia.getId(),
        userMedia.getMedia().getTitle(),
        userMedia.getMedia().getMediaType().name(),
        userMedia.getStatus().name(),
        userMedia.getRating(),
        userMedia.getNote(),
        userMedia.getProgress(),
        userMedia.getCreatedAt(),
        userMedia.getUpdatedAt());
  }

  private List<ExportedEssentialEntry> toEssentials(UUID userId) {
    return essentialEntryRepository.findByUserIdOrderBySlotAsc(userId).stream()
        .map(
            entry ->
                new ExportedEssentialEntry(
                    entry.getSlot(),
                    entry.getUserMedia().getMedia().getMediaType().name(),
                    entry.getUserMedia().getMedia().getTitle(),
                    entry.getCreatedAt()))
        .toList();
  }

  private List<ExportedSteamImport> toSteamImports(UUID userId) {
    return steamImportJobRepository.findAllByUserIdOrderByCreatedAtDesc(userId).stream()
        .map(this::toSteamImport)
        .toList();
  }

  private ExportedSteamImport toSteamImport(SteamImportJobEntity job) {
    List<ExportedSteamImportEntry> entries =
        steamImportEntryRepository.findByImportIdOrderBySteamNameAsc(job.getId()).stream()
            .map(this::toSteamImportEntry)
            .toList();
    return new ExportedSteamImport(
        job.getId(),
        job.getSteamId(),
        job.getStatus().name(),
        job.getEntriesTotal(),
        job.getEntriesImported(),
        job.getEntriesSkipped(),
        job.getCreatedAt(),
        entries);
  }

  private ExportedSteamImportEntry toSteamImportEntry(SteamImportEntryEntity entry) {
    return new ExportedSteamImportEntry(
        entry.getSteamAppId(),
        entry.getSteamName(),
        entry.getStatus().name(),
        entry.getReason(),
        entry.getCreatedAt());
  }
}
