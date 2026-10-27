package com.shelfy.api.versus;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "versus_sessions")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class VersusSessionEntity {
  @Id @GeneratedValue private UUID id;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "pool_id")
  private VersusPoolEntity pool;

  @Column(name = "user_id", nullable = false)
  private UUID userId;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false)
  private VersusSessionStatus status;

  @Column(name = "bracket_size", nullable = false)
  private int bracketSize;

  @Column(name = "rounds_total", nullable = false)
  private int roundsTotal;

  @Column(name = "current_round", nullable = false)
  private int currentRound;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "winner_entry_id")
  private VersusPoolItemEntity winnerEntry;

  @OneToMany(mappedBy = "session", cascade = CascadeType.ALL, orphanRemoval = true)
  private List<VersusMatchEntity> matches = new ArrayList<>();

  @Column(name = "created_at", nullable = false, updatable = false)
  private Instant createdAt;

  @Column(name = "completed_at")
  private Instant completedAt;

  public VersusSessionEntity(VersusPoolEntity pool, UUID userId, int bracketSize, int roundsTotal) {
    this.pool = pool;
    this.userId = userId;
    this.status = VersusSessionStatus.IN_PROGRESS;
    this.bracketSize = bracketSize;
    this.roundsTotal = roundsTotal;
    this.currentRound = 1;
  }

  public VersusMatchEntity addMatch(
      int round, int slotIndex, VersusPoolItemEntity entryA, VersusPoolItemEntity entryB) {
    VersusMatchEntity match = new VersusMatchEntity(this, round, slotIndex, entryA, entryB);
    matches.add(match);
    return match;
  }

  public void advanceToRound(int round) {
    this.currentRound = round;
  }

  void reopen() {
    this.status = VersusSessionStatus.IN_PROGRESS;
    this.winnerEntry = null;
    this.completedAt = null;
  }

  void dropRound(int round) {
    matches.removeIf(match -> match.getRound() == round);
  }

  public void complete(VersusPoolItemEntity winnerEntry) {
    this.status = VersusSessionStatus.COMPLETED;
    this.winnerEntry = winnerEntry;
    this.completedAt = Instant.now();
  }

  @PrePersist
  void created() {
    createdAt = Instant.now();
  }
}
