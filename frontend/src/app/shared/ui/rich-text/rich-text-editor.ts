import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  OnDestroy,
  afterNextRender,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Editor } from '@tiptap/core';
import Link from '@tiptap/extension-link';
import { Placeholder } from '@tiptap/extensions';
import Underline from '@tiptap/extension-underline';
import StarterKit from '@tiptap/starter-kit';
import { TranslatePipe } from '@app/shared/pipes/translate';
import { ButtonComponent } from '@shared/ui/button/button';
import { IconComponent } from '@shared/ui/icon/icon';
import { InputComponent } from '@shared/ui/input/input';
import { richTextDocument, type RichTextContent } from '@shared/utils/rich-text.util';
import { Spoiler } from './spoiler-mark';

function isSafeHttpsUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !!url.hostname;
  } catch {
    return false;
  }
}

const extensions = [
  StarterKit.configure({
    heading: { levels: [1, 2, 3] },
    link: false,
    underline: false,
  }),
  Underline,
  Link.configure({
    defaultProtocol: 'https',
    openOnClick: false,
    HTMLAttributes: { rel: 'nofollow ugc noopener noreferrer', target: '_blank' },
    isAllowedUri: isSafeHttpsUrl,
  }),
  Spoiler,
];

@Component({
  selector: 'shelfy-rich-text-editor',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, TranslatePipe, ButtonComponent, IconComponent, InputComponent],
  templateUrl: './rich-text-editor.html',
  host: { class: 'shelfy-rich-text-editor block' },
})
export class RichTextEditorComponent implements AfterViewInit, OnDestroy {
  content = input<RichTextContent | null>(null);
  placeholder = input('');
  readonly contentChange = output<RichTextContent>();

  readonly headingLevels = [1, 2, 3] as const;
  readonly linkOpen = signal(false);
  readonly linkInvalid = signal(false);
  readonly linkControl = new FormControl('', { nonNullable: true });

  private readonly element = viewChild.required<ElementRef<HTMLElement>>('editor');
  private readonly linkField = viewChild('linkField', { read: ElementRef });
  private readonly injector = inject(Injector);
  private readonly revision = signal(0);
  private editor: Editor | null = null;

  constructor() {
    effect(() => {
      const content = this.content();
      if (this.editor && !this.editor.isFocused) {
        this.editor.commands.setContent(richTextDocument(content), { emitUpdate: false });
      }
    });
  }

  ngAfterViewInit(): void {
    this.editor = new Editor({
      element: this.element().nativeElement,
      extensions: [...extensions, Placeholder.configure({ placeholder: this.placeholder() })],
      content: richTextDocument(this.content()),
      editorProps: {
        attributes: { class: 'shelfy-rich-text-content' },
      },
      onUpdate: ({ editor }) => this.contentChange.emit(editor.getJSON() as RichTextContent),
      onTransaction: () => this.revision.update((n) => n + 1),
    });
  }

  ngOnDestroy(): void {
    this.editor?.destroy();
  }

  active(name: string, attrs?: Record<string, unknown>): boolean {
    this.revision();
    return this.editor?.isActive(name, attrs) ?? false;
  }

  toggle(
    command:
      | 'bold'
      | 'italic'
      | 'underline'
      | 'strike'
      | 'spoiler'
      | 'bulletList'
      | 'orderedList'
      | 'blockquote',
  ): void {
    this.editor
      ?.chain()
      .focus()
      [`toggle${command[0].toUpperCase()}${command.slice(1)}` as 'toggleBold']()
      .run();
  }

  toggleHeading(level: 1 | 2 | 3): void {
    this.editor?.chain().focus().toggleHeading({ level }).run();
  }

  openLink(): void {
    if (!this.editor) return;
    this.linkControl.setValue(this.editor.getAttributes('link')['href'] ?? '');
    this.linkInvalid.set(false);
    this.linkOpen.set(true);
    afterNextRender(() => this.linkField()?.nativeElement.querySelector('input')?.focus(), {
      injector: this.injector,
    });
  }

  applyLink(event?: Event): void {
    event?.preventDefault();
    const href = this.linkControl.value.trim();
    if (!isSafeHttpsUrl(href)) {
      this.linkInvalid.set(true);
      return;
    }
    this.linkOpen.set(false);
    this.editor?.chain().focus().extendMarkRange('link').setLink({ href }).run();
  }

  closeLink(event?: Event): void {
    event?.preventDefault();
    this.linkOpen.set(false);
    this.editor?.commands.focus();
  }

  unsetLink(): void {
    this.editor?.chain().focus().unsetLink().run();
  }
}
