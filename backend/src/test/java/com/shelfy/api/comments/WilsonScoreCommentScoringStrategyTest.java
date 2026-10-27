package com.shelfy.api.comments;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

class WilsonScoreCommentScoringStrategyTest {

  private final WilsonScoreCommentScoringStrategy strategy =
      new WilsonScoreCommentScoringStrategy();

  @Test
  void scoreStaysBetweenZeroAndOne() {
    for (int[] votes : new int[][] {{0, 0}, {1000, 0}, {0, 1000}, {50, 50}}) {
      double score = strategy.relevanceScore(votes[0], votes[1]);
      assertTrue(score >= 0 && score <= 1, "score out of range: " + score);
    }
  }

  @Test
  void moreUpvotesRankHigher() {
    assertTrue(strategy.relevanceScore(10, 1) > strategy.relevanceScore(3, 1));
  }

  @Test
  void moreDownvotesRankLower() {
    assertTrue(strategy.relevanceScore(5, 10) < strategy.relevanceScore(5, 1));
  }

  @Test
  void sameRatioWithMoreVotesIsMoreConfident() {
    assertTrue(strategy.relevanceScore(100, 20) > strategy.relevanceScore(5, 1));
  }

  @Test
  void isDeterministic() {
    assertEquals(strategy.relevanceScore(7, 3), strategy.relevanceScore(7, 3));
  }
}
