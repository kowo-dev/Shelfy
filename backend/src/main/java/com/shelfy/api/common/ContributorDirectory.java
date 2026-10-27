package com.shelfy.api.common;

import com.shelfy.api.auth.AvatarStorageService;
import com.shelfy.api.auth.UserRepository;
import com.shelfy.api.common.dto.ContributorDto;
import java.util.Collection;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class ContributorDirectory {
  private final UserRepository userRepository;
  private final AvatarStorageService avatarStorageService;

  public Map<UUID, ContributorDto> resolve(Collection<UUID> userIds) {
    var ids = userIds.stream().filter(Objects::nonNull).distinct().toList();
    if (ids.isEmpty()) {
      return Map.of();
    }
    return userRepository.findAllById(ids).stream()
        .map(
            user ->
                new ContributorDto(
                    user.getId(),
                    user.getUsername(),
                    user.getDisplayName(),
                    avatarStorageService.urlFor(user.getAvatarFilename())))
        .collect(Collectors.toMap(ContributorDto::userId, Function.identity()));
  }
}
