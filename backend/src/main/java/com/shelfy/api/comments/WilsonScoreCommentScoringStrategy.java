package com.shelfy.api.comments;

import org.springframework.stereotype.Component;

@Component
public class WilsonScoreCommentScoringStrategy implements CommentScoringStrategy {
  private static final double Z = 1.96;
  private static final double SMOOTHING = 1.0;

  @Override
  public double relevanceScore(int upvotes, int downvotes) {
    double up = upvotes + SMOOTHING;
    double down = downvotes + SMOOTHING;
    double n = up + down;
    double phat = up / n;
    double z2 = Z * Z;
    double numerator = phat + z2 / (2 * n) - Z * Math.sqrt((phat * (1 - phat) + z2 / (4 * n)) / n);
    double denominator = 1 + z2 / n;
    return numerator / denominator;
  }
}
