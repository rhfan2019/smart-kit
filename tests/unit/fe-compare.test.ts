// Pure functions of the Fiori elements comparison (docs/30 §7.2, tests/e2e-fe/compare.ts): batch parsing, request
// normalization, the diffs, the deviation register, the baseline and the self-test's metadata change.
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  baselineEntries, canonicalExpand, checkAgainstRegister, diffRequests, diffSnapshots, diffStructure, diffText, feDeviations, mergeBaseline,
  normalizeRequest, parseBatch, removeLineItemDataField, splitTopLevel, stageOf, toMarkdown, type FeDeviation, type Snapshot, type Structure,
} from '../e2e-fe/compare';

const BATCH = [
  '--batch_id-1-132',
  'Content-Type:application/http',
  'Content-Transfer-Encoding:binary',
  '',
  "GET PurchaseOrders?$count=true&$select=Status,PurchaseOrder&$orderby=OrderDate%20desc&$filter=Status%20ne%20'CLOSED'&$expand=_Status($select=Name,Code)&$skip=0&$top=144&sap-client=100 HTTP/1.1",
  'Accept:application/json;odata.metadata=minimal;IEEE754Compatible=true',
  '',
  '',
  '--batch_id-1-132',
  'Content-Type: multipart/mixed; boundary=changeset_1',
  '',
  '--changeset_1',
  'Content-Type:application/http',
  '',
  "PATCH PurchaseOrders('1') HTTP/1.1",
  '',
  '{}',
  '--changeset_1--',
  '--batch_id-1-132--',
].join('\r\n');

const structure = (o: Partial<Structure> = {}): Structure => ({ filterFields: [], columns: [], actions: [], editingStatus: [], viewTabs: [], chartType: '', ...o });

describe('parseBatch', () => {
  it('splits a $batch body into its requests, changesets included', () => {
    expect(parseBatch(BATCH).map((p) => p.method)).toEqual(['GET', 'PATCH']);
    expect(parseBatch(BATCH)[0]!.url).toMatch(/^PurchaseOrders\?\$count=true/);
    expect(parseBatch('')).toEqual([]);
  });
});

describe('normalizeRequest', () => {
  it('keeps the compared options; $skip, sap-* and others are dropped; $select is a sorted set', () => {
    const r = normalizeRequest(parseBatch(BATCH)[0]!.url, '/odata/purchasing/');
    expect(r).toEqual({
      service: '/odata/purchasing/',
      resource: 'PurchaseOrders',
      options: { $count: 'true', $select: 'PurchaseOrder,Status', $orderby: 'OrderDate desc', $filter: "Status ne 'CLOSED'", $expand: '_Status($select=Code,Name)', $top: '144' },
    });
  });

  it('reads the service root from absolute and server-relative URLs', () => {
    expect(normalizeRequest('http://localhost:4401/odata/purchasing/PurchaseOrders?$top=100&$skip=100')).toEqual({ service: '/odata/purchasing/', resource: 'PurchaseOrders', options: { $top: '100' } });
    expect(normalizeRequest('/odata/purchasing-draft/Variants?$filter=PageKey%20eq%20%27po%27')!.options.$filter).toBe("PageKey eq 'po'");
  });

  it('ignores $metadata, $batch, annotation and i18n files and non-OData URLs', () => {
    expect(normalizeRequest('http://x/odata/purchasing/$metadata?sap-language=EN')).toBeUndefined();
    expect(normalizeRequest('http://x/odata/purchasing/$batch')).toBeUndefined();
    expect(normalizeRequest('http://x/odata/purchasing/annotations.xml')).toBeUndefined();
    expect(normalizeRequest('http://x/i18n/i18n.properties')).toBeUndefined();
    expect(normalizeRequest('PurchaseOrders')).toBeUndefined(); // relative without a service root
  });
});

describe('canonicalExpand', () => {
  it('sorts navigation properties and nested $select, drops nested $skip', () => {
    expect(canonicalExpand('_B($select=y,x;$skip=0),_A')).toBe('_A,_B($select=x,y)');
    expect(canonicalExpand('_A($expand=_D,_C($select=b,a);$select=z)')).toBe('_A($expand=_C($select=a,b),_D;$select=z)');
  });

  it('splitTopLevel respects parentheses and quotes', () => {
    expect(splitTopLevel("a(b,c),d,'e,f'", ',')).toEqual(['a(b,c)', 'd', "'e,f'"]);
  });
});

describe('diffRequests', () => {
  const svc = '/odata/purchasing/';
  const list = (options: Record<string, string>) => ({ service: svc, resource: 'PurchaseOrders', options });

  it('equal requests give no difference; $select is compared as a set', () => {
    expect(diffRequests([list({ $select: 'A,B', $top: '10' })], [list({ $select: 'A,B', $top: '10' })])).toEqual([]);
    const d = diffRequests([list({ $select: 'A,B' })], [list({ $select: 'A,C' })]);
    expect(d).toHaveLength(1);
    expect(d[0]).toMatchObject({ kind: 'request', member: '$select' });
    expect(d[0]!.detail).toContain('only in FE: [B]');
    expect(d[0]!.detail).toContain('only in smart-kit: [C]');
  });

  it('pairs the most similar request of a resource and reports the rest as request:<resource>', () => {
    const fe = [list({ $select: 'A', $count: 'true', $top: '144' })];
    const sk = [list({ $apply: 'aggregate(X with sum as X)' }), list({ $select: 'A', $count: 'true', $top: '100' })];
    const d = diffRequests(fe, sk);
    expect(d.map((x) => x.member)).toEqual(['$top', 'request:PurchaseOrders']);
    expect(d[1]!.detail).toContain('only in smart-kit');
    expect(diffRequests([{ service: svc, resource: 'X', options: {} }], [])[0]!.detail).toContain('only in FE');
  });

  it('reports options missing on one side', () => {
    expect(diffRequests([list({ $search: 'abc' })], [list({})])[0]).toMatchObject({ member: '$search', fe: 'abc', sk: undefined });
  });
});

describe('diffStructure and diffText', () => {
  it('reports missing, extra and reordered entries per aspect', () => {
    const d = diffStructure(structure({ columns: ['A', 'B', 'C'], chartType: 'bar' }), structure({ columns: ['B', 'A', 'D'] }));
    expect(d.map((x) => x.member)).toEqual(['columns', 'chartType']);
    expect(d[0]!.detail).toContain('only in FE: [C]');
    expect(d[0]!.detail).toContain('only in smart-kit: [D]');
    expect(d[0]!.detail).toContain('order FE: [A, B] smart-kit: [B, A]');
    expect(diffStructure(structure({ actions: ['X'] }), structure({ actions: ['X'] }))).toEqual([]);
  });

  it('compares cell text of common columns with whitespace normalized', () => {
    const fe = [{ A: '64,360.76\nEUR', B: 'x', OnlyFe: '1' }];
    const sk = [{ A: '64,360.76 EUR', B: 'y' }];
    const d = diffText(fe, sk);
    expect(d.map((x) => x.member)).toEqual(['B']);
    expect(d[0]!.detail).toBe('row 1: FE "x" smart-kit "y"');
    expect(diffText(fe, [])[0]!.member).toBe('rows');
  });

  it('diffSnapshots combines all three kinds', () => {
    const a: Snapshot = { requests: [], structure: structure({ filterFields: ['[search]'] }), text: [{ A: '1' }] };
    const b: Snapshot = { requests: [{ service: '/odata/p/', resource: 'Variants', options: {} }], structure: structure(), text: [{ A: '2' }] };
    expect(diffSnapshots(a, b).map((x) => x.kind)).toEqual(['request', 'structure', 'text']);
  });
});

describe('deviation register and baseline', () => {
  const dev = (o: Partial<FeDeviation>): FeDeviation => ({ module: 'fe:s', kind: 'structure', member: 'columns', category: 'fe-behavior', stage: 4, reason: 'r', ...o });

  it('reads only fe-behavior entries of fe:* modules; a missing file is empty', () => {
    expect(feDeviations(undefined)).toEqual([]);
    expect(feDeviations({ deviations: [dev({}), { ...dev({}), category: 'kit-extension' }, { module: 'v4/fe/macros/Table', category: 'fe-behavior' }] })).toHaveLength(1);
  });

  it('a difference passes only when module, kind and member are registered', () => {
    const diffs = diffStructure(structure({ columns: ['A'], actions: ['X'] }), structure());
    const c = checkAgainstRegister('s', diffs, [dev({}), dev({ member: 'viewTabs' }), dev({ module: 'fe:other', member: 'actions' })]);
    expect(c.registered.map((r) => r.diff.member)).toEqual(['columns']);
    expect(c.unregistered.map((d) => d.member)).toEqual(['actions']);
    expect(c.unused.map((d) => d.member)).toEqual(['viewTabs']);
    expect(toMarkdown('s', { requests: [], structure: structure(), text: [] }, { requests: [], structure: structure(), text: [] }, c)).toContain('| **unregistered** | structure | actions |');
  });

  it('AL-08 an fe:* entry applies to every scenario and is never reported unused', () => {
    const diffs = diffStructure(structure({ columns: ['A'], actions: ['X'] }), structure());
    const c = checkAgainstRegister('s', diffs, [dev({ module: 'fe:*' }), dev({ module: 'fe:*', member: 'actions' }), dev({ module: 'fe:*', member: 'viewTabs' })]);
    expect(c.registered.map((r) => r.diff.member).sort()).toEqual(['actions', 'columns']);
    expect(c.unregistered).toEqual([]);
    expect(c.unused).toEqual([]);
  });

  it('writes one baseline entry per kind and member with a plan stage, and replaces only its scenario', () => {
    const diffs = [
      ...diffStructure(structure({ editingStatus: ['All'], columns: ['A'] }), structure()),
      ...diffRequests([{ service: '/x/', resource: 'S', options: { $top: '1' } }], [{ service: '/x/', resource: 'S', options: { $top: '2' } }]),
    ];
    const entries = baselineEntries('s', diffs);
    expect(entries.map((e) => [e.member, e.stage])).toEqual([['columns', 4], ['editingStatus', 3], ['$top', 5]]);
    expect(entries.every((e) => e.module === 'fe:s' && e.category === 'fe-behavior' && e.reason && !e.id)).toBe(true);
    const merged = mergeBaseline({ deviations: [dev({ module: 'fe:s', member: 'old' }), dev({ module: 'fe:t' })] }, 's', entries);
    expect(merged.deviations.map((d) => `${d.module} ${d.member}`)).toEqual(['fe:s $top', 'fe:s columns', 'fe:s editingStatus', 'fe:t columns']);
  });

  it('stageOf: draft list and totals are P1 (stage 3)', () => {
    expect(stageOf({ kind: 'request', member: '$filter', detail: 'IsActiveEntity eq true' }, 'po-draft-list-initial')).toBe(3);
    expect(stageOf({ kind: 'request', member: 'request:PurchaseOrders', detail: 'aggregate(NetAmount with sum as NetAmount)' }, 'po')).toBe(3);
    expect(stageOf({ kind: 'text', member: 'Status', detail: '' }, 'po')).toBe(4);
  });
});

describe('self-test metadata change and the FE proxy patch', () => {
  const XML = `<Annotations Target="P.Order">
        <Annotation Term="UI.LineItem">
          <Collection>
            <Record Type="UI.DataField"><PropertyValue Property="Value" Path="Id"/></Record>
            <Record Type="UI.DataField"><PropertyValue Property="Value" Path="Date"/><Annotation Term="UI.Importance" EnumMember="UI.ImportanceType/Medium"/></Record>
            <Record Type="UI.DataField"><PropertyValue Property="Value" Path="Amount"/></Record>
          </Collection>
        </Annotation>
        <Annotation Term="UI.LineItem" Qualifier="Q">
          <Collection><Record Type="UI.DataField"><PropertyValue Property="Value" Path="Date"/></Record></Collection>
        </Annotation>
      </Annotations>`;

  it('removeLineItemDataField removes one DataField from the unqualified LineItem only', () => {
    const out = removeLineItemDataField(XML, 'P.Order', 'Date');
    expect(out.match(/Path="Date"/g)).toHaveLength(1); // the qualified LineItem keeps it
    expect(out).toContain('Path="Id"');
    expect(out).toContain('Path="Amount"');
    expect(removeLineItemDataField(XML, 'P.Other', 'Date')).toBe(XML);
  });

  it('addSiblingEntity adds SiblingEntity to draft entity types once', async () => {
    const { addSiblingEntity } = (await import(pathToFileURL(join(import.meta.dirname, '../../apps/fe-reference/metadata.mjs')).href)) as { addSiblingEntity(xml: string): string };
    const xml = `<EntityType Name="Order"><Key/><NavigationProperty Name="DraftAdministrativeData" Type="P.DraftAdministrativeData"/></EntityType>
      <EntityType Name="DraftAdministrativeData"><Property Name="DraftUUID"/></EntityType>
      <EntityType Name="Plain"><Property Name="X"/></EntityType>`;
    const once = addSiblingEntity(xml);
    expect(once).toContain('<NavigationProperty Name="SiblingEntity" Type="P.Order"/>');
    expect(once.match(/SiblingEntity/g)).toHaveLength(1);
    expect(addSiblingEntity(once)).toBe(once);
  });
});
