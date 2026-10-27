package com.shelfy.api.collection;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "user_media_episode")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class UserMediaEpisodeEntity {

  @Id @GeneratedValue private UUID id;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "user_media_id", nullable = false)
  private UserMediaEntity userMedia;

  @Column(nullable = false)
  private int season;

  @Column(nullable = false)
  private int episode;

  @Column(name = "watched_at", nullable = false, updatable = false)
  private Instant watchedAt;

  @Setter @Column private Integer rating;

  public UserMediaEpisodeEntity(UserMediaEntity userMedia, int season, int episode) {
    this.userMedia = userMedia;
    this.season = season;
    this.episode = episode;
  }

  @PrePersist
  void onCreate() {
    watchedAt = Instant.now();
  }
}
