/** Reading tokens in JS (charts, avatars). Re-reads when data-theme / data-density changes. */
import { useEffect, useState } from 'react';

export function readToken(name: string, el?: Element | null): string {
  if (typeof getComputedStyle === 'undefined') return '';
  const target = el ?? (typeof document === 'undefined' ? null : document.documentElement);
  return target ? getComputedStyle(target).getPropertyValue(name).trim() : '';
}

/** Returns the computed values of `names`, updated when a theme or density attribute changes anywhere in the document. */
export function useThemeTokens<const T extends readonly string[]>(names: T): Record<T[number], string> {
  const read = () => Object.fromEntries(names.map((n) => [n, readToken(n)])) as Record<T[number], string>;
  const [values, setValues] = useState(read);
  useEffect(() => {
    if (typeof MutationObserver === 'undefined' || typeof document === 'undefined') return;
    const obs = new MutationObserver(() => setValues(read()));
    obs.observe(document.documentElement, { attributes: true, subtree: true, attributeFilter: ['data-theme', 'data-density'] });
    return () => obs.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- names are a static list
  }, []);
  return values;
}
