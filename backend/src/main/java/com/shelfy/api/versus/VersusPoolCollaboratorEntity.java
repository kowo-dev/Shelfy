package com.shelfy.api.versus;

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
@Table(name = "versus_pool_collaborators")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class VersusPoolCollaboratorEntity extends CollaboratorEntity {
  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "pool_id")
  private VersusPoolEntity pool;

  VersusPoolCollaboratorEntity(VersusPoolEntity pool, UUID userId, UUID invitedBy) {
    super(userId, invitedBy);
    this.pool = pool;
  }

  @Override
  public VersusPoolEntity parent() {
    return pool;
  }
}
