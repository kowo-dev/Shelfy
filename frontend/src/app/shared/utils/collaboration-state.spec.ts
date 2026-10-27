import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { vi, type Mock } from 'vitest';
import { ErrorMessageService } from '@app/core/services/error-message/error-message';
import { FollowsService, type FollowUserResponse } from '@app/core/services/follows/follows';
import { ToastService } from '@app/core/services/toast/toast';
import { TranslateService } from '@app/core/services/translate/translate';
import {
  createCollaborationState,
  type CollaborationApi,
  type CollaborationTarget,
} from './collaboration-state';

const member = (userId: string) => ({ userId, username: userId }) as never;
const follower = (id: string) => ({ id, username: id }) as FollowUserResponse;

describe('createCollaborationState', () => {
  const target = signal<CollaborationTarget | null>(null);
  const viewerId = signal<string | null>('owner');
  let api: { [K in keyof CollaborationApi]: ReturnType<typeof vi.fn> };
  let toast: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };
  let follows: { followers: ReturnType<typeof vi.fn> };
  let changed: Mock<() => void>;
  let gone: Mock<() => void>;

  function setup() {
    api = {
      invite: vi.fn().mockReturnValue(of(null)),
      accept: vi.fn().mockReturnValue(of(null)),
      decline: vi.fn().mockReturnValue(of(null)),
      remove: vi.fn().mockReturnValue(of(null)),
    };
    toast = { success: vi.fn(), error: vi.fn() };
    follows = {
      followers: vi
        .fn()
        .mockReturnValue(
          of({ content: [follower('a'), follower('b'), follower('c'), follower('owner')] }),
        ),
    };
    changed = vi.fn<() => void>();
    gone = vi.fn<() => void>();
    target.set({
      id: 'l1',
      userId: 'owner',
      collaborators: [member('a')],
      pendingInvites: [member('b')],
    });
    TestBed.configureTestingModule({
      providers: [
        { provide: FollowsService, useValue: follows },
        { provide: ToastService, useValue: toast },
        { provide: ErrorMessageService, useValue: { fromApiError: () => 'failed' } },
        { provide: TranslateService, useValue: { get: (key: string) => key } },
      ],
    });
    return TestBed.runInInjectionContext(() =>
      createCollaborationState({ target, viewerId, api: api as never, changed, gone }),
    );
  }

  it('offers only followers who are not already in or invited', () => {
    const state = setup();

    state.show();

    expect(state.open()).toBe(true);
    expect(state.candidates().map((f) => f.id)).toEqual(['c']);
  });

  it('asks the server for matching followers once the typing settles', () => {
    vi.useFakeTimers();
    const state = setup();
    state.show();
    follows.followers.mockReturnValue(of({ content: [follower('margot')] }));

    state.search(' mar');
    state.search(' marg ');
    vi.advanceTimersByTime(250);
    vi.useRealTimers();

    expect(follows.followers).toHaveBeenCalledTimes(2);
    expect(follows.followers).toHaveBeenLastCalledWith(0, 50, 'marg');
    expect(state.candidates().map((f) => f.id)).toEqual(['margot']);
  });

  it('does not load followers for someone who is not the owner', () => {
    viewerId.set('visitor');
    const state = setup();
    viewerId.set('visitor');

    state.show();

    expect(follows.followers).not.toHaveBeenCalled();
    viewerId.set('owner');
  });

  it('invites a follower, removes them from the candidates and announces the change', () => {
    const state = setup();
    state.show();

    state.invite(follower('c'));

    expect(api.invite).toHaveBeenCalledWith('l1', 'c');
    expect(toast.success).toHaveBeenCalledWith('lists.collab.invite_sent');
    expect(state.candidates()).toEqual([]);
    expect(changed).toHaveBeenCalled();
    expect(state.busyUserId()).toBeNull();
  });

  it('refuses a second action while one is running', () => {
    const state = setup();
    api.remove.mockReturnValue(new Subject());

    state.remove('a');
    state.remove('b');

    expect(api.remove).toHaveBeenCalledTimes(1);
    expect(state.busyUserId()).toBe('a');
  });

  it('reports a failure without announcing a change, and frees the lock', () => {
    const state = setup();
    api.remove.mockReturnValue(throwError(() => new Error('boom')));

    state.remove('a');

    expect(toast.error).toHaveBeenCalledWith('failed');
    expect(changed).not.toHaveBeenCalled();
    expect(state.busyUserId()).toBeNull();
  });

  it('cancels an invite with its own message', () => {
    const state = setup();

    state.cancelInvite('b');

    expect(api.remove).toHaveBeenCalledWith('l1', 'b');
    expect(toast.success).toHaveBeenCalledWith('lists.collab.invite_cancelled');
  });

  it('accepting keeps the page, declining and leaving send the user away', () => {
    const state = setup();

    state.accept();
    expect(changed).toHaveBeenCalledTimes(1);
    expect(gone).not.toHaveBeenCalled();

    state.decline();
    state.leave();
    expect(gone).toHaveBeenCalledTimes(2);
    expect(api.remove).toHaveBeenCalledWith('l1', 'owner');
  });

  it('does nothing without a target', () => {
    const state = setup();
    target.set(null);

    state.accept();
    state.invite(follower('c'));
    state.leave();

    expect(api.accept).not.toHaveBeenCalled();
    expect(api.invite).not.toHaveBeenCalled();
    expect(api.remove).not.toHaveBeenCalled();
  });
});
