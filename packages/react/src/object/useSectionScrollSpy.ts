/** Current section while scrolling, and scrolling to a section (OP-08). */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useDynamicPage } from '../page/DynamicPage';
import { scrollElementTo, scrollParent, viewportTopOf } from './scroll';

export const SECTION_ELEMENT_ID = (scope: string, id: string) => `sk-section-${scope}-${id.replace(/[^\w-]/g, '_')}`;

export function useSectionScrollSpy(scope: string, ids: string[], enabled = true): { active: string | undefined; scrollTo(id: string): void } {
  const [active, setActive] = useState<string | undefined>(ids[0]);
  const page = useDynamicPage();
  const lock = useRef(0);
  const pageRef = useRef(page);
  pageRef.current = page;

  useEffect(() => {
    if (!enabled || !ids.length) return;
    const first = document.getElementById(SECTION_ELEMENT_ID(scope, ids[0]!));
    const container = scrollParent(first);
    const onScroll = () => {
      if (Date.now() < lock.current) return;
      const offset = (pageRef.current?.stickyHeight() ?? 0) + viewportTopOf(container) + 8;
      let current = ids[0];
      for (const id of ids) {
        const el = document.getElementById(SECTION_ELEMENT_ID(scope, id));
        if (el && el.getBoundingClientRect().top <= offset) current = id;
      }
      // At the bottom of the page the last section is active.
      const scrolled = container instanceof Window ? window.scrollY : container.scrollTop;
      const atEnd = scrolled > 0 && (container instanceof Window
        ? window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2
        : container.scrollTop + container.clientHeight >= container.scrollHeight - 2);
      setActive(atEnd ? ids[ids.length - 1] : current);
    };
    container.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => container.removeEventListener('scroll', onScroll);
  }, [scope, ids.join('|'), enabled]); // eslint-disable-line react-hooks/exhaustive-deps

  const scrollTo = useCallback(
    (id: string) => {
      const go = () => {
        const el = document.getElementById(SECTION_ELEMENT_ID(scope, id));
        if (!el) return;
        lock.current = Date.now() + 900;
        setActive(id.split('::sub::')[0]);
        scrollElementTo(el, pageRef.current?.stickyHeight() ?? 0);
        el.focus({ preventScroll: true });
      };
      if (pageRef.current) pageRef.current.collapseThen(go);
      else go();
    },
    [scope],
  );
  return { active, scrollTo };
}
