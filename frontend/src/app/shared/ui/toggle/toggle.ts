import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

let nextId = 0;

@Component({
  selector: 'shelfy-toggle',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <input
      type="checkbox"
      role="switch"
      class="peer sr-only"
      [id]="id"
      [checked]="checked()"
      [disabled]="disabled()"
      [attr.aria-label]="ariaLabel() || null"
      (change)="onToggle($event)"
    />
    <label
      [for]="id"
      class="peer-focus-visible:outline-brand-ink relative inline-flex h-5.5 w-9.5 shrink-0 cursor-pointer items-center rounded-full transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-3"
      [class]="checked() ? 'bg-brand-mark' : 'bg-white/14'"
      [class.opacity-50]="disabled()"
      [class.cursor-not-allowed]="disabled()"
    >
      <span
        class="duration-base pointer-events-none inline-block size-4 rounded-full bg-white transition-[translate] ease-out"
        [class]="checked() ? 'translate-x-[19px]' : 'translate-x-[3px]'"
      ></span>
    </label>
    @if (label()) {
      <label [for]="id" class="text-text-muted cursor-pointer text-base font-medium">{{
        label()
      }}</label>
    }
  `,
  host: { class: 'inline-flex min-h-10 items-center gap-2.5' },
})
export class ToggleComponent {
  label = input('');
  ariaLabel = input('');
  checked = input(false);
  disabled = input(false);
  checkedChange = output<boolean>();

  readonly id = `shelfy-toggle-${nextId++}`;

  onToggle(event: Event): void {
    this.checkedChange.emit((event.target as HTMLInputElement).checked);
  }
}
