import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  Injector,
  input,
  output,
  signal,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  debounceTime,
  distinctUntilChanged,
  map,
  merge,
  of,
  switchMap,
  type Observable,
} from 'rxjs';
import { AuthService } from '@app/core/services/auth/auth';
import { AuthPromptService } from '@app/core/services/auth/auth-prompt';
import { ToastService } from '@app/core/services/toast/toast';
import { ErrorMessageService } from '@app/core/services/error-message/error-message';
import { DateFormatService } from '@app/core/services/date-format/date-format';
import { TranslateService } from '@app/core/services/translate/translate';
import { PeopleService } from '@app/core/services/people/people';
import { ApiError } from '@app/core/errors/api-error';
import { TranslatePipe } from '@app/shared/pipes/translate';
import { AvatarComponent } from '@shared/ui/avatar/avatar';
import { SegmentedComponent } from '@shared/ui/segmented/segmented';
import { IconComponent } from '@shared/ui/icon/icon';
import { SpinnerComponent } from '@shared/ui/spinner/spinner';
import { CommentVoteComponent } from './comment-vote';
import { isLowVoted } from './comment-score';
import { countLive, mapComment, removeComment } from './comment-tree';
import type {
  CommentItem,
  CommentSortMode,
  CommentsSource,
  CommentVoteValue,
  MentionCandidate,
} from './comments.model';
import { buttonClasses } from '@shared/ui/button/button';

import { HIT_AREA_40, MENU_ITEM, MENU_PANEL, collapse, staggerDelay } from '@shared/ui/ui-recipes';

const MENTION_TRIGGER = /(?:^|\s)@([a-zA-Z0-9_.-]{0,30})$/;
const COUNTER_THRESHOLD = 50;
const MOBILE_INDENT_CAP = 3;
const DESKTOP_INDENT_CAP = 5;

@Component({
  selector: 'shelfy-comments',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NgTemplateOutlet,
    RouterLink,
    ReactiveFormsModule,
    TranslatePipe,
    AvatarComponent,
    IconComponent,
    SpinnerComponent,
    CommentVoteComponent,
    SegmentedComponent,
  ],
  templateUrl: './comments.html',
  host: { '(document:click)': 'menuOpenId.set(null)' },
})
export class CommentsComponent {
  readonly menuItem = MENU_ITEM;
  readonly menuPanel = MENU_PANEL;
  readonly pill = buttonClasses({ variant: 'secondary', size: 'sm' });
  readonly primaryPill = buttonClasses({ variant: 'primary', size: 'sm' });
  readonly collapse = collapse;
  readonly dangerPill = buttonClasses({
    variant: 'secondary',
    size: 'sm',
    extraClass: 'text-danger-fg! hover:bg-danger-fg/12!',
  });
  readonly threadLine =
    'group/line flex w-full flex-1 cursor-pointer justify-center pt-2 focus-visible:outline-none';
  readonly expandButton = `${HIT_AREA_40} text-text-subtle hover:text-text-muted flex shrink-0 cursor-pointer items-center gap-1 text-sm transition-colors`;
  readonly fieldShell =
    'relative rounded-2xl bg-white/8 transition-[background-color,box-shadow] duration-base hover:bg-white/11 focus-within:bg-white/12 focus-within:shadow-[0_0_0_2px_rgb(230_211_179/0.5)]';
  readonly sendButton = buttonClasses({
    variant: 'primary',
    extraClass: 'shrink-0 aria-busy:cursor-progress',
  });
  readonly menuButton = `${HIT_AREA_40} text-text-subtle hover:text-text grid size-9 cursor-pointer place-items-center rounded-full opacity-0 transition-[opacity,background-color,color] duration-base group-focus-within/comment:opacity-100 group-hover/comment:opacity-100 hover:bg-fill aria-expanded:bg-fill aria-expanded:opacity-100 [@media(hover:none)]:opacity-100`;
  readonly actionsRow = 'mt-1.5 -ml-1.5 flex items-center gap-4.5';
  readonly replyButton = `${HIT_AREA_40} text-text-muted hover:text-text inline-flex h-7.5 cursor-pointer items-center gap-2 text-[0.8125rem] font-semibold transition-colors`;
  readonly loadMoreButton = buttonClasses({
    variant: 'secondary',
    size: 'sm',
    extraClass: 'aria-busy:cursor-progress',
  });
  readonly mentionPanel = `${MENU_PANEL} top-auto! left-0 mt-1.5 w-full max-w-sm origin-top-left`;

  source = input.required<CommentsSource>();
  initialItems = input<CommentItem[]>([]);
  initialTotal = input<number>(0);
  resetKey = input<unknown>(null);
  maxLength = input(500);
  canModerate = input(false);

  collapseThreshold = input(-5);

  totalChange = output<number>();

  private readonly auth = inject(AuthService);
  private readonly authPrompt = inject(AuthPromptService);
  private readonly toast = inject(ToastService);
  private readonly errorMessage = inject(ErrorMessageService);
  private readonly dateFormat = inject(DateFormatService);
  private readonly translate = inject(TranslateService);
  private readonly people = inject(PeopleService);
  private readonly host: ElementRef<HTMLElement> = inject(ElementRef);
  private readonly injector = inject(Injector);

  readonly comments = signal<CommentItem[]>([]);
  readonly total = signal(0);
  private page = signal(0);

  readonly posting = signal(false);
  readonly loadingMore = signal(false);
  readonly sorting = signal(false);
  readonly editingId = signal<string | null>(null);
  readonly savingEdit = signal(false);
  readonly editShown = signal<string | null>(null);
  readonly confirmingDeleteId = signal<string | null>(null);
  readonly deletingId = signal<string | null>(null);

  readonly sortMode = signal<CommentSortMode>('relevance');
  readonly sortOptions = computed(() => {
    this.translate.lang();
    return (['relevance', 'recent'] as const).map((id) => ({
      id,
      label: this.translate.get('comments.sort.' + id),
    }));
  });
  readonly pendingVoteIds = signal<Set<string>>(new Set());
  readonly voteShake = signal<{ commentId: string; value: CommentVoteValue } | null>(null);
  readonly toggledIds = signal<Set<string>>(new Set());
  readonly hasMore = computed(() => countLive(this.comments()) < this.total());
  private readonly queuedVotes = new Map<string, CommentVoteValue | null>();
  private readonly voteOrigin = new Map<
    string,
    { myVote: CommentVoteValue | null; upvotes: number; downvotes: number }
  >();

  readonly commentControl = new FormControl('', { nonNullable: true });
  readonly editControl = new FormControl('', { nonNullable: true });
  readonly replyControl = new FormControl('', { nonNullable: true });
  private readonly draft = toSignal(this.commentControl.valueChanges, { initialValue: '' });
  private readonly editDraft = toSignal(this.editControl.valueChanges, { initialValue: '' });
  private readonly replyDraft = toSignal(this.replyControl.valueChanges, { initialValue: '' });
  readonly charsLeft = computed(() => this.maxLength() - this.draft().length);
  readonly editCharsLeft = computed(() => this.maxLength() - this.editDraft().length);
  readonly replyCharsLeft = computed(() => this.maxLength() - this.replyDraft().length);
  readonly counterThreshold = COUNTER_THRESHOLD;
  readonly currentUser = this.auth.currentUser;

  readonly menuOpenId = signal<string | null>(null);
  readonly sent = signal(false);
  readonly animateEnter = signal(false);
  private freshFrom = Number.POSITIVE_INFINITY;

  readonly replyingToId = signal<string | null>(null);
  readonly replying = signal(false);
  readonly mentionResults = signal<MentionCandidate[]>([]);
  readonly mentionTarget = signal<'root' | 'reply'>('root');
  private mentionControl = this.commentControl;
  private mentionMatchStart = 0;
  private mentionMatchEnd = 0;

  constructor() {
    afterNextRender(() => this.animateEnter.set(true));
    this.bindReset();
    this.bindValidators();
    this.bindMentions();
  }

  private bindReset(): void {
    effect(() => {
      this.resetKey();
      this.comments.set(this.initialItems());
      this.total.set(this.initialTotal());
      this.page.set(0);
      this.cancelEdit();
      this.confirmingDeleteId.set(null);
      this.toggledIds.set(new Set());
      this.cancelReply();
    });
    effect(() => this.totalChange.emit(this.total()));
  }

  private bindValidators(): void {
    effect(() => {
      const validators = [Validators.required, Validators.maxLength(this.maxLength())];
      this.commentControl.setValidators(validators);
      this.commentControl.updateValueAndValidity({ emitEvent: false });
      this.editControl.setValidators(validators);
      this.editControl.updateValueAndValidity({ emitEvent: false });
      this.replyControl.setValidators(validators);
      this.replyControl.updateValueAndValidity({ emitEvent: false });
    });
  }

  private bindMentions(): void {
    merge(
      this.commentControl.valueChanges.pipe(
        map((value) => ({ control: this.commentControl, value })),
      ),
      this.replyControl.valueChanges.pipe(map((value) => ({ control: this.replyControl, value }))),
    )
      .pipe(
        debounceTime(200),
        distinctUntilChanged((a, b) => a.control === b.control && a.value === b.value),
        switchMap(({ control, value }) => {
          this.mentionControl = control;
          this.mentionTarget.set(control === this.replyControl ? 'reply' : 'root');
          return this.findMentions(value);
        }),
      )
      .subscribe({
        next: (candidates) => {
          this.mentionResults.set(this.mentionMatchStart >= 0 ? candidates : []);
        },
        error: () => this.mentionResults.set([]),
      });
  }

  private findMentions(value: string): Observable<MentionCandidate[]> {
    const match = MENTION_TRIGGER.exec(value);
    if (!match || match[1].length < 1) {
      this.mentionMatchStart = -1;
      return of([]);
    }
    this.mentionMatchStart = match.index + match[0].length - match[1].length - 1;
    this.mentionMatchEnd = value.length;
    return this.people.search(match[1], 0, 6).pipe(
      map((result) =>
        result.content.map((u) => ({
          id: u.id,
          username: u.username,
          displayName: u.displayName,
          avatarUrl: null,
        })),
      ),
    );
  }

  selectMention(candidate: MentionCandidate): void {
    const value = this.mentionControl.value;
    const next = `${value.slice(0, this.mentionMatchStart)}@${candidate.username} ${value.slice(this.mentionMatchEnd)}`;
    this.mentionControl.setValue(next);
    this.mentionResults.set([]);
    this.mentionMatchStart = -1;
  }

  readonly isAuthenticated = this.auth.isAuthenticated;

  startReply(comment: CommentItem): void {
    if (!this.authPrompt.require()) return;
    if (this.replyingToId() !== comment.id) this.replyControl.reset('');
    this.replyingToId.set(comment.id);
    afterNextRender(
      () => this.host.nativeElement.querySelector<HTMLElement>(`#reply-${comment.id}`)?.focus(),
      { injector: this.injector },
    );
  }

  cancelReply(): void {
    this.replyingToId.set(null);
    this.replyControl.reset('');
    this.mentionResults.set([]);
  }

  submitReply(parent: CommentItem): void {
    if (this.replyControl.invalid || this.replying()) return;
    this.replying.set(true);
    this.source()
      .add(this.replyControl.value.trim(), parent.id)
      .subscribe({
        next: (reply) => {
          this.comments.update((items) =>
            mapComment(items, parent.id, (c) => ({ ...c, replies: [reply, ...c.replies] })),
          );
          this.total.update((count) => count + 1);
          this.replying.set(false);
          this.cancelReply();
        },
        error: (error) => {
          this.toast.error(this.errorMessage.fromApiError(error));
          this.replying.set(false);
        },
      });
  }

  repliesIndent(depth: number): string {
    if (depth >= DESKTOP_INDENT_CAP) return '-ml-10';
    return depth >= MOBILE_INDENT_CAP ? 'max-sm:-ml-10' : '';
  }

  replyMarker(depth: number): string | null {
    if (depth > DESKTOP_INDENT_CAP) return '';
    return depth > MOBILE_INDENT_CAP ? 'sm:hidden' : null;
  }

  replyCount(comment: CommentItem): number {
    return countLive(comment.replies);
  }

  isMine(comment: CommentItem): boolean {
    return comment.authorId === this.auth.currentUser()?.id;
  }

  canDelete(comment: CommentItem): boolean {
    return this.isMine(comment) || this.canModerate();
  }

  createdAtLabel(comment: CommentItem): string {
    this.translate.lang();
    const date = new Date(comment.createdAt);
    if (Number.isNaN(date.getTime())) return '';
    return this.dateFormat.formatRelative(date, this.translate.lang());
  }

  createdAtTitle(comment: CommentItem): string {
    const date = new Date(comment.createdAt);
    return Number.isNaN(date.getTime())
      ? ''
      : this.dateFormat.formatDateTime(date, this.translate.lang());
  }

  enterDelay(index: number): number {
    return index >= this.freshFrom ? staggerDelay(index - this.freshFrom) : 0;
  }

  toggleMenu(commentId: string, event: Event): void {
    event.stopPropagation();
    this.menuOpenId.update((id) => (id === commentId ? null : commentId));
  }

  submitFromKeyboard(event: Event): void {
    event.preventDefault();
    this.addComment();
  }

  canVote(comment: CommentItem): boolean {
    return !!this.auth.currentUser() && !this.isMine(comment);
  }

  isLowVoted(comment: CommentItem): boolean {
    return (
      !comment.isDeleted && isLowVoted(comment.upvotes, comment.downvotes, this.collapseThreshold())
    );
  }

  isCollapsed(comment: CommentItem): boolean {
    return this.isLowVoted(comment) !== this.toggledIds().has(comment.id);
  }

  toggleCollapsed(commentId: string): void {
    this.toggledIds.update((ids) => {
      const next = new Set(ids);
      if (next.has(commentId)) {
        next.delete(commentId);
      } else {
        next.add(commentId);
      }
      return next;
    });
  }

  setSortMode(mode: CommentSortMode): void {
    if (this.sortMode() === mode) return;
    this.sortMode.set(mode);
    this.page.set(0);
    this.sorting.set(true);
    this.source()
      .list(0, undefined, mode)
      .subscribe({
        next: (result) => {
          this.comments.set(result.content);
          this.page.set(result.page);
          this.sorting.set(false);
        },
        error: (error) => {
          this.toast.error(this.errorMessage.fromApiError(error));
          this.sorting.set(false);
        },
      });
  }

  vote(comment: CommentItem, value: CommentVoteValue): void {
    if (!this.authPrompt.require()) return;
    if (!this.canVote(comment)) return;
    const nextVote = comment.myVote === value ? null : value;
    if (!this.pendingVoteIds().has(comment.id) && !this.voteOrigin.has(comment.id)) {
      this.voteOrigin.set(comment.id, {
        myVote: comment.myVote,
        upvotes: comment.upvotes,
        downvotes: comment.downvotes,
      });
    }
    this.applyVoteDelta(comment.id, nextVote);
    if (this.pendingVoteIds().has(comment.id)) {
      this.queuedVotes.set(comment.id, nextVote);
      return;
    }
    this.sendVote(comment.id, nextVote);
  }

  private applyVoteDelta(commentId: string, nextVote: CommentVoteValue | null): void {
    this.comments.update((items) =>
      mapComment(items, commentId, (item) => {
        let { upvotes, downvotes } = item;
        if (item.myVote === 1) upvotes--;
        if (item.myVote === -1) downvotes--;
        if (nextVote === 1) upvotes++;
        if (nextVote === -1) downvotes++;
        return { ...item, myVote: nextVote, upvotes, downvotes };
      }),
    );
  }

  private replaceComment(updated: CommentItem): void {
    this.comments.update((items) =>
      mapComment(items, updated.id, (item) => ({ ...updated, replies: item.replies })),
    );
  }

  private sendVote(commentId: string, value: CommentVoteValue | null): void {
    this.pendingVoteIds.update((set) => new Set(set).add(commentId));
    const request$ =
      value === null ? this.source().removeVote(commentId) : this.source().vote(commentId, value);
    request$.subscribe({
      next: (updated) => {
        this.replaceComment(updated);
        this.voteOrigin.delete(commentId);
        this.onVoteSettled(commentId, value);
      },
      error: (error: unknown) => {
        const original = this.voteOrigin.get(commentId);
        if (original) {
          this.comments.update((items) =>
            mapComment(items, commentId, (item) => ({ ...item, ...original })),
          );
        }
        this.voteOrigin.delete(commentId);
        this.queuedVotes.delete(commentId);
        if (error instanceof ApiError && error.status === 429) {
          this.voteShake.set({ commentId, value: value ?? original?.myVote ?? 1 });
          setTimeout(() => this.voteShake.set(null), 400);
        } else {
          this.toast.error(this.errorMessage.fromApiError(error));
        }
        this.pendingVoteIds.update((set) => {
          const next = new Set(set);
          next.delete(commentId);
          return next;
        });
      },
    });
  }

  private onVoteSettled(commentId: string, sentValue: CommentVoteValue | null): void {
    const queued = this.queuedVotes.get(commentId);
    if (queued !== undefined && queued !== sentValue) {
      this.queuedVotes.delete(commentId);
      this.sendVote(commentId, queued);
      return;
    }
    this.queuedVotes.delete(commentId);
    this.pendingVoteIds.update((set) => {
      const next = new Set(set);
      next.delete(commentId);
      return next;
    });
  }

  addComment(): void {
    if (!this.authPrompt.require()) return;
    if (this.commentControl.invalid || this.posting()) return;
    this.posting.set(true);
    this.source()
      .add(this.commentControl.value.trim())
      .subscribe({
        next: (comment) => {
          this.comments.update((items) => [comment, ...items]);
          this.total.update((count) => count + 1);
          this.freshFrom = Number.POSITIVE_INFINITY;
          this.commentControl.reset('');
          this.posting.set(false);
          this.sent.set(true);
          setTimeout(() => this.sent.set(false), 1200);
        },
        error: (error) => {
          this.toast.error(this.errorMessage.fromApiError(error));
          this.posting.set(false);
        },
      });
  }

  loadMore(): void {
    if (this.loadingMore()) return;
    this.loadingMore.set(true);
    this.source()
      .list(this.page() + 1, undefined, this.sortMode())
      .subscribe({
        next: (result) => {
          this.freshFrom = this.comments().length;
          this.comments.update((items) => {
            const known = new Set(items.map((item) => item.id));
            return [...items, ...result.content.filter((item) => !known.has(item.id))];
          });
          this.page.set(result.page);
          this.loadingMore.set(false);
        },
        error: (error) => {
          this.toast.error(this.errorMessage.fromApiError(error));
          this.loadingMore.set(false);
        },
      });
  }

  startEdit(comment: CommentItem): void {
    this.menuOpenId.set(null);
    this.confirmingDeleteId.set(null);
    this.editingId.set(comment.id);
    this.editShown.set(comment.id);
    this.editControl.setValue(comment.content);
  }

  cancelEdit(): void {
    this.editingId.set(null);
    this.editControl.reset('');
    setTimeout(() => this.editingId() === null && this.editShown.set(null), 400);
  }

  saveEdit(comment: CommentItem): void {
    if (this.editControl.invalid || this.savingEdit()) return;
    this.savingEdit.set(true);
    this.source()
      .update(comment.id, this.editControl.value.trim())
      .subscribe({
        next: (updated) => {
          this.replaceComment(updated);
          this.savingEdit.set(false);
          this.cancelEdit();
        },
        error: (error) => {
          this.toast.error(this.errorMessage.fromApiError(error));
          this.savingEdit.set(false);
        },
      });
  }

  requestDelete(comment: CommentItem): void {
    this.menuOpenId.set(null);
    this.cancelEdit();
    this.confirmingDeleteId.set(comment.id);
  }

  cancelDelete(): void {
    this.confirmingDeleteId.set(null);
  }

  confirmDelete(comment: CommentItem): void {
    if (this.deletingId()) return;
    this.deletingId.set(comment.id);
    this.source()
      .remove(comment.id)
      .subscribe({
        next: () => {
          this.comments.update((items) =>
            comment.replies.length > 0
              ? mapComment(items, comment.id, (item) => ({
                  ...item,
                  authorId: null,
                  authorUsername: null,
                  authorAvatarUrl: null,
                  content: '',
                  isDeleted: true,
                }))
              : removeComment(items, comment.id),
          );
          this.total.update((count) => Math.max(0, count - 1));
          this.deletingId.set(null);
          this.confirmingDeleteId.set(null);
          this.toast.success(this.translate.get('comments.deleted'));
        },
        error: (error) => {
          this.toast.error(this.errorMessage.fromApiError(error));
          this.deletingId.set(null);
        },
      });
  }
}
