import { describe, expect, it } from 'vitest';

import { displayScore, isLowVoted, netScore } from './comment-score';

describe('comment-score utils', () => {
  describe('netScore', () => {
    it('subtracts downvotes from upvotes', () => {
      expect(netScore(5, 2)).toBe(3);
      expect(netScore(0, 0)).toBe(0);
      expect(netScore(1, 5)).toBe(-4);
    });
  });

  describe('displayScore', () => {
    it('returns the score as a string when positive', () => {
      expect(displayScore(5, 2)).toBe('3');
      expect(displayScore(1, 0)).toBe('1');
    });

    it('returns null when the score is zero or negative', () => {
      expect(displayScore(0, 0)).toBeNull();
      expect(displayScore(1, 5)).toBeNull();
    });
  });

  describe('isLowVoted', () => {
    it('is true when net score is at or below the threshold', () => {
      expect(isLowVoted(0, 5, -5)).toBe(true);
      expect(isLowVoted(1, 5, -5)).toBe(false);
    });

    it('is false for a positive score above the threshold', () => {
      expect(isLowVoted(10, 0, -5)).toBe(false);
    });
  });
});
