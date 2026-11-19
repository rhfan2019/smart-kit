import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => cleanup());

// GitHub runners are slow under the parallel test files: give findBy* / waitFor more time there (D49)
if (process.env.CI) configure({ asyncUtilTimeout: 5000 });

// jsdom lacks these browser APIs used by Mantine and the building blocks.
if (!window.matchMedia) {
  window.matchMedia = (query: string) => ({ matches: false, media: query, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false }) as MediaQueryList;
}
class RO { observe() {} unobserve() {} disconnect() {} }
(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver ??= RO;
class IO { constructor(private cb: IntersectionObserverCallback) {} observe(el: Element) { this.cb([{ isIntersecting: true, target: el, boundingClientRect: el.getBoundingClientRect() } as IntersectionObserverEntry], this as unknown as IntersectionObserver); } unobserve() {} disconnect() {} takeRecords() { return []; } }
(globalThis as unknown as { IntersectionObserver: unknown }).IntersectionObserver ??= IO;
Element.prototype.scrollIntoView ??= function scrollIntoView() {};
window.scrollTo ??= () => {};
