import { VersusMatchupComponent } from '../versus/ui/versus-matchup/versus-matchup';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { of } from 'rxjs';
import { AuthPromptService } from '@app/core/services/auth/auth-prompt';
import { ToastService } from '@app/core/services/toast/toast';
import { TranslateService } from '@app/core/services/translate/translate';
import type {
  CollectionItemResponse,
  MediaResponse,
  MediaType,
  UserMediaStatus,
} from '@app/core/services/collection/collection.model';
import { TranslatePipe } from '@app/shared/pipes/translate';
import { AuthPromptDialogComponent } from '@shared/ui/auth-prompt-dialog/auth-prompt-dialog';
import { AvatarComponent } from '@shared/ui/avatar/avatar';
import { ButtonComponent } from '@shared/ui/button/button';
import { ButtonLinkDirective } from '@shared/ui/button/button-link';
import { CheckboxComponent } from '@shared/ui/checkbox/checkbox';
import { CommentVoteComponent } from '@shared/ui/comments/comment-vote';
import { CommentsComponent } from '@shared/ui/comments/comments';
import type { CommentItem, CommentsSource } from '@shared/ui/comments/comments.model';
import { countLive, findComment } from '@shared/ui/comments/comment-tree';
import { DialogComponent } from '@shared/ui/dialog/dialog';
import { EmptyStateComponent } from '@shared/ui/empty-state/empty-state';
import { MediaCardComponent } from '@shared/ui/media-card/media-card';
import { IconComponent } from '@shared/ui/icon/icon';
import { ImageLightboxComponent } from '@shared/ui/image-lightbox/image-lightbox';
import { InputComponent } from '@shared/ui/input/input';
import { ItemSheetComponent } from '@shared/ui/item-sheet/item-sheet';
import { MediaPickerComponent } from '@shared/ui/media-picker/media-picker';
import { SearchbarComponent } from '@shared/ui/searchbar/searchbar';
import { SelectComponent, type SelectOption } from '@shared/ui/select/select';
import { SpinnerComponent } from '@shared/ui/spinner/spinner';
import { SpoilerGuardComponent } from '@shared/ui/spoiler-guard/spoiler-guard';
import { TabsComponent, type TabItem } from '@shared/ui/tabs/tabs';
import { TagComponent } from '@shared/ui/tag/tag';
import { DetailSkeletonComponent } from '@shared/ui/detail-skeleton/detail-skeleton';
import { SettingsRowComponent } from '@shared/ui/settings-row/settings-row';
import { collapse } from '@shared/ui/ui-recipes';
import { TextareaComponent } from '@shared/ui/textarea/textarea';
import { ToggleComponent } from '@shared/ui/toggle/toggle';
import { EditBarComponent } from '@shared/ui/edit-bar/edit-bar';
import { LikeButtonComponent } from '@shared/ui/like-button/like-button';
import { PersonRowComponent } from '@shared/ui/person-row/person-row';
import { ProfileHeroComponent } from '@app/features/profile/ui/profile-hero/profile-hero';
import { RailComponent } from '@shared/ui/rail/rail';
import { SocialCountsComponent } from '@shared/ui/social-counts/social-counts';
import type { VersusEntry } from '@app/core/services/versus/versus.model';
import { VersusEntryCardComponent } from '../versus/ui/versus-entry-card/versus-entry-card';
import { ClipVolumeComponent } from '../versus/ui/clip-player/clip-volume';
import { CollaboratorsSheetComponent } from '@shared/ui/collaborators-sheet/collaborators-sheet';
import { VersusResultsComponent } from '../versus/ui/versus-results/versus-results';
import type { VersusMediaRankingEntry } from '@app/core/services/versus/versus.model';
import { buttonClasses } from '@shared/ui/button/button';

const TMDB = 'https://image.tmdb.org/t/p/w342/';
const STEAM = (id: number) =>
  `https://cdn.cloudflare.steamstatic.com/steam/apps/${id}/library_600x900.jpg`;
const LONG_TITLE =
  'The Extraordinarily Long and Winding Chronicle of a Title That Never Ends, Volume Two';

function media(title: string, mediaType: MediaType, coverUrl: string | null): MediaResponse {
  return {
    id: `m-${title}`,
    canonicalWorkId: `w-${title}`,
    externalId: '1',
    provider: 'tmdb',
    mediaType,
    title,
    coverUrl,
    metadata: null,
    createdAt: '2026-06-01T00:00:00Z',
  };
}

function item(
  title: string,
  mediaType: MediaType,
  coverUrl: string | null,
  status: UserMediaStatus,
  rating: number | null,
): CollectionItemResponse {
  return {
    id: `dev-${title}`,
    userId: 'dev',
    media: media(title, mediaType, coverUrl),
    status,
    rating,
    note: null,
    containsSpoilers: false,
    progress: {},
    createdAt: '2026-08-12T00:00:00Z',
    updatedAt: '2026-10-01T00:00:00Z',
  };
}

const NOW = '2026-10-10T12:00:00Z';
const comment = (id: string, fields: Partial<CommentItem>): CommentItem => ({
  id,
  authorId: 'u' + id,
  authorUsername: 'margot',
  authorAvatarUrl: null,
  content: 'The last act is worth every hour before it.',
  createdAt: NOW,
  updatedAt: null,
  upvotes: 0,
  downvotes: 0,
  myVote: null,
  parentCommentId: null,
  isDeleted: false,
  replies: [],
  ...fields,
});

const NAMES = ['hugo', 'lea', 'sami', 'ines', 'margot'];
const deepChain = (level: number, last: number, parentId: string): CommentItem =>
  comment(`c${level}`, {
    authorUsername: NAMES[level % NAMES.length],
    content: `Reply at level ${level}.`,
    parentCommentId: parentId,
    replies: level < last ? [deepChain(level + 1, last, `c${level}`)] : [],
  });

const COMMENTS: CommentItem[] = [
  comment('c1', {
    upvotes: 12,
    downvotes: 1,
    myVote: 1,
    replies: [
      comment('c2', {
        authorUsername: 'a_very_long_username_that_keeps_going',
        content:
          'Long comment to check wrapping: ' +
          'a sentence that keeps going well past the width of the column so the layout has to cope. '.repeat(
            3,
          ),
        updatedAt: NOW,
        upvotes: 3,
        parentCommentId: 'c1',
        replies: [deepChain(3, 14, 'c2')],
      }),
      comment('c70', {
        authorUsername: 'ines',
        content: 'Low-voted reply.',
        downvotes: 9,
        parentCommentId: 'c1',
      }),
    ],
  }),
  comment('c80', {
    authorId: null,
    authorUsername: null,
    content: '',
    isDeleted: true,
    replies: [
      comment('c90', {
        authorUsername: 'hugo',
        content: 'Replying to a deleted comment.',
        parentCommentId: 'c80',
      }),
    ],
  }),
];

@Component({
  selector: 'shelfy-dev-ui',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    VersusMatchupComponent,
    TextareaComponent,
    FormsModule,
    VersusEntryCardComponent,
    ClipVolumeComponent,
    TranslatePipe,
    AuthPromptDialogComponent,
    AvatarComponent,
    ButtonComponent,
    ButtonLinkDirective,
    CheckboxComponent,
    CommentVoteComponent,
    CommentsComponent,
    DetailSkeletonComponent,
    DialogComponent,
    EmptyStateComponent,
    MediaCardComponent,
    IconComponent,
    ImageLightboxComponent,
    InputComponent,
    ItemSheetComponent,
    MediaPickerComponent,
    SearchbarComponent,
    SelectComponent,
    SpinnerComponent,
    SpoilerGuardComponent,
    TabsComponent,
    TagComponent,
    ToggleComponent,
    SettingsRowComponent,
    EditBarComponent,
    LikeButtonComponent,
    PersonRowComponent,
    ProfileHeroComponent,
    RailComponent,
    SocialCountsComponent,
    CollaboratorsSheetComponent,
    VersusResultsComponent,
  ],
  templateUrl: './dev-ui.html',
})
export class DevUiPageComponent {
  readonly versusEntries: VersusEntry[] = [
    {
      id: 'dev-media',
      title: 'Hades II',
      coverUrl: 'https://image.tmdb.org/t/p/w342/qqHQsStV6exghCM7zbObuYBiYxw.jpg',
      media: null,
      clip: null,
    },
    {
      id: 'dev-youtube',
      title: 'Big Buck Bunny',
      coverUrl: null,
      media: null,
      clip: {
        provider: 'youtube',
        externalId: 'aqz-KE-bpKQ',
        title: 'Big Buck Bunny',
        author: 'Blender',
        startSeconds: 30,
      },
    },
  ];

  private readonly toast = inject(ToastService);
  private readonly translate = inject(TranslateService);
  readonly authPrompt = inject(AuthPromptService);
  readonly LONG = LONG_TITLE;
  readonly comments = COMMENTS;
  readonly commentCount = countLive(COMMENTS);
  readonly pill = buttonClasses({ variant: 'secondary' });
  readonly dangerPill = buttonClasses({ variant: 'secondary' });
  readonly collapse = collapse;
  readonly collapseOpen = signal(false);
  readonly motionItems = signal([1, 2, 3]);
  readonly skeletonOn = signal(true);
  private motionCounter = 3;

  readonly liked = signal(false);
  readonly likes = signal(11);
  readonly likePending = signal(false);
  readonly sheetOpen = signal(false);
  readonly barVisible = signal(false);
  readonly people = ['hugo', 'lea', 'sami', 'ines', 'margot', 'zoe'].map((username) => ({
    username,
    displayName: username,
  }));
  readonly members = this.people.slice(0, 3).map((person, i) => ({
    id: `m${i}`,
    listId: 'l1',
    userId: `u${i}`,
    username: person.username,
    displayName: person.displayName,
    avatarUrl: null,
    status: 'ACCEPTED' as const,
    invitedBy: 'u9',
    createdAt: NOW,
    updatedAt: NOW,
  }));
  readonly ranking = Array.from({ length: 14 }, (_, i) => ({
    entry: { id: `r${i}`, title: `Ranked ${i + 1}`, coverUrl: null },
    wins: 14 - i,
    avgPoints: 3 - i / 5,
    winRate: Math.max(0.1, 0.9 - i * 0.06),
    appearances: 20 - i,
  })) as unknown as VersusMediaRankingEntry[];

  toggleLike(): void {
    if (this.likePending()) return;
    const next = !this.liked();
    this.liked.set(next);
    this.likes.update((n) => n + (next ? 1 : -1));
    this.likePending.set(true);
    setTimeout(() => this.likePending.set(false), 400);
  }

  readonly variants = ['primary', 'secondary', 'danger'] as const;
  readonly sizes = ['sm', 'md', 'lg'] as const;

  readonly items = {
    game: item('Hades II', 'game', STEAM(1145350), 'ongoing', null),
    ongoing: item(
      'SpongeBob SquarePants',
      'tv_show',
      `${TMDB}5h0EU2lqBb03dp5vtRuUHJwqzem.jpg`,
      'ongoing',
      8,
    ),
    done: item(
      'Against the Current',
      'tv_show',
      `${TMDB}euBlF64efQmsl2y54LeNmLQPNob.jpg`,
      'done',
      9,
    ),
    planned: item(
      'East of Eden',
      'tv_show',
      `${TMDB}axdUor6gLMTrrB1UF4Qfy0TTSyX.jpg`,
      'planned',
      3,
    ),
    dropped: item(
      'Natural High',
      'tv_show',
      `${TMDB}oC2MuEWxnLVTyYw70XoK2HFf7nW.jpg`,
      'dropped',
      5,
    ),
    award: item("Baldur's Gate 3", 'game', STEAM(1086940), 'done', 10),
    noCover: item(LONG_TITLE, 'webtoon', null, 'ongoing', 6.5),
    long: item(LONG_TITLE, 'tv_show', `${TMDB}5Xc7WpWsgflfgEMoBlf9TmWhfbH.jpg`, 'done', 7),
  };
  readonly essentials = [this.items.award, this.items.ongoing, this.items.done, this.items.planned];
  readonly duel: VersusEntry[] = [this.items.award, this.items.ongoing].map((entry) => ({
    id: entry.id,
    title: entry.media.title,
    coverUrl: entry.media.coverUrl,
    media: entry.media,
    clip: null,
  }));
  readonly lightboxImages = [this.items.ongoing.media.coverUrl!, this.items.done.media.coverUrl!];

  private readonly t = (key: string) => this.translate.get(key);
  readonly sortOptions: SelectOption[] = ['relevance', 'rating', 'year', 'title'].map((v) => ({
    value: v,
    label: this.t(`search.sort_${v}`),
  }));
  readonly tabs: TabItem[] = (['ongoing', 'planned', 'done', 'dropped'] as const).map((id) => ({
    id,
    label: this.t(`collection.status.${id}`),
  }));
  readonly tags = ['Sci-fi', 'Drama', 'Cosy', 'Rewatch', 'Underrated gem', 'Soundtrack'];

  readonly commentsSource: CommentsSource = {
    list: () =>
      of({
        content: COMMENTS,
        page: 0,
        size: 20,
        totalElements: COMMENTS.length,
      }),
    add: (content, parentCommentId) =>
      of(comment(crypto.randomUUID(), { content, parentCommentId: parentCommentId ?? null })),
    update: (id, content) => of({ ...findComment(COMMENTS, id)!, content }),
    remove: () => of(undefined),
    vote: (id, value) => of({ ...findComment(COMMENTS, id)!, myVote: value }),
    removeVote: (id) => of({ ...findComment(COMMENTS, id)!, myVote: null }),
  };

  sort = 'relevance';
  selectDefault = 'rating';
  types = signal<string[]>(['movie']);
  tab = signal('ongoing');
  checked = signal(true);
  toggled = signal(true);
  selected = signal(false);
  dialogOpen = signal(false);
  dialogWideOpen = signal(false);
  sheetItem = signal<CollectionItemResponse | null>(null);
  pickerOpen = signal(false);
  lightboxOpen = signal(false);

  addMotionItem(): void {
    this.motionItems.update((items) => [...items, ++this.motionCounter]);
  }

  removeMotionItem(n: number): void {
    this.motionItems.update((items) => items.filter((i) => i !== n));
  }

  toggleSkeleton(): void {
    this.skeletonOn.update((on) => !on);
  }

  showToast(type: 'success' | 'error' | 'info' | 'warning', long = false): void {
    const message = this.translate.get(long ? 'dev_ui.toast_long' : 'dev_ui.toast_short');
    this.toast[type](message);
  }

  showMediaToast(): void {
    const { title, coverUrl } = this.items.award.media;
    this.toast.success(this.translate.get('collection.backlog.added'), 3000, undefined, {
      title,
      coverUrl,
    });
  }
}
