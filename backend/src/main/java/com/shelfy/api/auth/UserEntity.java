package com.shelfy.api.auth;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "users")
@Getter
@Setter
// Public: federation builds remote users, which have no email or password.
@NoArgsConstructor
public class UserEntity {

  @Id @GeneratedValue private UUID id;

  private String email;

  @Column(nullable = false)
  private String username;

  private String domain;

  @Column(name = "password_hash")
  private String passwordHash;

  @Column(name = "email_verified", nullable = false)
  private boolean emailVerified = false;

  @Column(name = "display_name")
  private String displayName;

  @Column(name = "bio")
  private String bio;

  @Column(name = "profile_banner_url")
  private String profileBannerUrl;

  @Column(name = "profile_banner_title")
  private String profileBannerTitle;

  @Column(name = "profile_banner_provider")
  private String profileBannerProvider;

  @Column(name = "profile_banner_source_url")
  private String profileBannerSourceUrl;

  @Column(name = "profile_banner_position")
  private Integer profileBannerPosition;

  @Column(name = "avatar_filename")
  private String avatarFilename;

  @Column(name = "avatar_updated_at")
  private Instant avatarUpdatedAt;

  @Enumerated(EnumType.STRING)
  @Column(name = "profile_visibility", nullable = false)
  private CollectionVisibility profileVisibility = CollectionVisibility.PUBLIC;

  @Column(name = "moved_to")
  private String movedTo;

  @Column(name = "also_known_as")
  private String alsoKnownAs;

  @Column(name = "federation_opt_out", nullable = false)
  private boolean federationOptOut = false;

  @Column(name = "allow_adult_content", nullable = false)
  private boolean adultContentAllowed = false;

  @Column(name = "adult_content_confirmed_at")
  private Instant adultContentConfirmedAt;

  @Column(name = "steam_id")
  private String steamId;

  @Column(name = "steam_display_name")
  private String steamDisplayName;

  @Column(name = "steam_avatar_url")
  private String steamAvatarUrl;

  @Column(name = "steam_connected_at")
  private Instant steamConnectedAt;

  @Column(name = "created_at", nullable = false, updatable = false)
  private Instant createdAt;

  @Column(name = "updated_at", nullable = false)
  private Instant updatedAt;

  public UserEntity(String email, String username, String passwordHash) {
    this.email = email;
    this.username = username;
    this.passwordHash = passwordHash;
  }

  @PrePersist
  void onCreate() {
    Instant now = Instant.now();
    createdAt = now;
    updatedAt = now;
  }

  @PreUpdate
  void onUpdate() {
    updatedAt = Instant.now();
  }

  public CollectionVisibility federatedVisibility() {
    return federationOptOut ? CollectionVisibility.PRIVATE : profileVisibility;
  }
}
