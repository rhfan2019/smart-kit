/** Current section while scrolling, and scrolling to a section (OP-08). */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useDynamicPage } from '../page/DynamicPage';
import { scrollElementTo, scrollParent, viewportTopOf } from './scroll';

export const SECTION_ELEMENT_ID = (scope: string, id: string) => `sk-section-${scope}-${id.replace(/[^\w-]/g, '_')}`;

export function useSectionScrollSpy(scope: string, ids: string[], enabled = true): { active: string | undefined; scrollTo(id: string): void } {
  const [active, setActive] = useState<string | undefined>(ids[0]);
  const page = useDynamicPage();
  const lock = useRef(0);
  /** After an anchor click: the clicked section stays active until the scroll position changes. */
  const clicked = useRef<{ id: string; position: number } | null>(null);
  const recompute = useRef<() => void>(() => {});
  const pageRef = useRef(page);
  pageRef.current = page;

  useEffect(() => {
    if (!enabled || !ids.length) return;
    const first = document.getElementById(SECTION_ELEMENT_ID(scope, ids[0]!));
    const container = scrollParent(first);
    const onScroll = () => {
      if (Date.now() < lock.current) return;
      const position = container instanceof Window ? window.scrollY : container.scrollTop;
      if (clicked.current) {
        if (Math.abs(position - clicked.current.position) <= 2) return setActive(clicked.current.id);
        clicked.current = null;
      }
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
    recompute.current = onScroll;
    container.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => container.removeEventListener('scroll', onScroll);
  }, [scope, ids.join('|'), enabled]); // eslint-disable-line react-hooks/exhaustive-deps

  const scrollTo = useCallback(
    (id: string) => {
      const go = () => {
        const el = document.getElementById(SECTION_ELEMENT_ID(scope, id));
        if (!el) return;
        lock.current = Date.now() + 1300;
        clicked.current = null;
        setActive(id.split('::sub::')[0]);
        const container = scrollParent(el);
        const position = () => (container instanceof Window ? window.scrollY : container.scrollTop);
        const offset = () => pageRef.current?.stickyHeight() ?? 0;
        scrollElementTo(el, offset());
        el.focus({ preventScroll: true });
        // A smooth scroll is cancelled by layout changes (the header snaps while scrolling) and the sticky
        // area changes height: until the section is in place, re-issue the scroll whenever it has stopped
        // short. Stop as soon as the user scrolls, clicks or types.
        let userMoved = false;
        const stopOnUser = () => { userMoved = true; };
        const events = ['wheel', 'touchstart', 'keydown', 'pointerdown'] as const;
        for (const ev of events) container.addEventListener(ev, stopOnUser, { passive: true, once: true });
        let last = position();
        const distance = () => {
          const target = document.getElementById(SECTION_ELEMENT_ID(scope, id));
          return target ? target.getBoundingClientRect().top - viewportTopOf(container) - offset() : 0;
        };
        let heading = Math.sign(distance()); // +1: the page has to scroll down to reach the section
        let checks = 0;
        const timer = setInterval(() => {
          const target = document.getElementById(SECTION_ELEMENT_ID(scope, id));
          const now = position();
          const delta = distance();
          const max = container instanceof Window ? document.documentElement.scrollHeight - window.innerHeight : container.scrollHeight - container.clientHeight;
          // The scroll position moves against the direction of the section: someone else scrolls (keyboard,
          // scrollbar, script). Layout changes (sections loading, the header snapping) move the section, or
          // clamp the position at the end of the page; neither counts.
          const clamped = now >= max - 1;
          const foreign = heading !== 0 && !clamped && Math.sign(now - last) === -heading && Math.abs(now - last) > 2;
          const done = userMoved || foreign || !target || ++checks > 12;
          const settled = now === last;
          last = now;
          if (!done && settled) {
            const reachable = !(delta > 0 && now >= max - 1) && !(delta < 0 && now <= 0);
            if (Math.abs(delta) > 2 && reachable) {
              heading = Math.sign(delta);
              scrollElementTo(target!, offset(), 'auto');
              last = position();
            } else checks = 99;
          }
          if (done || checks >= 99) {
            clearInterval(timer);
            for (const ev of events) container.removeEventListener(ev, stopOnUser);
            lock.current = 0;
            // Keep the chosen section highlighted, also when it cannot reach the top (end of the page).
            if (!userMoved && !foreign) clicked.current = { id: id.split('::sub::')[0]!, position: position() };
            recompute.current();
          }
        }, 100);
      };
      if (pageRef.current) pageRef.current.collapseThen(go);
      else go();
    },
    [scope],
  );
  return { active, scrollTo };
}
