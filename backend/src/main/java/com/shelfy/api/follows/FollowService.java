package com.shelfy.api.follows;

import com.shelfy.api.auth.AvatarStorageService;
import com.shelfy.api.auth.CollectionVisibility;
import com.shelfy.api.auth.UserEntity;
import com.shelfy.api.auth.UserRepository;
import com.shelfy.api.common.dto.PagedResponseDto;
import com.shelfy.api.common.exception.ApiException;
import com.shelfy.api.common.exception.ConflictException;
import com.shelfy.api.common.exception.ErrorCode;
import com.shelfy.api.common.exception.ForbiddenException;
import com.shelfy.api.common.exception.ResourceNotFoundException;
import com.shelfy.api.community.CommunityFilter;
import com.shelfy.api.federation.FederatedFollows;
import com.shelfy.api.federation.FederationProperties;
import com.shelfy.api.follows.dto.FollowUserResponseDto;
import com.shelfy.api.follows.dto.PopularUserResponseDto;
import com.shelfy.api.notifications.NotificationService;
import com.shelfy.api.notifications.NotificationType;
import com.shelfy.api.people.PersonCards;
import com.shelfy.api.people.VisibilityPolicy;
import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class FollowService {

  private static final Duration POPULAR_ACTIVITY_WINDOW = Duration.ofDays(30);

  private final FollowRepository followRepository;
  private final UserRepository userRepository;
  private final VisibilityPolicy visibilityPolicy;
  private final AvatarStorageService avatarStorageService;
  private final FederatedFollows federatedFollows;
  private final FederationProperties federationProperties;
  private final NotificationService notificationService;
  private final PersonCards personCards;

  @Transactional(readOnly = true)
  public PagedResponseDto<PopularUserResponseDto> listPopular(UUID viewerId, Pageable pageable) {
    Page<FollowRepository.PopularUserRow> rows =
        followRepository.findPopular(
            viewerId == null ? new UUID(0, 0) : viewerId,
            Instant.now().minus(POPULAR_ACTIVITY_WINDOW),
            pageable);
    Map<UUID, UserEntity> usersById = new HashMap<>();
    for (UserEntity user :
        userRepository.findAllById(
            rows.getContent().stream().map(FollowRepository.PopularUserRow::getId).toList())) {
      usersById.put(user.getId(), user);
    }
    Map<UUID, PersonCards.Card> cards = personCards.of(viewerId, usersById.values());
    return PagedResponseDto.from(
        rows.map(
            row -> {
              UserEntity user = usersById.get(row.getId());
              PersonCards.Card card = cards.get(user.getId());
              return new PopularUserResponseDto(
                  user.getId(),
                  user.getUsername(),
                  user.getDisplayName(),
                  avatarStorageService.urlFor(user.getAvatarFilename()),
                  row.getFollowers(),
                  card.bannerUrl(),
                  card.titleCount(),
                  card.coverUrls());
            }));
  }

  @Transactional
  public void follow(UUID followerId, UUID followedId) {
    if (followerId.equals(followedId)) {
      throw new ApiException(
          HttpStatus.BAD_REQUEST, ErrorCode.CANNOT_FOLLOW_SELF, "Cannot follow yourself");
    }
    UserEntity followed =
        userRepository
            .findById(followedId)
            .orElseThrow(
                () -> new ResourceNotFoundException(ErrorCode.USER_NOT_FOUND, "User not found"));
    if (isFollowing(followerId, followedId)) {
      throw new ConflictException(ErrorCode.ALREADY_FOLLOWING, "Already following this user");
    }
    if (followed.getDomain() == null) {
      followRepository.save(new FollowEntity(followerId, followedId));
      notificationService.create(
          followedId, followerId, NotificationType.NEW_FOLLOWER, null, null, Map.of());
      return;
    }
    requireFederation(followerId);
    federatedFollows.request(followerId, followed);
  }

  @Transactional
  public void unfollow(UUID followerId, UUID followedId) {
    UserEntity followed = userRepository.findById(followedId).orElse(null);
    if (followed != null && followed.getDomain() != null) {
      federatedFollows.cancel(followerId, followed);
      return;
    }
    followRepository.deleteById(new FollowEntity.FollowId(followerId, followedId));
    notificationService.retract(followedId, followerId, NotificationType.NEW_FOLLOWER, null, null);
  }

  @Transactional(readOnly = true)
  public boolean isFollowing(UUID followerId, UUID followedId) {
    return followRepository.existsByFollowerIdAndFollowedId(followerId, followedId)
        || federatedFollows.isPending(followerId, followedId);
  }

  @Transactional(readOnly = true)
  public long countFollowers(UUID userId) {
    return followRepository.countByFollowedId(userId);
  }

  @Transactional(readOnly = true)
  public PagedResponseDto<FollowUserResponseDto> listFollowing(
      UUID viewerId, UUID userId, Pageable pageable) {
    return toUserPage(
        viewerId, followRepository.findByFollowerId(userId, pageable), FollowEntity::getFollowedId);
  }

  @Transactional(readOnly = true)
  public PagedResponseDto<FollowUserResponseDto> listFavorites(UUID viewerId, Pageable pageable) {
    return toUserPage(
        viewerId,
        followRepository.findByFollowerIdAndFavoriteTrue(viewerId, pageable),
        FollowEntity::getFollowedId);
  }

  @Transactional
  public void setFavorite(UUID followerId, UUID followedId, boolean favorite) {
    FollowEntity follow =
        followRepository
            .findById(new FollowEntity.FollowId(followerId, followedId))
            .orElseThrow(
                () ->
                    new ResourceNotFoundException(
                        ErrorCode.NOT_FOLLOWING, "You do not follow this user"));
    follow.setFavorite(favorite);
  }

  @Transactional(readOnly = true)
  public PagedResponseDto<FollowUserResponseDto> listFollowers(
      UUID viewerId, UUID userId, String query, Pageable pageable) {
    String pattern = CommunityFilter.likePattern(query);
    return toUserPage(
        viewerId,
        pattern.isEmpty()
            ? followRepository.findByFollowedId(userId, pageable)
            : followRepository.searchFollowers(userId, pattern, pageable),
        FollowEntity::getFollowerId);
  }

  @Transactional(readOnly = true)
  public void requireVisible(UUID callerId, UUID targetId) {
    if (targetId.equals(callerId)) {
      return;
    }
    UserEntity target =
        userRepository
            .findById(targetId)
            .orElseThrow(
                () -> new ResourceNotFoundException(ErrorCode.USER_NOT_FOUND, "User not found"));
    if (!visibilityPolicy.canViewProfile(callerId, target)) {
      throw new ForbiddenException(ErrorCode.PROFILE_PRIVATE, "This profile is private");
    }
  }

  private void requireFederation(UUID followerId) {
    boolean privateProfile =
        userRepository
            .findById(followerId)
            .map(user -> user.federatedVisibility() == CollectionVisibility.PRIVATE)
            .orElse(true);
    if (!federationProperties.enabled() || privateProfile) {
      throw new ApiException(
          HttpStatus.BAD_REQUEST,
          ErrorCode.FEDERATION_UNAVAILABLE,
          "Following people on other instances needs federation and a non-private profile");
    }
  }

  private PagedResponseDto<FollowUserResponseDto> toUserPage(
      UUID viewerId, Page<FollowEntity> follows, Function<FollowEntity, UUID> userId) {
    List<UUID> userIds = follows.getContent().stream().map(userId).toList();
    Map<UUID, UserEntity> usersById = new HashMap<>();
    for (UserEntity user : userRepository.findAllById(userIds)) {
      usersById.put(user.getId(), user);
    }
    Map<UUID, PersonCards.Card> cards = personCards.of(viewerId, usersById.values());
    Set<UUID> favorites =
        viewerId == null ? Set.of() : new HashSet<>(followRepository.findFavoriteIds(viewerId));
    return PagedResponseDto.from(
        follows.map(
            follow -> {
              UserEntity user = usersById.get(userId.apply(follow));
              PersonCards.Card card = cards.get(user.getId());
              return new FollowUserResponseDto(
                  user.getId(),
                  user.getUsername(),
                  user.getDisplayName(),
                  avatarStorageService.urlFor(user.getAvatarFilename()),
                  card.bannerUrl(),
                  card.titleCount(),
                  card.coverUrls(),
                  card.followersCount(),
                  favorites.contains(user.getId()));
            }));
  }
}
