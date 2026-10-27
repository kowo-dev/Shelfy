import { statusAfterRating } from './rating-status.util';

describe('statusAfterRating', () => {
  it('marks a title I had not seen yet as done once I rate it', () => {
    expect(statusAfterRating(null, 8)).toBe('done');
    expect(statusAfterRating('planned', 8)).toBe('done');
  });

  it('leaves a title I am on, dropped or done where it is', () => {
    expect(statusAfterRating('ongoing', 8)).toBeNull();
    expect(statusAfterRating('dropped', 4)).toBeNull();
    expect(statusAfterRating('done', 6)).toBeNull();
  });

  it('never moves the status when the rating is cleared', () => {
    expect(statusAfterRating('planned', null)).toBeNull();
    expect(statusAfterRating(null, null)).toBeNull();
  });
});
