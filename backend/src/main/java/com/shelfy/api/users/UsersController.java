package com.shelfy.api.users;

import com.shelfy.api.auth.AuthService;
import com.shelfy.api.auth.dto.DeleteAccountRequestDto;
import com.shelfy.api.auth.dto.RequestEmailChangeRequestDto;
import com.shelfy.api.auth.dto.UpdateProfileBannerRequestDto;
import com.shelfy.api.auth.dto.UpdateProfileRequestDto;
import com.shelfy.api.auth.dto.UserResponseDto;
import com.shelfy.api.auth.dto.UsernameAvailabilityResponseDto;
import com.shelfy.api.collection.CollectionSort;
import com.shelfy.api.collection.MediaType;
import com.shelfy.api.collection.dto.CollectionFilter;
import com.shelfy.api.collection.dto.CollectionStatsResponseDto;
import com.shelfy.api.collection.dto.CommonCollectionItemResponseDto;
import com.shelfy.api.collection.dto.PublicCollectionItemResponseDto;
import com.shelfy.api.collection.dto.ShelfCompareResponseDto;
import com.shelfy.api.collection.dto.WatchLogResponseDto;
import com.shelfy.api.common.Paging;
import com.shelfy.api.common.dto.PagedResponseDto;
import com.shelfy.api.community.CommunityFilter;
import com.shelfy.api.community.CommunityScope;
import com.shelfy.api.community.CommunitySort;
import com.shelfy.api.essentials.dto.EssentialEntryResponseDto;
import com.shelfy.api.users.dto.ReviewResponseDto;
import com.shelfy.api.users.dto.UserActivityResponseDto;
import com.shelfy.api.users.dto.UserDataExportResponseDto;
import com.shelfy.api.users.dto.UserProfileResponseDto;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/v1/users")
@RequiredArgsConstructor
public class UsersController {

  private final AuthService authService;
  private final ProfileSettingsService profileSettingsService;
  private final UserProfileService userProfileService;
  private final UserDataExportService userDataExportService;

  @GetMapping("/me")
  public ResponseEntity<UserResponseDto> getCurrentUser(@AuthenticationPrincipal UUID userId) {
    return ResponseEntity.ok(authService.getCurrentUser(userId));
  }

  @GetMapping("/me/export")
  public ResponseEntity<UserDataExportResponseDto> exportMe(@AuthenticationPrincipal UUID userId) {
    return ResponseEntity.ok()
        .header(
            HttpHeaders.CONTENT_DISPOSITION,
            ContentDisposition.attachment().filename("shelfy-data-export.json").build().toString())
        .body(userDataExportService.export(userId));
  }

  @DeleteMapping("/me")
  public ResponseEntity<Void> deleteMe(
      @AuthenticationPrincipal UUID userId, @Valid @RequestBody DeleteAccountRequestDto request) {
    authService.deleteAccount(userId, request.password());
    return ResponseEntity.noContent().build();
  }

  @PatchMapping("/me")
  public ResponseEntity<UserResponseDto> updateMe(
      @AuthenticationPrincipal UUID userId, @Valid @RequestBody UpdateProfileRequestDto request) {
    return ResponseEntity.ok(profileSettingsService.updateProfile(userId, request));
  }

  @PatchMapping("/me/profile-banner")
  public ResponseEntity<UserResponseDto> updateProfileBanner(
      @AuthenticationPrincipal UUID userId,
      @Valid @RequestBody UpdateProfileBannerRequestDto request) {
    return ResponseEntity.ok(profileSettingsService.updateProfileBanner(userId, request));
  }

  @DeleteMapping("/me/profile-banner")
  public ResponseEntity<UserResponseDto> clearProfileBanner(@AuthenticationPrincipal UUID userId) {
    return ResponseEntity.ok(profileSettingsService.clearProfileBanner(userId));
  }

  @PostMapping("/me/avatar")
  public ResponseEntity<UserResponseDto> updateAvatar(
      @AuthenticationPrincipal UUID userId, @RequestParam("file") MultipartFile file) {
    return ResponseEntity.ok(profileSettingsService.updateAvatar(userId, file));
  }

  @DeleteMapping("/me/avatar")
  public ResponseEntity<UserResponseDto> removeAvatar(@AuthenticationPrincipal UUID userId) {
    return ResponseEntity.ok(profileSettingsService.removeAvatar(userId));
  }

  @PostMapping("/me/email/change-request")
  public ResponseEntity<Void> requestEmailChange(
      @AuthenticationPrincipal UUID userId,
      @Valid @RequestBody RequestEmailChangeRequestDto request) {
    authService.requestEmailChange(userId, request.newEmail());
    return ResponseEntity.noContent().build();
  }

  @GetMapping("/me/username-availability")
  public ResponseEntity<UsernameAvailabilityResponseDto> checkUsernameAvailability(
      @AuthenticationPrincipal UUID userId, @RequestParam String value) {
    boolean available = profileSettingsService.isUsernameAvailable(userId, value);
    return ResponseEntity.ok(new UsernameAvailabilityResponseDto(available));
  }

  @GetMapping("/{username}/profile")
  public ResponseEntity<UserProfileResponseDto> getProfile(
      @AuthenticationPrincipal UUID userId, @PathVariable String username) {
    return ResponseEntity.ok(userProfileService.getProfile(userId, username));
  }

  @GetMapping("/{username}/collection")
  public ResponseEntity<PagedResponseDto<PublicCollectionItemResponseDto>> getCollection(
      @AuthenticationPrincipal UUID userId,
      @PathVariable String username,
      @ModelAttribute CollectionFilter filter,
      @RequestParam(required = false) String sortBy,
      @RequestParam(defaultValue = "desc") String sortDirection,
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "20") int size) {
    Pageable pageable = Paging.of(page, size, CollectionSort.resolve(sortBy, sortDirection));
    return ResponseEntity.ok(userProfileService.getCollection(userId, username, filter, pageable));
  }

  @GetMapping("/{username}/collection/common")
  public ResponseEntity<PagedResponseDto<CommonCollectionItemResponseDto>> getCommonCollection(
      @AuthenticationPrincipal UUID userId,
      @PathVariable String username,
      @ModelAttribute CollectionFilter filter,
      @RequestParam(required = false) String sortBy,
      @RequestParam(defaultValue = "desc") String sortDirection,
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "24") int size) {
    Pageable pageable = Paging.of(page, size, CollectionSort.resolve(sortBy, sortDirection));
    return ResponseEntity.ok(
        userProfileService.getCommonCollection(userId, username, filter, pageable));
  }

  @GetMapping("/{username}/compare")
  public ResponseEntity<ShelfCompareResponseDto> compare(
      @AuthenticationPrincipal UUID userId, @PathVariable String username) {
    return ResponseEntity.ok(userProfileService.compare(userId, username));
  }

  @GetMapping("/{username}/collection/stats")
  public ResponseEntity<CollectionStatsResponseDto> getCollectionStats(
      @AuthenticationPrincipal UUID userId, @PathVariable String username) {
    return ResponseEntity.ok(userProfileService.getCollectionStats(userId, username));
  }

  @GetMapping("/{username}/essentials")
  public ResponseEntity<List<EssentialEntryResponseDto>> getEssentials(
      @AuthenticationPrincipal UUID userId, @PathVariable String username) {
    return ResponseEntity.ok(userProfileService.getEssentials(userId, username));
  }

  @GetMapping("/{username}/reviews")
  public ResponseEntity<PagedResponseDto<ReviewResponseDto>> listReviews(
      @AuthenticationPrincipal UUID userId,
      @PathVariable String username,
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "20") int size,
      @RequestParam(required = false) String q) {
    return ResponseEntity.ok(
        userProfileService.getReviews(
            userId, username, q, Paging.of(page, size, Sort.by(Sort.Direction.DESC, "updatedAt"))));
  }

  @GetMapping("/{username}/activity")
  public ResponseEntity<PagedResponseDto<UserActivityResponseDto>> listActivity(
      @AuthenticationPrincipal UUID userId,
      @PathVariable String username,
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "12") int size) {
    return ResponseEntity.ok(
        userProfileService.getActivity(
            userId,
            username,
            Paging.of(
                page,
                size,
                Sort.by(Sort.Direction.DESC, "createdAt")
                    .and(Sort.by(Sort.Direction.DESC, "id")))));
  }

  @GetMapping("/reviews")
  public ResponseEntity<PagedResponseDto<ReviewResponseDto>> browseReviews(
      @AuthenticationPrincipal UUID userId,
      @RequestParam(required = false) String q,
      @RequestParam(defaultValue = "ALL") CommunityScope scope,
      @RequestParam(required = false) MediaType mediaType,
      @RequestParam(defaultValue = "RECENT") CommunitySort sort,
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "20") int size) {
    return ResponseEntity.ok(
        userProfileService.browseReviews(
            userId, new CommunityFilter(q, scope, mediaType, sort), Paging.of(page, size)));
  }

  @GetMapping("/reviews/{id}")
  public ResponseEntity<ReviewResponseDto> getReview(
      @AuthenticationPrincipal UUID userId, @PathVariable UUID id) {
    return ResponseEntity.ok(userProfileService.getReview(userId, id));
  }

  @GetMapping("/reviews/{id}/watch-log")
  public ResponseEntity<List<WatchLogResponseDto>> getReviewWatchLog(
      @AuthenticationPrincipal UUID userId, @PathVariable UUID id) {
    return ResponseEntity.ok(userProfileService.getReviewWatchLog(userId, id));
  }

  @PostMapping("/reviews/{id}/likes")
  public ResponseEntity<ReviewResponseDto> like(
      @AuthenticationPrincipal UUID userId, @PathVariable UUID id) {
    return ResponseEntity.ok(userProfileService.like(userId, id));
  }

  @DeleteMapping("/reviews/{id}/likes")
  public ResponseEntity<ReviewResponseDto> unlike(
      @AuthenticationPrincipal UUID userId, @PathVariable UUID id) {
    return ResponseEntity.ok(userProfileService.unlike(userId, id));
  }

  @GetMapping("/reviews/media")
  public ResponseEntity<List<ReviewResponseDto>> listMediaReviews(
      @AuthenticationPrincipal UUID userId,
      @RequestParam String provider,
      @RequestParam MediaType mediaType,
      @RequestParam String externalId) {
    return ResponseEntity.ok(
        userProfileService.getMediaReviews(userId, provider, mediaType, externalId));
  }
}
