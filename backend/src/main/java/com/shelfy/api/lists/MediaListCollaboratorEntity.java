package com.shelfy.api.lists;

import com.shelfy.api.collaboration.CollaboratorEntity;
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
@Table(name = "media_list_collaborators")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class MediaListCollaboratorEntity extends CollaboratorEntity {
  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "list_id")
  private MediaListEntity list;

  MediaListCollaboratorEntity(MediaListEntity list, UUID userId, UUID invitedBy) {
    super(userId, invitedBy);
    this.list = list;
  }

  @Override
  public MediaListEntity parent() {
    return list;
  }
}
