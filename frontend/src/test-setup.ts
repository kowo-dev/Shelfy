class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length(): number {
    return this.values.size;
  }

  clear(): void {
    this.values.clear();
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  key(index: number): string | null {
    return [...this.values.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

const testStorage = new MemoryStorage();
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: testStorage });
Object.defineProperty(window, 'localStorage', { configurable: true, value: testStorage });

class NoopObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

for (const name of ['ResizeObserver', 'IntersectionObserver'] as const) {
  if (!(name in globalThis)) {
    Object.defineProperty(globalThis, name, {
      value: NoopObserver,
      writable: true,
      configurable: true,
    });
  }
}
