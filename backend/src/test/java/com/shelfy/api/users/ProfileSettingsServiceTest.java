package com.shelfy.api.users;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.shelfy.api.auth.AvatarStorageService;
import com.shelfy.api.auth.CollectionVisibility;
import com.shelfy.api.auth.EmailChangeTokenRepository;
import com.shelfy.api.auth.EmailVerificationProperties;
import com.shelfy.api.auth.UserEntity;
import com.shelfy.api.auth.UserRepository;
import com.shelfy.api.auth.UserResponseMapper;
import com.shelfy.api.auth.dto.UpdateProfileRequestDto;
import com.shelfy.api.collection.CollectionService;
import com.shelfy.api.collection.UserMediaRepository;
import com.shelfy.api.common.exception.BadRequestException;
import com.shelfy.api.federation.FederationProperties;
import com.shelfy.api.federation.ProfilePublisher;
import com.shelfy.api.steam.SteamProperties;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class ProfileSettingsServiceTest {

  private final UserRepository userRepository = mock(UserRepository.class);
  private final ProfilePublisher profilePublisher = mock(ProfilePublisher.class);
  private final ProfileSettingsService service =
      new ProfileSettingsService(
          userRepository,
          mock(UserMediaRepository.class),
          mock(CollectionService.class),
          mock(AvatarStorageService.class),
          new UserResponseMapper(
              mock(EmailChangeTokenRepository.class),
              mock(AvatarStorageService.class),
              new SteamProperties(null, null, null, null, null, null),
              new FederationProperties(false, null, null, null, false, List.of(), false),
              new EmailVerificationProperties(1_440, null, true)),
          profilePublisher);

  @Test
  void updateProfile_withoutPrivacyFields_keepsVisibilityAndAdultSetting() {
    UserEntity user = user();
    user.setProfileVisibility(CollectionVisibility.PRIVATE);
    user.setAdultContentAllowed(true);
    when(userRepository.findById(user.getId())).thenReturn(Optional.of(user));
    when(userRepository.save(user)).thenReturn(user);

    service.updateProfile(
        user.getId(),
        new UpdateProfileRequestDto("person", "Person", null, null, null, false, null));

    assertEquals(CollectionVisibility.PRIVATE, user.getProfileVisibility());
    assertTrue(user.isAdultContentAllowed());
  }

  @Test
  void updateProfile_savesTheFederationOptOutOnlyWhenSent() {
    UserEntity user = user();
    when(userRepository.findById(user.getId())).thenReturn(Optional.of(user));
    when(userRepository.save(user)).thenReturn(user);

    service.updateProfile(
        user.getId(), new UpdateProfileRequestDto("person", null, null, null, null, false, true));
    assertTrue(user.isFederationOptOut());

    service.updateProfile(
        user.getId(), new UpdateProfileRequestDto("person", null, null, null, null, false, null));
    assertTrue(user.isFederationOptOut());
  }

  @Test
  void bannerChanges_tellOtherServers() {
    UserEntity user = user();
    when(userRepository.findById(user.getId())).thenReturn(Optional.of(user));
    when(userRepository.save(user)).thenReturn(user);

    service.clearProfileBanner(user.getId());

    verify(profilePublisher).updated(user.getId());
  }

  @Test
  void updateProfile_enablingAdultContentWithoutConfirmation_isRejected() {
    UserEntity user = user();
    when(userRepository.findById(user.getId())).thenReturn(Optional.of(user));

    assertThrows(
        BadRequestException.class,
        () ->
            service.updateProfile(
                user.getId(),
                new UpdateProfileRequestDto("person", null, null, null, true, false, null)));
    assertFalse(user.isAdultContentAllowed());
  }

  private UserEntity user() {
    UserEntity user = new UserEntity("person@example.com", "person", "password-hash");
    user.setId(UUID.randomUUID());
    return user;
  }
}
