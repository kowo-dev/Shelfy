package com.shelfy.api.collection;

import com.shelfy.api.auth.AvatarStorageService;
import com.shelfy.api.auth.UserEntity;
import com.shelfy.api.auth.UserRepository;
import com.shelfy.api.collection.dto.EpisodeCommunityResponseDto;
import com.shelfy.api.collection.dto.EpisodeCommunityResponseDto.EpisodeAverageDto;
import com.shelfy.api.collection.dto.EpisodeCommunityResponseDto.EpisodeRatingDto;
import com.shelfy.api.collection.dto.EpisodeCommunityResponseDto.FollowedEpisodeRatingsDto;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
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
public class EpisodeCommunityService {

  private final UserMediaEpisodeRepository episodeRepository;
  private final UserRepository userRepository;
  private final AvatarStorageService avatarStorageService;

  @Transactional(readOnly = true)
  public EpisodeCommunityResponseDto get(
      UUID viewerId, String provider, MediaType mediaType, String externalId) {
    List<EpisodeAverageDto> averages =
        episodeRepository.communityAverages(viewerId, provider, mediaType, externalId).stream()
            .map(
                row ->
                    new EpisodeAverageDto(
                        row.getSeason(), row.getEpisode(), row.getAverage(), row.getVotes()))
            .sorted(
                Comparator.comparingInt(EpisodeAverageDto::season)
                    .thenComparingInt(EpisodeAverageDto::episode))
            .toList();

    Map<UUID, List<EpisodeRatingDto>> byUser = new LinkedHashMap<>();
    for (UserMediaEpisodeEntity e :
        episodeRepository.followedRatings(viewerId, provider, mediaType, externalId)) {
      byUser
          .computeIfAbsent(e.getUserMedia().getUserId(), id -> new ArrayList<>())
          .add(new EpisodeRatingDto(e.getSeason(), e.getEpisode(), e.getRating()));
    }
    Map<UUID, UserEntity> users =
        userRepository.findAllById(byUser.keySet()).stream()
            .collect(Collectors.toMap(UserEntity::getId, Function.identity()));
    List<FollowedEpisodeRatingsDto> following =
        byUser.entrySet().stream()
            .map(
                entry -> {
                  UserEntity user = users.get(entry.getKey());
                  return new FollowedEpisodeRatingsDto(
                      user.getUsername(),
                      user.getDisplayName(),
                      avatarStorageService.urlFor(user.getAvatarFilename()),
                      entry.getValue());
                })
            .toList();
    return new EpisodeCommunityResponseDto(averages, following);
  }
}
