/** Page state persisted in the injected PageStateStore under "<namespace>:<key>" (NAV-04). */
import { useCallback, useState } from 'react';
import { useSmartKit } from '../context/SmartKitProvider';

export function usePageState<T>(key: string | undefined, initial: T | (() => T)): [T, (next: T | ((prev: T) => T)) => void] {
  const { pageState, namespace } = useSmartKit();
  const full = key ? `${namespace}:${key}` : undefined;
  const [state, setState] = useState<T>(() => {
    const stored = full ? pageState.get<T>(full) : undefined;
    if (stored !== undefined) return stored;
    return typeof initial === 'function' ? (initial as () => T)() : initial;
  });
  const set = useCallback(
    (next: T | ((prev: T) => T)) => {
      setState((prev) => {
        const value = typeof next === 'function' ? (next as (p: T) => T)(prev) : next;
        if (full) pageState.set(full, value);
        return value;
      });
    },
    [full, pageState],
  );
  return [state, set];
}

/** Reads a stored page state once (for components that keep their own state, e.g. scroll positions). */
export function useStoredState<T>(key: string | undefined): { read(): T | undefined; write(v: T): void } {
  const { pageState, namespace } = useSmartKit();
  const full = key ? `${namespace}:${key}` : undefined;
  return {
    read: () => (full ? pageState.get<T>(full) : undefined),
    write: (v: T) => { if (full) pageState.set(full, v); },
  };
}
