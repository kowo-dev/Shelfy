import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class LocalStorageService {
  private readonly available = typeof window !== 'undefined' && !!window.localStorage;

  getItem(key: string): string | null {
    if (!this.available) return null;
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  setItem(key: string, value: string): void {
    if (!this.available) return;
    try {
      window.localStorage.setItem(key, value);
    } catch {
      return;
    }
  }
}
