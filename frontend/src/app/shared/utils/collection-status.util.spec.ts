import { countsForStatuses, PROGRESS_STATUSES, statusLabelKey } from './collection-status.util';

describe('collection status util', () => {
  it('keeps the backlog out of the progress statuses, the same for every medium', () => {
    expect(PROGRESS_STATUSES).toEqual(['ongoing', 'done', 'dropped']);
  });

  it('names done with the verb of the medium, and every other status the same everywhere', () => {
    expect(statusLabelKey('done', 'movie')).toBe('collection.status_done.watched');
    expect(statusLabelKey('done', 'anime')).toBe('collection.status_done.watched');
    expect(statusLabelKey('done', 'manga')).toBe('collection.status_done.read');
    expect(statusLabelKey('done', 'game')).toBe('collection.status_done.played');
    expect(statusLabelKey('done')).toBe('collection.status.done');
    expect(statusLabelKey('done', 'podcast')).toBe('collection.status.done');
    expect(statusLabelKey('ongoing', 'game')).toBe('collection.status.ongoing');
  });

  it('counts each media type over the given statuses only', () => {
    expect(
      countsForStatuses({ movie: { planned: 4, done: 2 }, game: { ongoing: 1, planned: 3 } }, [
        'ongoing',
        'done',
      ]),
    ).toEqual({ movie: 2, game: 1 });
  });
});
