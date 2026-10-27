import { Injectable, signal } from '@angular/core';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastAction {
  label: string;
  run: () => void;
}

export interface ToastMedia {
  title: string;
  coverUrl: string | null;
}

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration: number;
  action?: ToastAction;
  media?: ToastMedia;
}

const MAX_VISIBLE_TOASTS = 3;
const isTransient = (type: ToastType): boolean => type === 'success' || type === 'info';

@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();

  readonly toasts = signal<Toast[]>([]);

  success(message: string, duration = 3000, action?: ToastAction, media?: ToastMedia): void {
    this.add('success', message, duration, action, media);
  }

  error(message: string, duration = 5000): void {
    this.add('error', message, duration);
  }

  info(message: string, duration = 3000): void {
    this.add('info', message, duration);
  }

  warning(message: string, duration = 4000): void {
    this.add('warning', message, duration);
  }

  act(id: string): void {
    const toast = this.toasts().find((t) => t.id === id);
    this.dismiss(id);
    toast?.action?.run();
  }

  dismiss(id: string): void {
    clearTimeout(this.timers.get(id));
    this.timers.delete(id);
    this.toasts.update((list) => list.filter((t) => t.id !== id));
  }

  private add(
    type: ToastType,
    message: string,
    duration: number,
    action?: ToastAction,
    media?: ToastMedia,
  ): void {
    for (const toast of this.toasts()) {
      if (toast.message === message || (isTransient(type) && isTransient(toast.type))) {
        this.dismiss(toast.id);
      }
    }
    const id = crypto.randomUUID();
    let evicted: Toast | undefined;
    this.toasts.update((list) => {
      const next = [...list, { id, type: type ?? 'info', message, duration, action, media }];
      if (next.length > MAX_VISIBLE_TOASTS) {
        evicted = next[0];
        return next.slice(1);
      }
      return next;
    });
    if (evicted) {
      clearTimeout(this.timers.get(evicted.id));
      this.timers.delete(evicted.id);
    }
    if (duration > 0) {
      const timer = setTimeout(() => this.dismiss(id), duration);
      this.timers.set(id, timer);
    }
  }
}
