package com.shelfy.api.users;

import com.shelfy.api.auth.AvatarStorageService;
import com.shelfy.api.auth.CollectionVisibility;
import com.shelfy.api.auth.UserEntity;
import com.shelfy.api.auth.UserRepository;
import com.shelfy.api.auth.UserResponseMapper;
import com.shelfy.api.auth.dto.UpdateProfileBannerRequestDto;
import com.shelfy.api.auth.dto.UpdateProfileRequestDto;
import com.shelfy.api.auth.dto.UserResponseDto;
import com.shelfy.api.collection.CollectionService;
import com.shelfy.api.collection.UserMediaRepository;
import com.shelfy.api.common.exception.BadRequestException;
import com.shelfy.api.common.exception.ConflictException;
import com.shelfy.api.common.exception.ErrorCode;
import com.shelfy.api.common.exception.ResourceNotFoundException;
import com.shelfy.api.federation.ProfilePublisher;
import java.time.Instant;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

@Service
@RequiredArgsConstructor
public class ProfileSettingsService {

  private final UserRepository userRepository;
  private final UserMediaRepository userMediaRepository;
  private final CollectionService collectionService;
  private final AvatarStorageService avatarStorageService;
  private final UserResponseMapper userResponseMapper;
  private final ProfilePublisher profilePublisher;

  @Transactional
  public UserResponseDto updateProfile(UUID userId, UpdateProfileRequestDto request) {
    UserEntity user = getUser(userId);
    if (userRepository.existsByUsernameIgnoreCaseAndDomainIsNullAndIdNot(
        request.username(), userId)) {
      throw new ConflictException(ErrorCode.USERNAME_ALREADY_IN_USE, "Username already in use");
    }
    user.setUsername(request.username());
    user.setDisplayName(blankToNull(request.displayName()));
    user.setBio(blankToNull(request.bio()));
    if (request.profileVisibility() == CollectionVisibility.LINK) {
      throw new BadRequestException(
          ErrorCode.VALIDATION_FAILED, "A profile is either public or private");
    }
    if (request.profileVisibility() != null) {
      user.setProfileVisibility(request.profileVisibility());
    }
    if (request.hasOptedOutOfFederation() != null) {
      user.setFederationOptOut(request.hasOptedOutOfFederation());
    }
    if (request.isAdultContentAllowed() != null) {
      if (request.isAdultContentAllowed() && !user.isAdultContentAllowed()) {
        if (!request.confirmAdultContent()) {
          throw new BadRequestException(
              ErrorCode.ADULT_CONTENT_CONFIRMATION_REQUIRED,
              "You must confirm you are an adult to enable adult content");
        }
        user.setAdultContentConfirmedAt(Instant.now());
      }
      user.setAdultContentAllowed(request.isAdultContentAllowed());
    }
    UserResponseDto response = userResponseMapper.toResponse(userRepository.save(user));
    profilePublisher.updated(userId);
    return response;
  }

  @Transactional
  public UserResponseDto updateProfileBanner(UUID userId, UpdateProfileBannerRequestDto request) {
    UserEntity user = getUser(userId);
    user.setProfileBannerUrl(request.bannerUrl());
    user.setProfileBannerTitle(request.title());
    user.setProfileBannerProvider(request.provider());
    user.setProfileBannerSourceUrl(request.sourceUrl());
    user.setProfileBannerPosition(request.position());
    UserResponseDto response = userResponseMapper.toResponse(userRepository.save(user));
    profilePublisher.updated(userId);
    return response;
  }

  @Transactional
  public UserResponseDto clearProfileBanner(UUID userId) {
    UserEntity user = getUser(userId);
    user.setProfileBannerUrl(null);
    user.setProfileBannerTitle(null);
    user.setProfileBannerProvider(null);
    user.setProfileBannerSourceUrl(null);
    user.setProfileBannerPosition(null);
    UserResponseDto response = userResponseMapper.toResponse(userRepository.save(user));
    profilePublisher.updated(userId);
    return response;
  }

  @Transactional
  public UserResponseDto updateAvatar(UUID userId, MultipartFile file) {
    UserEntity user = getUser(userId);
    String filename = avatarStorageService.store(userId, file);
    String previousFilename = user.getAvatarFilename();
    user.setAvatarFilename(filename);
    user.setAvatarUpdatedAt(Instant.now());
    UserResponseDto response = userResponseMapper.toResponse(userRepository.save(user));
    avatarStorageService.delete(previousFilename);
    profilePublisher.updated(userId);
    return response;
  }

  @Transactional
  public UserResponseDto removeAvatar(UUID userId) {
    UserEntity user = getUser(userId);
    String previousFilename = user.getAvatarFilename();
    user.setAvatarFilename(null);
    user.setAvatarUpdatedAt(null);
    UserResponseDto response = userResponseMapper.toResponse(userRepository.save(user));
    avatarStorageService.delete(previousFilename);
    profilePublisher.updated(userId);
    return response;
  }

  public boolean isUsernameAvailable(UUID currentUserId, String username) {
    return !userRepository.existsByUsernameIgnoreCaseAndDomainIsNullAndIdNot(
        username, currentUserId);
  }

  private String blankToNull(String value) {
    return value == null || value.isBlank() ? null : value.trim();
  }

  private UserEntity getUser(UUID userId) {
    return userRepository
        .findById(userId)
        .orElseThrow(
            () -> new ResourceNotFoundException(ErrorCode.USER_NOT_FOUND, "User not found"));
  }
}
