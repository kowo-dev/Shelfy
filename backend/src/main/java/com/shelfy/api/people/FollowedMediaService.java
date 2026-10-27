package com.shelfy.api.people;

import com.shelfy.api.auth.AvatarStorageService;
import com.shelfy.api.auth.UserEntity;
import com.shelfy.api.auth.UserRepository;
import com.shelfy.api.collection.MediaType;
import com.shelfy.api.collection.UserMediaEntity;
import com.shelfy.api.collection.UserMediaRepository;
import com.shelfy.api.collection.WatchLogRepository;
import com.shelfy.api.people.dto.FollowedMediaResponseDto;
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
public class FollowedMediaService {

  private final UserMediaRepository userMediaRepository;
  private final WatchLogRepository watchLogRepository;
  private final UserRepository userRepository;
  private final AvatarStorageService avatarStorageService;

  @Transactional(readOnly = true)
  public List<FollowedMediaResponseDto> getFollowedOnMedia(
      UUID viewerId, String provider, MediaType mediaType, String externalId) {
    List<UserMediaEntity> items =
        userMediaRepository.findFollowedItemsOnMedia(viewerId, provider, mediaType, externalId);
    if (items.isEmpty()) {
      return List.of();
    }
    Map<UUID, UserEntity> usersById =
        userRepository
            .findAllById(items.stream().map(UserMediaEntity::getUserId).distinct().toList())
            .stream()
            .collect(Collectors.toMap(UserEntity::getId, Function.identity()));
    Map<UUID, Long> viewCounts =
        watchLogRepository
            .countByUserMediaIds(items.stream().map(UserMediaEntity::getId).toList())
            .stream()
            .collect(Collectors.toMap(row -> (UUID) row[0], row -> (Long) row[1]));
    return items.stream()
        .map(
            item -> {
              UserEntity user = usersById.get(item.getUserId());
              return new FollowedMediaResponseDto(
                  user.getUsername(),
                  user.getDisplayName(),
                  avatarStorageService.urlFor(user.getAvatarFilename()),
                  item.getStatus(),
                  item.getRating(),
                  viewCounts.getOrDefault(item.getId(), 0L),
                  item.getUpdatedAt());
            })
        .toList();
  }
}
