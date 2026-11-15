/** Scroll helpers: the nearest scrollable ancestor (or the window). */
export function scrollParent(el: Element | null): HTMLElement | Window {
  let cur = el?.parentElement ?? null;
  while (cur) {
    const s = getComputedStyle(cur);
    if (/(auto|scroll)/.test(s.overflowY) && cur.scrollHeight > cur.clientHeight) return cur;
    cur = cur.parentElement;
  }
  return window;
}

export function scrollTopOf(target: HTMLElement | Window): number {
  return target instanceof Window ? target.scrollY : target.scrollTop;
}

export function viewportTopOf(target: HTMLElement | Window): number {
  return target instanceof Window ? 0 : target.getBoundingClientRect().top;
}

/** Scrolls `el` to `offset` px below the top of its scroll container. */
export function scrollElementTo(el: HTMLElement, offset: number, behavior?: ScrollBehavior): void {
  const reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  behavior ??= reduced ? 'auto' : 'smooth';
  const container = scrollParent(el);
  const top = el.getBoundingClientRect().top - viewportTopOf(container) + scrollTopOf(container) - offset;
  container.scrollTo({ top, behavior });
}
