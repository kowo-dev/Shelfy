package com.shelfy.api.people;

import com.shelfy.api.auth.AvatarStorageService;
import com.shelfy.api.auth.UserEntity;
import com.shelfy.api.auth.UserRepository;
import com.shelfy.api.common.dto.PagedResponseDto;
import com.shelfy.api.federation.FederationProperties;
import com.shelfy.api.federation.RemoteActorService;
import com.shelfy.api.federation.RemoteFetcher;
import com.shelfy.api.follows.FollowService;
import com.shelfy.api.people.dto.UserSearchResultResponseDto;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class PeopleService {

  private static final Logger LOG = LoggerFactory.getLogger(PeopleService.class);

  private final UserRepository userRepository;
  private final AvatarStorageService avatarStorageService;
  private final RemoteActorService remoteActors;
  private final FederationProperties federationProperties;
  private final FollowService followService;
  private final PersonCards personCards;

  @Transactional(readOnly = true)
  public PagedResponseDto<UserSearchResultResponseDto> searchUsers(
      UUID currentUserId, String query, Pageable pageable) {
    boolean anonymous = currentUserId == null;
    if (!anonymous && federationProperties.enabled()) {
      RemoteActorService.Handle.parse(query)
          .ifPresent(
              handle -> {
                try {
                  remoteActors.resolveHandle(handle.display());
                } catch (RemoteFetcher.RemoteFetchException e) {
                  LOG.info("Could not resolve {}: {}", handle.display(), e.getMessage());
                }
              });
      if (query.startsWith("@")) {
        query = query.substring(1);
      }
    }
    Page<UserEntity> page =
        userRepository.searchByUsername(
            query, anonymous ? new UUID(0, 0) : currentUserId, pageable);
    Map<UUID, PersonCards.Card> cards = personCards.of(currentUserId, page.getContent());
    return PagedResponseDto.from(
        page.map(
            user -> {
              PersonCards.Card card = cards.get(user.getId());
              return new UserSearchResultResponseDto(
                  user.getId(),
                  user.getUsername(),
                  user.getDisplayName(),
                  avatarStorageService.urlFor(user.getAvatarFilename()),
                  user.getProfileVisibility(),
                  !anonymous && followService.isFollowing(currentUserId, user.getId()),
                  card.bannerUrl(),
                  card.titleCount(),
                  card.coverUrls(),
                  card.followersCount());
            }));
  }
}
