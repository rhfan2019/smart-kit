/** Recursive hierarchies (docs/26 §3.10, docs/27 UE-80–UE-83): model, TopLevels request, MemoryProvider. */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildHierarchyRequest, buildModel, hierarchyNodeOf, hierarchyOf, MemoryProvider, ODataV4Provider, toQueryString, type Row } from '../src';

const model = buildModel(readFileSync(join(import.meta.dirname, 'fixtures/tree.xml'), 'utf8'));
const ui = model.ui['Org.Unit']!;
const units = (): Row[] => [
  { ID: 'A', Name: 'Alpha', ParentID: null, LineID: null, Headcount: 10 },
  { ID: 'A1', Name: 'Alpha One', ParentID: 'A', LineID: 'B', Headcount: 4 },
  { ID: 'A1a', Name: 'Alpha One A', ParentID: 'A1', LineID: null, Headcount: 2 },
  { ID: 'A1b', Name: 'Alpha One B', ParentID: 'A1', LineID: null, Headcount: 2 },
  { ID: 'A2', Name: 'Alpha Two', ParentID: 'A', LineID: null, Headcount: 6 },
  { ID: 'B', Name: 'Beta', ParentID: null, LineID: null, Headcount: 3 },
  { ID: 'B1', Name: 'Beta One', ParentID: 'B', LineID: null, Headcount: 3 },
];
const source = { entitySet: 'Units' };
const request = (o: Partial<Parameters<typeof buildHierarchyRequest>[2]> = {}) => buildHierarchyRequest(model, ui, { source, columns: ui.lineItem, ...o });
const tree = (rows: Row[]) => rows.map((r) => `${'.'.repeat(Number(r.DistanceFromRoot))}${String(r.ID)} ${String(r.DrillState)} ${String(r.LimitedDescendantCount)}`);

describe('recursive hierarchy model (UE-80)', () => {
  it('UE-80 Aggregation.RecursiveHierarchy and Hierarchy.RecursiveHierarchy with the same qualifier', () => {
    expect(model.entityTypes['Org.Unit']!.hierarchies).toEqual([
      { qualifier: 'Org', nodeProperty: 'ID', parentNavigation: '_Parent', parentProperty: 'ParentID', drillState: 'DrillState', distanceFromRoot: 'DistanceFromRoot', limitedDescendantCount: 'LimitedDescendantCount', matched: 'Matched', paired: true },
      { qualifier: 'Line', nodeProperty: 'ID', parentNavigation: '_Line', parentProperty: 'LineID', drillState: 'DrillState', distanceFromRoot: 'DistanceFromRoot', paired: true },
    ]);
    expect(hierarchyOf(model, 'Org.Unit')?.qualifier).toBe('Org');
    expect(hierarchyOf(model, 'Org.Unit', 'Line')?.parentNavigation).toBe('_Line');
    expect(hierarchyOf(model, 'Org.Unit', 'Nope')).toBeUndefined();
    // types without a hierarchy keep their shape (no `hierarchies` key)
    expect('hierarchies' in model.entityTypes['Org.Flat']!).toBe(false);
    expect(hierarchyOf(model, 'Org.Flat')).toBeUndefined();
  });

  it('UE-80 node state of a result row: DistanceFromRoot as string (IEEE754Compatible), unknown drill state is a leaf', () => {
    const h = hierarchyOf(model, 'Org.Unit')!;
    expect(hierarchyNodeOf(h, { ID: 'A1', DistanceFromRoot: '1', DrillState: 'collapsed', LimitedDescendantCount: '0' })).toEqual({ id: 'A1', level: 1, drillState: 'collapsed', descendants: 0 });
    expect(hierarchyNodeOf(h, { ID: 'X' })).toEqual({ id: 'X', level: 0, drillState: 'leaf', descendants: undefined });
  });
});

describe('TopLevels request (UE-81, UE-82)', () => {
  it('UE-81 first level, the node id and the hierarchy properties selected, no paging and no $count', () => {
    const req = request();
    expect(req.hierarchy).toEqual({ qualifier: 'Org', nodeProperty: 'ID', levels: 1 });
    expect(req.select).toEqual(expect.arrayContaining(['ID', 'Name', 'Headcount', 'DrillState', 'DistanceFromRoot', 'LimitedDescendantCount']));
    expect(req).toMatchObject({ skip: undefined, top: undefined, count: false });
    expect(decodeURIComponent(toQueryString(model, req))).toBe(
      "$apply=com.sap.vocabularies.Hierarchy.v1.TopLevels(HierarchyNodes=$root/Units,HierarchyQualifier='Org',NodeProperty='ID',Levels=1)"
      + '&$select=ID,Name,Headcount,DrillState,DistanceFromRoot,LimitedDescendantCount',
    );
  });

  it('UE-81 expanded and collapsed nodes go into ExpandLevels; another qualifier; ODataV4Provider sends it unchanged', () => {
    const req = request({ qualifier: 'Line', levels: 2, expandLevels: [{ nodeId: "A'1", levels: 1 }, { nodeId: 'B', levels: 0 }, { nodeId: 'C', levels: null }] });
    const qs = decodeURIComponent(toQueryString(model, req));
    expect(qs).toContain("TopLevels(HierarchyNodes=$root/Units,HierarchyQualifier='Line',NodeProperty='ID',Levels=2,ExpandLevels=[{\"NodeID\":\"A'1\",\"Levels\":1},{\"NodeID\":\"B\",\"Levels\":0},{\"NodeID\":\"C\",\"Levels\":null}])");
    const odata = new ODataV4Provider({ serviceUrl: '/svc/', model, fetch: async () => { throw new Error('unused'); } });
    expect(odata.queryUrl(req)).toBe(`/svc/Units?${toQueryString(model, req)}`);
    expect(() => buildHierarchyRequest(model, model.ui['Org.Flat']!, { source: { entitySet: 'Flats' }, columns: [] })).toThrow(/no recursive hierarchy/);
  });

  it('UE-82 filters and search keep the matching nodes with their ancestors; the sort orders siblings before TopLevels', () => {
    const req = request({ filters: { Headcount: [{ operator: 'GE', values: [4] }] }, search: 'one', sort: [{ path: 'Name', descending: true }] });
    expect(decodeURIComponent(toQueryString(model, req))).toMatch(
      /^\$apply=ancestors\(\$root\/Units,Org,ID,filter\(Headcount ge 4\)\/search\(one\),keep start\)\/orderby\(Name desc\)\/com\.sap\.vocabularies\.Hierarchy\.v1\.TopLevels\(/,
    );
  });
});

describe('MemoryProvider TopLevels (UE-83)', () => {
  const provider = () => new MemoryProvider({ model, data: { Units: units() } });

  it('UE-83 roots, Levels, ExpandLevels 1 / 0 / null with DrillState, DistanceFromRoot and LimitedDescendantCount', async () => {
    const p = provider();
    expect(tree((await p.query(request())).rows)).toEqual(['A collapsed 0', 'B collapsed 0']);
    expect(tree((await p.query(request({ expandLevels: [{ nodeId: 'A', levels: 1 }] }))).rows)).toEqual(['A expanded 2', '.A1 collapsed 0', '.A2 leaf 0', 'B collapsed 0']);
    expect(tree((await p.query(request({ levels: 3, expandLevels: [{ nodeId: 'A1', levels: 0 }] }))).rows)).toEqual(['A expanded 2', '.A1 collapsed 0', '.A2 leaf 0', 'B expanded 1', '.B1 leaf 0']);
    expect(tree((await p.query(request({ expandLevels: [{ nodeId: 'A', levels: null }] }))).rows)).toEqual(['A expanded 4', '.A1 expanded 2', '..A1a leaf 0', '..A1b leaf 0', '.A2 leaf 0', 'B collapsed 0']);
    // the rows are projections: the stored rows get no hierarchy properties
    expect(units()[0]).not.toHaveProperty('DrillState');
  });

  it('UE-83 filters and search: matching nodes and their ancestors (Matched), siblings sorted; another hierarchy', async () => {
    const p = provider();
    const filtered = await p.query(request({ levels: 3, filters: { Name: [{ operator: 'EQ', values: ['Alpha One B'] }] } }));
    expect(tree(filtered.rows)).toEqual(['A expanded 2', '.A1 expanded 1', '..A1b leaf 0']);
    expect(filtered.rows.map((r) => r.Matched)).toEqual([false, false, true]);
    expect(tree((await p.query(request({ search: 'two' }))).rows)).toEqual(['A collapsed 0']);
    const sorted = await p.query(request({ levels: 2, sort: [{ path: 'Name', descending: true }] }));
    expect(tree(sorted.rows)).toEqual(['B expanded 1', '.B1 leaf 0', 'A expanded 2', '.A2 leaf 0', '.A1 collapsed 0']);
    const line = await p.query(request({ qualifier: 'Line', levels: 2 }));
    expect(line.rows.map((r) => `${'.'.repeat(Number(r.DistanceFromRoot))}${String(r.ID)}`)).toEqual(['A', 'A1a', 'A1b', 'A2', 'B', '.A1', 'B1']);
  });
});
