// Self-test of the UI5 API check (docs/30 §7.1, AL-20): deliberately wrong property names, defaults and event
// parameters must be reported; registered deviations must be accepted and fixed ones reported as stale.
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = join(import.meta.dirname, '../..');
const FIXTURES = join(import.meta.dirname, 'fixtures/ui5-check');

interface Finding { kind: string; member: string; module?: string }
interface CompareModule {
  compareExport(entry: object, ui5: object, kit: object, where: object): Finding[];
  matchDeviations(findings: Finding[], deviations: object[]): { registered: Finding[]; unregistered: Finding[]; stale: { id: string }[] };
  kitModuleOf(m: string): string | undefined;
}
interface KitModule {
  createProgramFor(files: string[]): { program: unknown; checker: unknown };
  moduleExports(ctx: unknown, file: string): Map<string, unknown>;
  describeExport(ctx: unknown, sym: unknown, opts: { name: string }): object;
}
const load = async <T,>(rel: string): Promise<T> => (await import(pathToFileURL(join(ROOT, rel)).href)) as T;

// a hand-made UI5 description (names and defaults only), in the shape of scripts/ui5/ui5-model.mjs
const UI5 = {
  name: 'sap.m.Aligned', kind: 'class', module: 'sap/m/Aligned', basename: 'Aligned', deprecated: false,
  properties: [{ name: 'text', defaultValue: '' }, { name: 'type', defaultValue: 'Information' }, { name: 'showIcon', defaultValue: false }],
  aggregations: [], associations: [], defaultAggregation: undefined,
  events: [{ name: 'itemSelect', params: ['item', 'messageTypeFilter'], allowPreventDefault: false }],
  methods: [{ name: 'close', static: false }], staticMembers: [], enumValues: [],
};
const ENTRY = { module: 'm/Aligned', export: 'default', ui5: 'sap.m.Aligned' };

async function check(fixture: string): Promise<Finding[]> {
  const cmp = await load<CompareModule>('scripts/ui5/compare.mjs');
  const kit = await load<KitModule>('scripts/ui5/kit-model.mjs');
  const file = join(FIXTURES, `${fixture}.tsx`);
  const ctx = kit.createProgramFor([file]);
  const ex = kit.moduleExports(ctx, file);
  const desc = kit.describeExport(ctx, ex.get('default'), { name: 'Aligned' });
  return cmp.compareExport(ENTRY, UI5, desc, { atTarget: true, typeExports: new Set(ex.keys()), exportName: 'Aligned' });
}

describe('check:ui5 self-test (AL-20)', () => {
  it('AL-20 an aligned component has no differences', async () => {
    expect(await check('Aligned')).toEqual([]);
  }, 30_000);

  it('AL-20 reports a renamed property', async () => {
    const f = await check('Renamed');
    expect(f).toContainEqual(expect.objectContaining({ kind: 'property', member: 'showIcon' }));
    expect(f).toContainEqual(expect.objectContaining({ kind: 'extra-property', member: 'showIcons' }));
  }, 30_000);

  it('AL-20 reports a wrong default value', async () => {
    expect(await check('WrongDefault')).toContainEqual(expect.objectContaining({ kind: 'default-value', member: 'type' }));
  }, 30_000);

  it('AL-20 reports a wrong event parameter', async () => {
    const f = await check('WrongEventParam');
    expect(f).toContainEqual(expect.objectContaining({ kind: 'event-param', member: 'itemSelect.messageTypeFilter' }));
    expect(f).toContainEqual(expect.objectContaining({ kind: 'extra-event-param', member: 'itemSelect.filter' }));
  }, 30_000);

  it('AL-20 accepts registered differences and reports unregistered and stale ones', async () => {
    const cmp = await load<CompareModule>('scripts/ui5/compare.mjs');
    const findings = [{ module: 'm/A', kind: 'property', member: 'x' }, { module: 'm/A', kind: 'property', member: 'y' }, { module: 'm/B', kind: 'extra-property', member: 'className' }];
    const r = cmp.matchDeviations(findings, [
      { id: 'DV-1', module: 'm/A', kind: 'property', member: 'x' },
      { id: 'DV-2', module: 'm/A', kind: 'event', member: 'gone' },
      { id: 'DV-G', module: '*', kind: 'extra-property', member: 'className' },
      // manifest settings entries are matched by scripts/check-manifest-settings.mjs, never stale here
      { id: 'DV-M', module: 'v4/fe/templates/ListReport', kind: 'manifest-missing', member: 'inlineEdit' },
    ]);
    expect(r.registered.map((x) => x.member)).toEqual(['x', 'className']);
    expect(r.unregistered.map((x) => x.member)).toEqual(['y']);
    expect(r.stale.map((d) => d.id)).toEqual(['DV-2']);
  });

  it('AL-02 module paths only change the prefix; sap.fe.* gets v4', async () => {
    const cmp = await load<CompareModule>('scripts/ui5/compare.mjs');
    expect(cmp.kitModuleOf('sap/m/MessageBox')).toBe('m/MessageBox');
    expect(cmp.kitModuleOf('sap/fe/macros/Table')).toBe('v4/fe/macros/Table');
    expect(cmp.kitModuleOf('sap/ui/core/library')).toBe('ui/core/library');
  });
});
