package com.shelfy.api.feed;

import com.shelfy.api.activity.ActivityType;
import com.shelfy.api.activity.UserActivityEntity;
import com.shelfy.api.activity.UserActivityRepository;
import com.shelfy.api.auth.AvatarStorageService;
import com.shelfy.api.auth.UserEntity;
import com.shelfy.api.auth.UserRepository;
import com.shelfy.api.auth.ViewerPreferences;
import com.shelfy.api.collection.CollectionService;
import com.shelfy.api.collection.UserMediaEntity;
import com.shelfy.api.common.Paging;
import com.shelfy.api.feed.dto.FeedActorDto;
import com.shelfy.api.feed.dto.FeedItemDto;
import com.shelfy.api.feed.dto.FeedPageResponseDto;
import com.shelfy.api.feed.dto.FeedUnreadResponseDto;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class FeedService {

  static final List<ActivityType> FEED_TYPES =
      List.of(
          ActivityType.ADDED,
          ActivityType.REVIEWED,
          ActivityType.RATED,
          ActivityType.STATUS_CHANGED);

  private final UserActivityRepository activityRepository;
  private final UserRepository userRepository;
  private final AvatarStorageService avatarStorageService;
  private final CollectionService collectionService;
  private final ViewerPreferences viewerPreferences;

  @Transactional(readOnly = true)
  public FeedPageResponseDto getCircleFeed(UUID viewerId, Instant before, int size) {
    var pageable = Paging.of(0, size);
    List<UserActivityEntity> rows =
        activityRepository.findCircleFeed(
            viewerId,
            FEED_TYPES,
            before == null ? Instant.now() : before,
            Paging.of(0, pageable.getPageSize() + 1));
    boolean hasMore = rows.size() > pageable.getPageSize();
    List<UserActivityEntity> page = hasMore ? rows.subList(0, pageable.getPageSize()) : rows;
    Map<UUID, UserEntity> actors =
        userRepository
            .findAllById(page.stream().map(UserActivityEntity::getUserId).distinct().toList())
            .stream()
            .collect(Collectors.toMap(UserEntity::getId, Function.identity()));
    boolean adultContentAllowed = viewerPreferences.allowsAdultContent(viewerId);
    List<FeedItemDto> items =
        page.stream()
            .map(row -> toItem(row, actors.get(row.getUserId()), adultContentAllowed))
            .toList();
    return new FeedPageResponseDto(items, hasMore ? page.getLast().getCreatedAt() : null);
  }

  @Transactional(readOnly = true)
  public FeedUnreadResponseDto getUnread(UUID viewerId, Instant since) {
    return new FeedUnreadResponseDto(
        since == null ? 0 : activityRepository.countCircleFeedSince(viewerId, FEED_TYPES, since));
  }

  private FeedItemDto toItem(
      UserActivityEntity row, UserEntity actor, boolean adultContentAllowed) {
    UserMediaEntity item = row.getUserMedia();
    var media = item == null ? null : collectionService.toCollectionItemResponse(item).media();
    boolean hidden = media != null && media.isAdult() && !adultContentAllowed;
    boolean review =
        !hidden && row.getActivityType() == ActivityType.REVIEWED && item.getNote() != null;
    return new FeedItemDto(
        row.getId(),
        row.getActivityType().name(),
        new FeedActorDto(
            actor.getId(),
            actor.getUsername(),
            actor.getDisplayName(),
            avatarStorageService.urlFor(actor.getAvatarFilename())),
        hidden ? media.masked() : media,
        item != null && item.getNote() != null ? item.getId() : null,
        hidden ? Map.of() : row.getPayload(),
        hidden || item == null ? null : item.getRating(),
        review ? item.getNote() : null,
        review && item.isContainsSpoilers(),
        row.getCreatedAt());
  }
}
