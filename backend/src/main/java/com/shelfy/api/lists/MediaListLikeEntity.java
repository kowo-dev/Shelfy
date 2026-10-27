package com.shelfy.api.lists;

import com.shelfy.api.common.LikeEntity;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.util.UUID;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "media_list_likes")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class MediaListLikeEntity extends LikeEntity {
  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "list_id", nullable = false)
  private MediaListEntity list;

  MediaListLikeEntity(MediaListEntity list, UUID userId) {
    super(userId);
    this.list = list;
  }
}
