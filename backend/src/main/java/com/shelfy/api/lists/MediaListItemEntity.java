package com.shelfy.api.lists;

import com.shelfy.api.collection.MediaEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.util.UUID;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "media_list_items")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class MediaListItemEntity {
  @Id @GeneratedValue private UUID id;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "list_id")
  private MediaListEntity list;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "media_id")
  private MediaEntity media;

  private int position;

  @Column(name = "added_by")
  private UUID addedBy;

  MediaListItemEntity(MediaListEntity list, MediaEntity media, int position, UUID addedBy) {
    this.list = list;
    this.media = media;
    this.position = position;
    this.addedBy = addedBy;
  }

  void moveTo(int position) {
    this.position = position;
  }
}
