// AL-31 (docs/32, stage 7): after the alignment the deviation register only holds kit-extension, react-idiom and
// no-binding entries, plus entries kept by a recorded decision (`decision: "Dxx"`, the Dxx being in docs/12).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(import.meta.dirname, '../..');
const deviations: { id: string; category: string; reason: string; decision?: string }[] = JSON.parse(readFileSync(join(ROOT, 'tools/ui5-alignment/deviations.json'), 'utf8')).deviations;
const log = readFileSync(join(ROOT, 'docs/12-discussion-log.md'), 'utf8');
const ALLOWED = new Set(['kit-extension', 'react-idiom', 'no-binding']);

describe('the deviation register after stage 7', () => {
  it('AL-31 every deviation is kit-extension, react-idiom, no-binding or kept by a recorded decision', () => {
    const open = deviations.filter((d) => !ALLOWED.has(d.category) && !d.decision).map((d) => `${d.id} (${d.category})`);
    expect(open).toEqual([]);
  });

  it('AL-31 every decision names a discussion log entry, and every deviation has a reason', () => {
    const decisions = new Set(deviations.map((d) => d.decision).filter(Boolean));
    for (const dx of decisions) expect(log, `${dx} in docs/12`).toMatch(new RegExp(`^## ${dx} `, 'm'));
    expect(deviations.filter((d) => !d.reason?.trim()).map((d) => d.id)).toEqual([]);
  });

  it('AL-31 the ids are unique', () => {
    const ids = deviations.map((d) => d.id);
    expect(ids.length).toBe(new Set(ids).size);
  });
});
