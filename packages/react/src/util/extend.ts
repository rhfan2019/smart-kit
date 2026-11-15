/** Id-based replace / insert for model-generated items. See docs/06-extension-and-theming.md §1. */

export type ExtendPosition = 'before' | 'after' | 'replace' | 'start' | 'end';

export interface ExtendEntry<T> {
  /** Id of the new item (insert) or of the item to replace. */
  id: string;
  position: ExtendPosition;
  /** Id of the item to insert before or after. */
  anchor?: string;
  /** New item (insert) or replacement (replace). For replace, a function receives the original. */
  item: T | ((original: T) => T);
}

export function applyExtensions<T extends { id: string }>(items: T[], entries: ExtendEntry<T>[] | undefined, scope: string): T[] {
  if (!entries?.length) return items;
  let out = [...items];
  const warn = (msg: string) => {
    if (import.meta.env?.DEV) console.warn(`[smart-kit] ${scope}: ${msg}`);
  };
  const make = (e: ExtendEntry<T>, original?: T): T => {
    const it = typeof e.item === 'function' ? (e.item as (o: T) => T)(original as T) : e.item;
    return { ...it, id: e.id };
  };
  for (const e of entries) {
    if (e.position === 'replace') {
      const i = out.findIndex((x) => x.id === e.id);
      if (i < 0) warn(`no item "${e.id}" to replace`);
      else out[i] = make(e, out[i]);
      continue;
    }
    out = out.filter((x) => x.id !== e.id);
    const item = make(e);
    if (e.position === 'start') { out.unshift(item); continue; }
    if (e.position === 'end') { out.push(item); continue; }
    const i = e.anchor ? out.findIndex((x) => x.id === e.anchor) : -1;
    if (i < 0) {
      warn(`anchor "${e.anchor ?? ''}" not found; inserting at the ${e.position === 'before' ? 'start' : 'end'}`);
      if (e.position === 'before') out.unshift(item);
      else out.push(item);
    } else out.splice(e.position === 'before' ? i : i + 1, 0, item);
  }
  return out;
}
