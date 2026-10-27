package com.shelfy.api.people;

import com.shelfy.api.auth.UserEntity;
import com.shelfy.api.auth.ViewerPreferences;
import com.shelfy.api.collection.UserMediaRepository;
import com.shelfy.api.common.IdCount;
import com.shelfy.api.follows.FollowRepository;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class PersonCards {

  public static final int COVERS_PER_PERSON = 3;

  public record Card(
      String bannerUrl, Long titleCount, List<String> coverUrls, Long followersCount) {
    public static final Card HIDDEN = new Card(null, null, List.of(), null);
  }

  private final VisibilityPolicy visibilityPolicy;
  private final UserMediaRepository userMediaRepository;
  private final ViewerPreferences viewerPreferences;
  private final FollowRepository followRepository;

  public Map<UUID, Card> of(UUID viewerId, Collection<UserEntity> people) {
    List<UserEntity> visible =
        people.stream()
            .filter(person -> visibilityPolicy.canViewProfile(viewerId, person))
            .toList();
    Map<UUID, Card> cards = new HashMap<>();
    for (UserEntity person : people) {
      cards.put(person.getId(), Card.HIDDEN);
    }
    if (visible.isEmpty()) {
      return cards;
    }
    List<UUID> ids = visible.stream().map(UserEntity::getId).toList();
    Map<UUID, Long> counts = IdCount.toMap(userMediaRepository.countByUserIds(ids));
    Map<UUID, Long> followers = IdCount.toMap(followRepository.countFollowersByIds(ids));
    Map<UUID, List<String>> covers = new HashMap<>();
    for (UserMediaRepository.LatestCover cover :
        userMediaRepository.findLatestCovers(
            ids, COVERS_PER_PERSON, viewerPreferences.allowsAdultContent(viewerId))) {
      covers.computeIfAbsent(cover.getUserId(), id -> new ArrayList<>()).add(cover.getCoverUrl());
    }
    for (UserEntity person : visible) {
      cards.put(
          person.getId(),
          new Card(
              person.getProfileBannerUrl(),
              counts.getOrDefault(person.getId(), 0L),
              covers.getOrDefault(person.getId(), List.of()),
              followers.getOrDefault(person.getId(), 0L)));
    }
    return cards;
  }
}
