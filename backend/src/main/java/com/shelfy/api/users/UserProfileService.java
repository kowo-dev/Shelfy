package com.shelfy.api.users;

import com.shelfy.api.activity.UserActivityService;
import com.shelfy.api.auth.AvatarStorageService;
import com.shelfy.api.auth.UserEntity;
import com.shelfy.api.auth.UserRepository;
import com.shelfy.api.auth.ViewerPreferences;
import com.shelfy.api.collection.CollectionService;
import com.shelfy.api.collection.MediaRepository;
import com.shelfy.api.collection.MediaType;
import com.shelfy.api.collection.UserMediaEntity;
import com.shelfy.api.collection.UserMediaRepository;
import com.shelfy.api.collection.UserMediaStatus;
import com.shelfy.api.collection.WatchLogService;
import com.shelfy.api.collection.dto.CollectionFilter;
import com.shelfy.api.collection.dto.CollectionItemResponseDto;
import com.shelfy.api.collection.dto.CollectionStatsResponseDto;
import com.shelfy.api.collection.dto.CommonCollectionItemResponseDto;
import com.shelfy.api.collection.dto.PublicCollectionItemResponseDto;
import com.shelfy.api.collection.dto.ShelfCompareResponseDto;
import com.shelfy.api.collection.dto.WatchLogResponseDto;
import com.shelfy.api.comments.CommentService;
import com.shelfy.api.comments.CommentTargetType;
import com.shelfy.api.comments.dto.CommentResponseDto;
import com.shelfy.api.common.IdCount;
import com.shelfy.api.common.dto.PagedResponseDto;
import com.shelfy.api.common.exception.BadRequestException;
import com.shelfy.api.common.exception.ErrorCode;
import com.shelfy.api.common.exception.ForbiddenException;
import com.shelfy.api.common.exception.ResourceNotFoundException;
import com.shelfy.api.community.CommunityFilter;
import com.shelfy.api.essentials.EssentialsService;
import com.shelfy.api.essentials.dto.EssentialEntryResponseDto;
import com.shelfy.api.federation.InteractionPublisher;
import com.shelfy.api.federation.RemoteActorService;
import com.shelfy.api.follows.FollowService;
import com.shelfy.api.notifications.NotificationService;
import com.shelfy.api.notifications.NotificationType;
import com.shelfy.api.people.VisibilityPolicy;
import com.shelfy.api.users.dto.ReviewResponseDto;
import com.shelfy.api.users.dto.UserActivityResponseDto;
import com.shelfy.api.users.dto.UserProfileResponseDto;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class UserProfileService {

  private static final int COMMENT_PAGE_SIZE = 10;
  private static final int MEDIA_REVIEWS_LIMIT = 50;

  private final UserRepository userRepository;
  private final VisibilityPolicy visibilityPolicy;
  private final CollectionService collectionService;
  private final EssentialsService essentialsService;
  private final UserMediaRepository userMediaRepository;
  private final AvatarStorageService avatarStorageService;
  private final FollowService followService;
  private final MediaRepository mediaRepository;
  private final UserActivityService userActivityService;
  private final ReviewLikeRepository reviewLikeRepository;
  private final CommentService commentService;
  private final ViewerPreferences viewerPreferences;
  private final RemoteActorService remoteActors;
  private final InteractionPublisher interactionPublisher;
  private final NotificationService notificationService;
  private final WatchLogService watchLogService;

  @Transactional(readOnly = true)
  public UserProfileResponseDto getProfile(UUID callerId, String username) {
    UserEntity target = requireVisible(callerId, username);
    boolean adultContentAllowed = viewerPreferences.allowsAdultContent(callerId);
    long totalItems = userMediaRepository.countByUserId(target.getId());
    long doneCount =
        userMediaRepository.countByUserIdAndStatus(target.getId(), UserMediaStatus.DONE);
    Double averageRating = userMediaRepository.findAverageRatingByUserId(target.getId());
    long followersCount = followService.countFollowers(target.getId());
    long reviewsCount = userMediaRepository.countByUserIdAndNoteIsNotNull(target.getId());
    List<CollectionItemResponseDto> ongoingItems =
        collectionService.getOngoingItems(target.getId(), 6).stream()
            .map(item -> item.maskedIfAdult(adultContentAllowed))
            .toList();
    return new UserProfileResponseDto(
        target.getId(),
        target.getUsername(),
        target.getDisplayName(),
        target.getBio(),
        avatarStorageService.urlFor(target.getAvatarFilename()),
        target.getProfileBannerUrl(),
        target.getProfileBannerTitle(),
        target.getProfileBannerProvider(),
        target.getProfileBannerSourceUrl(),
        target.getProfileBannerPosition(),
        target.getProfileVisibility(),
        callerId != null
            && !target.getId().equals(callerId)
            && followService.isFollowing(callerId, target.getId()),
        target.getCreatedAt(),
        new UserProfileResponseDto.ProfileStats(
            totalItems, doneCount, averageRating, followersCount, reviewsCount),
        ongoingItems);
  }

  @Transactional(readOnly = true)
  public PagedResponseDto<PublicCollectionItemResponseDto> getCollection(
      UUID callerId, String username, CollectionFilter filter, Pageable pageable) {
    UserEntity target = requireVisible(callerId, username);
    return collectionService.getPublicCollection(target.getId(), filter, callerId, pageable);
  }

  @Transactional(readOnly = true)
  public PagedResponseDto<CommonCollectionItemResponseDto> getCommonCollection(
      UUID callerId, String username, CollectionFilter filter, Pageable pageable) {
    UserEntity target = requireVisible(callerId, username);
    if (callerId.equals(target.getId())) {
      throw new BadRequestException(
          ErrorCode.COMPARE_WITH_SELF, "You cannot compare your shelf with yourself");
    }
    return collectionService.getCommonCollection(target.getId(), callerId, filter, pageable);
  }

  @Transactional(readOnly = true)
  public ShelfCompareResponseDto compare(UUID callerId, String username) {
    UserEntity target = requireVisible(callerId, username);
    if (callerId.equals(target.getId())) {
      throw new BadRequestException(
          ErrorCode.COMPARE_WITH_SELF, "You cannot compare your shelf with yourself");
    }
    return collectionService.compareShelves(target.getId(), callerId);
  }

  @Transactional(readOnly = true)
  public CollectionStatsResponseDto getCollectionStats(UUID callerId, String username) {
    UserEntity target = requireVisible(callerId, username);
    return collectionService.getStatsByMediaType(target.getId());
  }

  @Transactional(readOnly = true)
  public List<EssentialEntryResponseDto> getEssentials(UUID callerId, String username) {
    UserEntity target = requireVisible(callerId, username);
    return essentialsService.getEssentials(
        target.getId(), viewerPreferences.allowsAdultContent(callerId));
  }

  @Transactional(readOnly = true)
  public PagedResponseDto<ReviewResponseDto> getReviews(
      UUID callerId, String username, String query, Pageable pageable) {
    UserEntity target = requireVisible(callerId, username);
    Page<UserMediaEntity> page =
        userMediaRepository.findReviewsByUser(
            target.getId(), CommunityFilter.likePattern(query), pageable);
    return new PagedResponseDto<>(
        toReviews(page.getContent(), Map.of(target.getId(), target), callerId),
        page.getNumber(),
        page.getSize(),
        page.getTotalElements());
  }

  @Transactional(readOnly = true)
  public PagedResponseDto<ReviewResponseDto> browseReviews(
      UUID viewerId, CommunityFilter filter, Pageable pageable) {
    var page = userMediaRepository.browseReviews(viewerId, filter, pageable);
    return new PagedResponseDto<>(
        toReviews(page.getContent(), authorsOf(page.getContent()), viewerId),
        page.getNumber(),
        page.getSize(),
        page.getTotalElements());
  }

  @Transactional(readOnly = true)
  public List<ReviewResponseDto> getMediaReviews(
      UUID callerId, String provider, MediaType type, String externalId) {
    return mediaRepository
        .findByExternalIdAndProviderAndMediaType(externalId, provider, type)
        .map(
            media -> {
              List<UserMediaEntity> reviews =
                  userMediaRepository.findVisibleReviewsOfMedia(
                      media.getId(), callerId, PageRequest.of(0, MEDIA_REVIEWS_LIMIT));
              return toReviews(reviews, authorsOf(reviews), callerId);
            })
        .orElse(List.of());
  }

  @Transactional(readOnly = true)
  public ReviewResponseDto getReview(UUID callerId, UUID reviewId) {
    var item = getVisibleReview(callerId, reviewId);
    return toReview(item, callerId);
  }

  @Transactional(readOnly = true)
  public List<WatchLogResponseDto> getReviewWatchLog(UUID callerId, UUID reviewId) {
    var item = getVisibleReview(callerId, reviewId);
    return watchLogService.list(item.getUserId(), item.getId());
  }

  @Transactional
  public ReviewResponseDto like(UUID callerId, UUID reviewId) {
    var item = getVisibleReview(callerId, reviewId);
    if (item.getUserId().equals(callerId)) {
      throw new ForbiddenException(ErrorCode.UNAUTHORIZED, "You cannot like your own review");
    }
    if (!reviewLikeRepository.existsByReviewIdAndUserId(reviewId, callerId)) {
      reviewLikeRepository.save(new ReviewLikeEntity(item, callerId));
      interactionPublisher.reviewLiked(callerId, item, true);
      notificationService.create(
          item.getUserId(),
          callerId,
          NotificationType.CREATION_LIKED,
          "REVIEW",
          reviewId,
          Map.of());
    }
    return toReview(item, callerId);
  }

  @Transactional
  public ReviewResponseDto unlike(UUID callerId, UUID reviewId) {
    var item = getVisibleReview(callerId, reviewId);
    if (item.getUserId().equals(callerId)) {
      throw new ForbiddenException(ErrorCode.UNAUTHORIZED, "You cannot unlike your own review");
    }
    if (reviewLikeRepository.existsByReviewIdAndUserId(reviewId, callerId)) {
      reviewLikeRepository.deleteByReviewIdAndUserId(reviewId, callerId);
      interactionPublisher.reviewLiked(callerId, item, false);
      notificationService.retract(
          item.getUserId(), callerId, NotificationType.CREATION_LIKED, "REVIEW", reviewId);
    }
    return toReview(item, callerId);
  }

  private UserMediaEntity getVisibleReview(UUID callerId, UUID reviewId) {
    var item =
        userMediaRepository
            .findById(reviewId)
            .filter(review -> review.getNote() != null)
            .orElseThrow(
                () ->
                    new ResourceNotFoundException(
                        ErrorCode.COLLECTION_ITEM_NOT_FOUND, "Review not found"));
    UserEntity author =
        userRepository
            .findById(item.getUserId())
            .orElseThrow(
                () -> new ResourceNotFoundException(ErrorCode.USER_NOT_FOUND, "User not found"));
    if (!visibilityPolicy.canViewProfile(callerId, author)) {
      throw new ResourceNotFoundException(ErrorCode.COLLECTION_ITEM_NOT_FOUND, "Review not found");
    }
    return item;
  }

  @Transactional(readOnly = true)
  public PagedResponseDto<UserActivityResponseDto> getActivity(
      UUID callerId, String username, Pageable pageable) {
    UserEntity target = requireVisible(callerId, username);
    boolean adultContentAllowed = viewerPreferences.allowsAdultContent(callerId);
    return PagedResponseDto.from(
        userActivityService
            .listForUser(target.getId(), pageable)
            .map(
                activity -> {
                  var media =
                      activity.getUserMedia() == null
                          ? null
                          : collectionService
                              .toCollectionItemResponse(activity.getUserMedia())
                              .media();
                  boolean hidden = media != null && media.isAdult() && !adultContentAllowed;
                  return new UserActivityResponseDto(
                      activity.getId(),
                      activity.getActivityType().name(),
                      hidden ? media.masked() : media,
                      hidden ? Map.of() : activity.getPayload(),
                      activity.getCreatedAt());
                }));
  }

  private ReviewResponseDto toReview(UserMediaEntity item, UUID viewerId) {
    return toReviews(List.of(item), authorsOf(List.of(item)), viewerId).getFirst();
  }

  private Map<UUID, UserEntity> authorsOf(List<UserMediaEntity> items) {
    return userRepository
        .findAllById(items.stream().map(UserMediaEntity::getUserId).distinct().toList())
        .stream()
        .collect(Collectors.toMap(UserEntity::getId, user -> user));
  }

  private List<ReviewResponseDto> toReviews(
      List<UserMediaEntity> items, Map<UUID, UserEntity> authors, UUID viewerId) {
    if (items.isEmpty()) {
      return List.of();
    }
    List<UUID> ids = items.stream().map(UserMediaEntity::getId).toList();
    Map<UUID, Long> likes = IdCount.toMap(reviewLikeRepository.countByReviewIds(ids));
    Set<UUID> liked =
        viewerId == null
            ? Set.of()
            : Set.copyOf(reviewLikeRepository.findLikedReviewIds(viewerId, ids));
    Map<UUID, List<CommentResponseDto>> comments =
        commentService.listTopByRelevance(
            CommentTargetType.REVIEW, ids, viewerId, COMMENT_PAGE_SIZE);
    Map<UUID, Long> commentCounts = commentService.count(CommentTargetType.REVIEW, ids);
    boolean adultContentAllowed = viewerPreferences.allowsAdultContent(viewerId);
    return items.stream()
        .map(
            item -> {
              UserEntity user = authors.get(item.getUserId());
              var media = collectionService.toCollectionItemResponse(item).media();
              boolean hidden = media.isAdult() && !adultContentAllowed;
              return new ReviewResponseDto(
                  item.getId(),
                  user.getId(),
                  user.getUsername(),
                  user.getDisplayName(),
                  avatarStorageService.urlFor(user.getAvatarFilename()),
                  hidden ? media.masked() : media,
                  item.getRating(),
                  hidden ? Map.of() : item.getNote(),
                  item.isContainsSpoilers(),
                  liked.contains(item.getId()),
                  likes.getOrDefault(item.getId(), 0L),
                  hidden ? List.of() : comments.getOrDefault(item.getId(), List.of()),
                  commentCounts.getOrDefault(item.getId(), 0L),
                  item.getReviewedAt() != null ? item.getReviewedAt() : item.getCreatedAt(),
                  item.getUpdatedAt());
            })
        .toList();
  }

  private UserEntity requireVisible(UUID callerId, String username) {
    UserEntity target =
        userRepository
            .findByUsernameIgnoreCase(username)
            .or(() -> callerId == null ? Optional.empty() : remoteActors.tryResolveHandle(username))
            .orElseThrow(
                () -> new ResourceNotFoundException(ErrorCode.USER_NOT_FOUND, "User not found"));
    if (!visibilityPolicy.canViewProfile(callerId, target)) {
      throw new ForbiddenException(ErrorCode.PROFILE_PRIVATE, "This profile is private");
    }
    return target;
  }
}
