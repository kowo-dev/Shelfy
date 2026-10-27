package com.shelfy.api.versus;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "versus_matches")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class VersusMatchEntity {
  @Id @GeneratedValue private UUID id;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "session_id")
  private VersusSessionEntity session;

  @Column(nullable = false)
  private int round;

  @Column(name = "slot_index", nullable = false)
  private int slotIndex;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "entry_a_id")
  private VersusPoolItemEntity entryA;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "entry_b_id")
  private VersusPoolItemEntity entryB;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "winner_entry_id")
  private VersusPoolItemEntity winnerEntry;

  @Column(name = "is_bye", nullable = false)
  private boolean bye;

  @Column(name = "decided_at")
  private Instant decidedAt;

  VersusMatchEntity(
      VersusSessionEntity session,
      int round,
      int slotIndex,
      VersusPoolItemEntity entryA,
      VersusPoolItemEntity entryB) {
    this.session = session;
    this.round = round;
    this.slotIndex = slotIndex;
    this.entryA = entryA;
    this.entryB = entryB;
    if (entryB == null) {
      this.bye = true;
      this.winnerEntry = entryA;
      this.decidedAt = Instant.now();
    }
  }

  public boolean isDecided() {
    return decidedAt != null;
  }

  void undo() {
    this.winnerEntry = null;
    this.decidedAt = null;
  }

  public void decide(VersusPoolItemEntity winner) {
    this.winnerEntry = winner;
    this.decidedAt = Instant.now();
  }
}
