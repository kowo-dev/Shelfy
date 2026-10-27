package com.shelfy.api.versus;

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
@Table(name = "versus_pool_likes")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class VersusPoolLikeEntity extends LikeEntity {
  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "pool_id", nullable = false)
  private VersusPoolEntity pool;

  VersusPoolLikeEntity(VersusPoolEntity pool, UUID userId) {
    super(userId);
    this.pool = pool;
  }
}
