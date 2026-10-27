import { provideHttpClient } from '@angular/common/http';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Toast, ToastService } from '@app/core/services/toast/toast';

import { ToastContainerComponent } from './toast';

describe('ToastContainerComponent', () => {
  let toasts: ReturnType<typeof signal<Toast[]>>;
  let dismiss: ReturnType<typeof vi.fn>;
  let act: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    toasts = signal<Toast[]>([]);
    dismiss = vi.fn((id: string) => {
      toasts.update((list) => list.filter((t) => t.id !== id));
    });

    act = vi.fn();

    await TestBed.configureTestingModule({
      imports: [ToastContainerComponent],
      providers: [
        provideHttpClient(),
        {
          provide: ToastService,
          useValue: { toasts, dismiss, act },
        },
      ],
    }).compileComponents();
  });

  it('renders nothing when there are no toasts', () => {
    const fixture = TestBed.createComponent(ToastContainerComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('[role="status"]').length).toBe(0);
  });

  it('renders a toast entry with its message once the service emits one', async () => {
    const fixture = TestBed.createComponent(ToastContainerComponent);
    fixture.detectChanges();

    toasts.set([{ id: '1', type: 'success', message: 'Saved!', duration: 3000 }]);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const entries = fixture.nativeElement.querySelectorAll('[role="status"]');
    expect(entries.length).toBe(1);
    expect(entries[0].textContent).toContain('Saved!');
  });

  it('calls ToastService.dismiss when the dismiss button is clicked', async () => {
    const fixture = TestBed.createComponent(ToastContainerComponent);
    fixture.detectChanges();

    toasts.set([{ id: '1', type: 'info', message: 'Hello', duration: 3000 }]);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    fixture.componentInstance.dismiss('1');
    expect(dismiss).toHaveBeenCalledWith('1');
  });

  it('statusIcon falls back to the info icon for unknown types', () => {
    const fixture = TestBed.createComponent(ToastContainerComponent);
    fixture.detectChanges();

    const unknownToast = {
      id: '1',
      type: 'mystery',
      message: 'x',
      duration: 0,
    } as unknown as Toast;
    expect(fixture.componentInstance.statusIcon(unknownToast).name).toBe('info');
  });

  it('picks the matching status icon per toast type', () => {
    const fixture = TestBed.createComponent(ToastContainerComponent);
    fixture.detectChanges();

    const errorToast: Toast = { id: '1', type: 'error', message: 'x', duration: 0 };
    expect(fixture.componentInstance.statusIcon(errorToast)).toEqual({
      name: 'errorCircle',
      color: 'text-danger-fg',
    });
  });

  it('shows the toast action as a button that runs it', () => {
    const fixture = TestBed.createComponent(ToastContainerComponent);
    fixture.detectChanges();
    toasts.set([
      {
        id: 't1',
        type: 'success',
        message: 'Removed',
        duration: 5000,
        action: { label: 'Undo', run: () => undefined },
      },
    ]);
    fixture.detectChanges();

    const button = [...fixture.nativeElement.querySelectorAll('button')].find(
      (b: HTMLButtonElement) => b.textContent?.trim() === 'Undo',
    ) as HTMLButtonElement;
    button.click();

    expect(act).toHaveBeenCalledWith('t1');
  });
});
