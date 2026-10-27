package com.shelfy.api.auth;

import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class ViewerPreferences {

  private final UserRepository userRepository;

  public boolean allowsAdultContent(UUID viewerId) {
    return viewerId != null && userRepository.findAllowAdultContentById(viewerId).orElse(false);
  }
}
