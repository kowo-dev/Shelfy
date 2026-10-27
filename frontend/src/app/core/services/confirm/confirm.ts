import { Injectable, signal } from '@angular/core';

export interface ConfirmOptions {
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  url?: string;
  delaySeconds?: number;
}

export type ConfirmChoice = 'confirm' | 'cancel' | 'dismiss';

@Injectable({ providedIn: 'root' })
export class ConfirmService {
  readonly message = signal<string | null>(null);
  readonly options = signal<ConfirmOptions>({});
  private resolver: ((choice: ConfirmChoice) => void) | null = null;

  choose(message: string, options: ConfirmOptions = {}): Promise<ConfirmChoice> {
    this.resolver?.('dismiss');
    this.options.set(options);
    this.message.set(message);
    return new Promise((resolve) => (this.resolver = resolve));
  }

  ask(message: string, options: ConfirmOptions = {}): Promise<boolean> {
    return this.choose(message, options).then((choice) => choice === 'confirm');
  }

  answer(value: boolean): void {
    this.settle(value ? 'confirm' : 'cancel');
  }

  dismiss(): void {
    this.settle('dismiss');
  }

  private settle(choice: ConfirmChoice): void {
    this.message.set(null);
    this.resolver?.(choice);
    this.resolver = null;
  }
}
