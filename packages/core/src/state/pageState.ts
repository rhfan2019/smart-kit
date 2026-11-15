/** Page state storage for restoring pages on back navigation. See docs/05-data-provider.md §8. */

export interface PageStateStore {
  get<T>(key: string): T | undefined;
  set<T>(key: string, value: T): void;
}

/** Keeps page state in memory only (default). */
export class MemoryPageStateStore implements PageStateStore {
  private readonly map = new Map<string, unknown>();
  get<T>(key: string): T | undefined {
    return this.map.get(key) as T | undefined;
  }
  set<T>(key: string, value: T): void {
    this.map.set(key, value);
  }
}

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/**
 * Persists page state in a Storage (sessionStorage by default). Keys arrive already namespaced by the
 * provider ("<namespace>:<page key>"); `prefix` is an optional extra prefix. Falls back to memory when the
 * storage is not available.
 */
export function createSessionPageStateStore(prefix = '', storage?: StorageLike): PageStateStore {
  const memory = new MemoryPageStateStore();
  const resolve = (): StorageLike | undefined => {
    if (storage) return storage;
    try {
      return (globalThis as { sessionStorage?: StorageLike }).sessionStorage;
    } catch {
      return undefined;
    }
  };
  const k = (key: string) => (prefix ? `${prefix}:${key}` : key);
  return {
    get<T>(key: string): T | undefined {
      try {
        const s = resolve()?.getItem(k(key));
        if (s !== null && s !== undefined) return JSON.parse(s) as T;
      } catch {
        /* fall through */
      }
      return memory.get<T>(key);
    },
    set<T>(key: string, value: T): void {
      memory.set(key, value);
      try {
        resolve()?.setItem(k(key), JSON.stringify(value));
      } catch {
        /* memory only */
      }
    },
  };
}
