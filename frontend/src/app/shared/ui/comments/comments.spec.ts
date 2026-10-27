import { of, Subject, throwError } from 'rxjs';
import { vi } from 'vitest';

import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from '@app/core/services/auth/auth';
import { ToastService } from '@app/core/services/toast/toast';
import { ErrorMessageService } from '@app/core/services/error-message/error-message';
import { DateFormatService } from '@app/core/services/date-format/date-format';
import { TranslateService } from '@app/core/services/translate/translate';
import { PeopleService } from '@app/core/services/people/people';
import { ApiError } from '@app/core/errors/api-error';

import { CommentsComponent } from './comments';
import type { CommentItem, CommentsSource } from './comments.model';

function comment(overrides: Partial<CommentItem> = {}): CommentItem {
  return {
    id: 'c1',
    authorId: 'u1',
    authorUsername: 'kowo',
    authorAvatarUrl: null,
    content: 'Hello world',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: null,
    upvotes: 0,
    downvotes: 0,
    myVote: null,
    parentCommentId: null,
    isDeleted: false,
    replies: [],
    ...overrides,
  };
}

function createSource(overrides: Partial<CommentsSource> = {}): CommentsSource {
  return {
    list: vi.fn().mockReturnValue(of({ content: [], page: 0, size: 20, totalElements: 0 })),
    add: vi.fn().mockReturnValue(of(comment())),
    update: vi.fn().mockReturnValue(of(comment())),
    remove: vi.fn().mockReturnValue(of(undefined)),
    vote: vi.fn().mockReturnValue(of(comment())),
    removeVote: vi.fn().mockReturnValue(of(comment())),
    ...overrides,
  };
}

describe('CommentsComponent', () => {
  let toastError: ReturnType<typeof vi.fn>;
  let toastSuccess: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    toastError = vi.fn();
    toastSuccess = vi.fn();

    await TestBed.configureTestingModule({
      imports: [CommentsComponent],
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: { currentUser: () => ({ id: 'u1' }), isAuthenticated: () => true },
        },
        { provide: ToastService, useValue: { error: toastError, success: toastSuccess } },
        {
          provide: ErrorMessageService,
          useValue: { fromApiError: (e: unknown) => (e instanceof Error ? e.message : 'error') },
        },
        {
          provide: DateFormatService,
          useValue: { formatDateTime: () => '2024-01-01', formatRelative: () => '2 days ago' },
        },
        { provide: TranslateService, useValue: { get: (key: string) => key, lang: () => 'en' } },
        {
          provide: PeopleService,
          useValue: { search: vi.fn().mockReturnValue(of({ content: [] })) },
        },
      ],
    }).compileComponents();
  });

  function createComponent(source: CommentsSource, initialItems: CommentItem[] = []) {
    const fixture = TestBed.createComponent(CommentsComponent);
    fixture.componentRef.setInput('source', source);
    fixture.componentRef.setInput('initialItems', initialItems);
    fixture.componentRef.setInput('initialTotal', initialItems.length);
    fixture.detectChanges();
    return fixture;
  }

  it('shows the empty state when there are no comments', () => {
    const fixture = createComponent(createSource(), []);
    expect(fixture.nativeElement.textContent).toContain('comments.empty');
  });

  it('renders initial comments passed in as input', () => {
    const fixture = createComponent(createSource(), [comment({ id: 'c1', content: 'First' })]);
    const articles = fixture.nativeElement.querySelectorAll('article');
    expect(articles.length).toBe(1);
    expect(fixture.nativeElement.textContent).toContain('First');
  });

  it('isMine() is true only for the current user own comment', () => {
    const fixture = createComponent(createSource());
    const component = fixture.componentInstance;
    expect(component.isMine(comment({ authorId: 'u1' }))).toBe(true);
    expect(component.isMine(comment({ authorId: 'other' }))).toBe(false);
  });

  it('canVote() is false for own comments and when logged out', () => {
    const fixture = createComponent(createSource());
    const component = fixture.componentInstance;
    expect(component.canVote(comment({ authorId: 'u1' }))).toBe(false);
    expect(component.canVote(comment({ authorId: 'other' }))).toBe(true);
  });

  it('addComment() posts the trimmed value and prepends the new comment', () => {
    const added = comment({ id: 'new', content: 'New comment' });
    const source = createSource({ add: vi.fn().mockReturnValue(of(added)) });
    const fixture = createComponent(source, [comment({ id: 'c1' })]);
    const component = fixture.componentInstance;

    component.commentControl.setValue('  New comment  ');
    component.addComment();

    expect(source.add).toHaveBeenCalledWith('New comment');
    expect(component.comments()[0]).toEqual(added);
    expect(component.total()).toBe(2);
    expect(component.commentControl.value).toBe('');
  });

  it('addComment() does nothing while the control is invalid', () => {
    const source = createSource();
    const fixture = createComponent(source);
    const component = fixture.componentInstance;

    component.commentControl.setValue('');
    component.addComment();

    expect(source.add).not.toHaveBeenCalled();
  });

  it('addComment() surfaces an error toast on failure', () => {
    const source = createSource({
      add: vi.fn().mockReturnValue(throwError(() => new Error('nope'))),
    });
    const fixture = createComponent(source);
    const component = fixture.componentInstance;

    component.commentControl.setValue('hi');
    component.addComment();

    expect(toastError).toHaveBeenCalledWith('nope');
    expect(component.posting()).toBe(false);
  });

  it('vote() optimistically updates counts and sends the request', () => {
    const updated = comment({ id: 'c1', upvotes: 1, downvotes: 0, myVote: 1 });
    const source = createSource({ vote: vi.fn().mockReturnValue(of(updated)) });
    const fixture = createComponent(source, [comment({ id: 'c1', authorId: 'other' })]);
    const component = fixture.componentInstance;

    component.vote(comment({ id: 'c1', authorId: 'other' }), 1);

    expect(source.vote).toHaveBeenCalledWith('c1', 1);
    expect(component.comments()[0].myVote).toBe(1);
  });

  it('vote() does nothing when the user cannot vote', () => {
    const source = createSource();
    const fixture = createComponent(source, [comment({ id: 'c1', authorId: 'u1' })]);
    const component = fixture.componentInstance;

    component.vote(comment({ id: 'c1', authorId: 'u1' }), 1);

    expect(source.vote).not.toHaveBeenCalled();
  });

  it('vote() on a 429 error triggers a shake instead of a toast', () => {
    const error = new ApiError(429, 'RATE_LIMITED', 'Too many requests');
    const source = createSource({ vote: vi.fn().mockReturnValue(throwError(() => error)) });
    const fixture = createComponent(source, [comment({ id: 'c1', authorId: 'other' })]);
    const component = fixture.componentInstance;

    component.vote(comment({ id: 'c1', authorId: 'other' }), 1);

    expect(toastError).not.toHaveBeenCalled();
    expect(component.voteShake()).toEqual({ commentId: 'c1', value: 1 });
  });

  it('startEdit()/cancelEdit() toggle the editing state and populate the control', () => {
    const fixture = createComponent(createSource());
    const component = fixture.componentInstance;
    const target = comment({ id: 'c1', content: 'Edit me' });

    component.startEdit(target);
    expect(component.editingId()).toBe('c1');
    expect(component.editControl.value).toBe('Edit me');

    component.cancelEdit();
    expect(component.editingId()).toBeNull();
    expect(component.editControl.value).toBe('');
  });

  it('saveEdit() updates the comment list on success', () => {
    const updated = comment({ id: 'c1', content: 'Updated' });
    const source = createSource({ update: vi.fn().mockReturnValue(of(updated)) });
    const fixture = createComponent(source, [comment({ id: 'c1', content: 'Old' })]);
    const component = fixture.componentInstance;

    component.startEdit(comment({ id: 'c1', content: 'Old' }));
    component.editControl.setValue('Updated');
    component.saveEdit(comment({ id: 'c1', content: 'Old' }));

    expect(source.update).toHaveBeenCalledWith('c1', 'Updated');
    expect(component.comments()[0].content).toBe('Updated');
    expect(component.editingId()).toBeNull();
  });

  it('requestDelete()/cancelDelete() toggle the confirmation state', () => {
    const fixture = createComponent(createSource());
    const component = fixture.componentInstance;
    const target = comment({ id: 'c1' });

    component.requestDelete(target);
    expect(component.confirmingDeleteId()).toBe('c1');

    component.cancelDelete();
    expect(component.confirmingDeleteId()).toBeNull();
  });

  it('confirmDelete() removes the comment and decrements total', () => {
    const source = createSource({ remove: vi.fn().mockReturnValue(of(undefined)) });
    const fixture = createComponent(source, [comment({ id: 'c1' })]);
    const component = fixture.componentInstance;

    component.confirmDelete(comment({ id: 'c1' }));

    expect(source.remove).toHaveBeenCalledWith('c1');
    expect(component.comments()).toEqual([]);
    expect(component.total()).toBe(0);
    expect(toastSuccess).toHaveBeenCalled();
  });

  it('renders replies nested under their parent', () => {
    const tree = comment({ id: 'c1', replies: [comment({ id: 'c2', content: 'Nested reply' })] });
    const fixture = createComponent(createSource(), [tree]);

    const nested = fixture.nativeElement.querySelector('article ul article');
    expect(nested?.textContent).toContain('Nested reply');
  });

  it('submitReply() posts with the parent id and inserts the reply under it', () => {
    const reply = comment({ id: 'r1', content: 'A reply', parentCommentId: 'c2' });
    const source = createSource({ add: vi.fn().mockReturnValue(of(reply)) });
    const parent = comment({ id: 'c2' });
    const fixture = createComponent(source, [comment({ id: 'c1', replies: [parent] })]);
    const component = fixture.componentInstance;

    component.startReply(parent);
    component.replyControl.setValue('  A reply  ');
    component.submitReply(parent);

    expect(source.add).toHaveBeenCalledWith('A reply', 'c2');
    expect(component.comments()[0].replies[0].replies).toEqual([reply]);
    expect(component.total()).toBe(2);
    expect(component.replyingToId()).toBeNull();
  });

  it('confirmDelete() keeps a placeholder when the comment has replies', () => {
    const target = comment({ id: 'c1', replies: [comment({ id: 'c2' })] });
    const fixture = createComponent(createSource(), [target]);
    const component = fixture.componentInstance;
    fixture.componentRef.setInput('initialTotal', 2);

    component.confirmDelete(target);

    const placeholder = component.comments()[0];
    expect(placeholder.isDeleted).toBe(true);
    expect(placeholder.authorUsername).toBeNull();
    expect(placeholder.replies.map((c) => c.id)).toEqual(['c2']);
  });

  it('toggleCollapsed() hides a thread and low-voted comments start collapsed', () => {
    const fixture = createComponent(createSource());
    const component = fixture.componentInstance;
    const thread = comment({ id: 'c1', replies: [comment({ id: 'c2' })] });
    const buried = comment({ id: 'c3', downvotes: 9 });

    expect(component.isCollapsed(thread)).toBe(false);
    component.toggleCollapsed('c1');
    expect(component.isCollapsed(thread)).toBe(true);
    expect(component.isCollapsed(buried)).toBe(true);
    component.toggleCollapsed('c3');
    expect(component.isCollapsed(buried)).toBe(false);
  });

  it('counts nested replies when deciding whether more roots remain', () => {
    const fixture = createComponent(createSource(), [
      comment({ id: 'c1', replies: [comment({ id: 'c2' })] }),
    ]);
    const component = fixture.componentInstance;

    component.total.set(2);
    expect(component.hasMore()).toBe(false);
    component.total.set(3);
    expect(component.hasMore()).toBe(true);
  });

  it('renders every level of a deep thread and marks replies past the indent cap', () => {
    let chain: CommentItem | null = null;
    for (let level = 20; level >= 1; level--) {
      chain = comment({
        id: `d${level}`,
        authorUsername: `user${level}`,
        content: `Level ${level}`,
        replies: chain ? [chain] : [],
      });
    }
    const fixture = createComponent(createSource(), [chain!]);
    const component = fixture.componentInstance;

    expect(fixture.nativeElement.querySelectorAll('article').length).toBe(20);
    expect(fixture.nativeElement.textContent).toContain('Level 20');
    expect(component.repliesIndent(2)).toBe('');
    expect(component.repliesIndent(3)).toBe('max-sm:-ml-10');
    expect(component.repliesIndent(5)).toBe('-ml-10');
    expect(component.replyMarker(3)).toBeNull();
    expect(component.replyMarker(4)).toBe('sm:hidden');
    expect(component.replyMarker(6)).toBe('');
  });

  it('setSortMode() reloads comments in the new order', () => {
    const source = createSource({
      list: vi
        .fn()
        .mockReturnValue(
          of({ content: [comment({ id: 'sorted' })], page: 0, size: 20, totalElements: 1 }),
        ),
    });
    const fixture = createComponent(source, [comment({ id: 'c1' })]);
    const component = fixture.componentInstance;

    component.setSortMode('recent');

    expect(source.list).toHaveBeenCalledWith(0, undefined, 'recent');
    expect(component.sortMode()).toBe('recent');
    expect(component.comments()[0].id).toBe('sorted');
    expect(component.sorting()).toBe(false);
  });

  it('dims the list while a new sort order loads and clears it on error', () => {
    const pending = new Subject<never>();
    const source = createSource({ list: vi.fn().mockReturnValue(pending) });
    const fixture = createComponent(source, [comment({ id: 'c1' })]);
    const component = fixture.componentInstance;

    component.setSortMode('recent');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('ul[aria-busy="true"]')).not.toBeNull();

    pending.error(new Error('boom'));
    expect(component.sorting()).toBe(false);
    expect(toastError).toHaveBeenCalledWith('boom');
  });

  it('loadMore() appends the next page of results', () => {
    const source = createSource({
      list: vi
        .fn()
        .mockReturnValue(
          of({ content: [comment({ id: 'c2' })], page: 1, size: 20, totalElements: 2 }),
        ),
    });
    const fixture = createComponent(source, [comment({ id: 'c1' })]);
    const component = fixture.componentInstance;

    component.loadMore();

    expect(component.comments().map((c) => c.id)).toEqual(['c1', 'c2']);
    expect(component.loadingMore()).toBe(false);
  });

  describe('menu, keyboard and counter', () => {
    const open = (fixture: ReturnType<typeof createComponent>) => {
      const button = fixture.nativeElement.querySelector(
        '[aria-haspopup="menu"]',
      ) as HTMLButtonElement;
      button.click();
      fixture.detectChanges();
    };

    it('keeps Edit and Delete out of sight until the ... menu opens', () => {
      const fixture = createComponent(createSource(), [comment({ id: 'c1', authorId: 'u1' })]);
      expect(fixture.nativeElement.querySelector('[role="menu"]')).toBeNull();

      open(fixture);

      const items = [
        ...fixture.nativeElement.querySelectorAll('[role="menuitem"]'),
      ] as HTMLElement[];
      expect(items.map((i) => i.textContent?.trim())).toEqual(['comments.edit', 'comments.delete']);
    });

    it('offers only Delete to a moderator on someone else comment', () => {
      const fixture = createComponent(createSource(), [comment({ id: 'c1', authorId: 'other' })]);
      fixture.componentRef.setInput('canModerate', true);
      fixture.detectChanges();

      open(fixture);

      const items = [
        ...fixture.nativeElement.querySelectorAll('[role="menuitem"]'),
      ] as HTMLElement[];
      expect(items.map((i) => i.textContent?.trim())).toEqual(['comments.delete']);
    });

    it('Edit from the menu starts editing and closes the menu', () => {
      const fixture = createComponent(createSource(), [comment({ id: 'c1', authorId: 'u1' })]);
      open(fixture);

      (fixture.nativeElement.querySelector('[role="menuitem"]') as HTMLButtonElement).click();
      fixture.detectChanges();

      expect(fixture.componentInstance.editingId()).toBe('c1');
      expect(fixture.nativeElement.querySelector('[role="menu"]')).toBeNull();
    });

    it('Ctrl+Enter and Cmd+Enter post the comment', () => {
      const source = createSource();
      const fixture = createComponent(source);
      const field = fixture.nativeElement.querySelector('textarea') as HTMLTextAreaElement;

      fixture.componentInstance.commentControl.setValue('Hello');
      field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true }));
      expect(source.add).toHaveBeenCalledTimes(1);

      fixture.componentInstance.commentControl.setValue('Again');
      field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', metaKey: true }));
      expect(source.add).toHaveBeenCalledTimes(2);
    });

    it('shows the character counter only within 50 characters of the limit', () => {
      const fixture = createComponent(createSource());
      fixture.componentRef.setInput('maxLength', 100);
      fixture.detectChanges();
      const counter = () => fixture.nativeElement.querySelector('form [aria-live="polite"]');

      fixture.componentInstance.commentControl.setValue('x'.repeat(40));
      fixture.detectChanges();
      expect(counter()).toBeNull();

      fixture.componentInstance.commentControl.setValue('x'.repeat(60));
      fixture.detectChanges();
      expect(counter()?.textContent?.trim()).toBe('40');
    });

    it('disables the send button while the field is empty', () => {
      const fixture = createComponent(createSource());
      const send = fixture.nativeElement.querySelector(
        'button[type="submit"]',
      ) as HTMLButtonElement;
      expect(send.disabled).toBe(true);

      fixture.componentInstance.commentControl.setValue('Hi');
      fixture.detectChanges();
      expect(send.disabled).toBe(false);
    });

    it('sort options expose their state with aria-checked', () => {
      const fixture = createComponent(createSource(), [
        comment({ id: 'c1' }),
        comment({ id: 'c2' }),
      ]);
      const options = [
        ...fixture.nativeElement.querySelectorAll('[role="radiogroup"] button'),
      ] as HTMLButtonElement[];
      expect(options.map((p) => p.getAttribute('aria-checked'))).toEqual(['true', 'false']);
    });
  });

  it('resetting initialItems reinitializes local state', () => {
    const fixture = createComponent(createSource(), [comment({ id: 'c1' })]);
    const component = fixture.componentInstance;
    component.startEdit(comment({ id: 'c1' }));
    expect(component.editingId()).toBe('c1');

    fixture.componentRef.setInput('initialItems', [comment({ id: 'c2' })]);
    fixture.componentRef.setInput('initialTotal', 1);
    fixture.componentRef.setInput('resetKey', 'reset-1');
    fixture.detectChanges();
    TestBed.flushEffects();
    fixture.detectChanges();

    expect(component.comments().map((c) => c.id)).toEqual(['c2']);
    expect(component.editingId()).toBeNull();
  });
});
