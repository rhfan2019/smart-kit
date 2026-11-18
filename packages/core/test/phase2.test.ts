/** Phase 2 (docs/13): annotation terms, writes, edit strategies, messages, aggregation. */
import { describe, expect, it } from 'vitest';
import {
  buildAggregateRequest, buildModel, ConcurrencyError, createMessage, DirectEditStrategy, DraftEditStrategy, editStrategyFor, highestSeverity, MemoryProvider,
  messagesFromError, messagesFromHeader, ODataError, ODataV4Provider, siblingPath, toQueryString, type DataProvider, type FetchLike, type Row,
} from '../src';

const doc = (body: string, container: string, annotations: string) => `<?xml version="1.0"?>
<edmx:Edmx Version="4.0" xmlns:edmx="http://docs.oasis-open.org/odata/ns/edmx">
  <edmx:Reference Uri="u"><edmx:Include Namespace="com.sap.vocabularies.UI.v1" Alias="UI"/></edmx:Reference>
  <edmx:Reference Uri="c"><edmx:Include Namespace="com.sap.vocabularies.Common.v1" Alias="Common"/></edmx:Reference>
  <edmx:Reference Uri="k"><edmx:Include Namespace="Org.OData.Capabilities.V1" Alias="Capabilities"/></edmx:Reference>
  <edmx:Reference Uri="o"><edmx:Include Namespace="Org.OData.Core.V1" Alias="Core"/></edmx:Reference>
  <edmx:DataServices><Schema xmlns="http://docs.oasis-open.org/odata/ns/edm" Namespace="T">${body}<EntityContainer Name="C">${container}</EntityContainer>${annotations}</Schema></edmx:DataServices>
</edmx:Edmx>`;

const types = `
<EntityType Name="Order"><Key><PropertyRef Name="ID"/></Key>
  <Property Name="ID" Type="Edm.String" Nullable="false"/>
  <Property Name="PartnerID" Type="Edm.String"/>
  <Property Name="Status" Type="Edm.String"/>
  <Property Name="Amount" Type="Edm.Decimal" Scale="2"/>
  <Property Name="Budget" Type="Edm.Decimal" Scale="2"/>
  <Property Name="Note" Type="Edm.String"/>
  <Property Name="CanApprove" Type="Edm.Boolean"/>
  <NavigationProperty Name="Partner" Type="T.Partner"><ReferentialConstraint Property="PartnerID" ReferencedProperty="ID"/></NavigationProperty>
  <NavigationProperty Name="Items" Type="Collection(T.Item)"/>
</EntityType>
<EntityType Name="Item"><Key><PropertyRef Name="OrderID"/><PropertyRef Name="Pos"/></Key>
  <Property Name="OrderID" Type="Edm.String" Nullable="false"/><Property Name="Pos" Type="Edm.Int32" Nullable="false"/><Property Name="Qty" Type="Edm.Decimal"/>
</EntityType>
<EntityType Name="Partner"><Key><PropertyRef Name="ID"/></Key><Property Name="ID" Type="Edm.String" Nullable="false"/><Property Name="Name" Type="Edm.String"/><Property Name="Rating" Type="Edm.Decimal"/><Property Name="Votes" Type="Edm.Int32"/></EntityType>
<Action Name="approve" IsBound="true"><Parameter Name="_it" Type="T.Order"/><ReturnType Type="T.Order"/></Action>
<Action Name="close" IsBound="true"><Parameter Name="_it" Type="T.Order"/><Parameter Name="Reason" Type="Edm.String"/><ReturnType Type="T.Order"/></Action>`;
const container = `<EntitySet Name="Orders" EntityType="T.Order"><NavigationPropertyBinding Path="Partner" Target="Partners"/><NavigationPropertyBinding Path="Items" Target="Items"/></EntitySet>
<EntitySet Name="Items" EntityType="T.Item"/><EntitySet Name="Partners" EntityType="T.Partner"/>`;
const annotations = `
<Annotations Target="T.approve(T.Order)"><Annotation Term="Core.OperationAvailable" Path="_it/CanApprove"/></Annotations>
<Annotations Target="T.Order/PartnerID"><Annotation Term="Common.Text" Path="Partner/Name"/><Annotation Term="Common.FieldControl" EnumMember="Common.FieldControlType/Mandatory"/></Annotations>
<Annotations Target="T.Order/Budget"><Annotation Term="Common.FieldControl" EnumMember="Common.FieldControlType/ReadOnly"/></Annotations>
<Annotations Target="T.Order/Note"><Annotation Term="UI.MultiLineText" Bool="true"/></Annotations>
<Annotations Target="T.Partner">
  <Annotation Term="UI.HeaderInfo"><Record><PropertyValue Property="TypeName" String="Partner"/><PropertyValue Property="TypeNamePlural" String="Partners"/><PropertyValue Property="Title"><Record Type="UI.DataField"><PropertyValue Property="Value" Path="Name"/></Record></PropertyValue></Record></Annotation>
  <Annotation Term="UI.FieldGroup" Qualifier="QV"><Record><PropertyValue Property="Data"><Collection><Record Type="UI.DataField"><PropertyValue Property="Value" Path="Rating"/></Record></Collection></PropertyValue></Record></Annotation>
  <Annotation Term="UI.QuickViewFacets"><Collection><Record Type="UI.ReferenceFacet"><PropertyValue Property="Target" AnnotationPath="@UI.FieldGroup#QV"/></Record></Collection></Annotation>
  <Annotation Term="UI.DataPoint" Qualifier="Rating"><Record><PropertyValue Property="Value" Path="Rating"/><PropertyValue Property="TargetValue" Int="5"/><PropertyValue Property="SampleSize" Path="Votes"/><PropertyValue Property="Visualization" EnumMember="UI.VisualizationType/Rating"/></Record></Annotation>
</Annotations>
<Annotations Target="T.Item">
  <Annotation Term="UI.Chart" Qualifier="Qty"><Record><PropertyValue Property="ChartType" EnumMember="UI.ChartType/Line"/><PropertyValue Property="Dimensions"><Collection><PropertyPath>Pos</PropertyPath></Collection></PropertyValue><PropertyValue Property="Measures"><Collection><PropertyPath>Qty</PropertyPath></Collection></PropertyValue></Record></Annotation>
</Annotations>
<Annotations Target="T.Order">
  <Annotation Term="UI.LineItem"><Collection>
    <Record Type="UI.DataField"><PropertyValue Property="Value" Path="ID"/><Annotation Term="UI.Importance" EnumMember="UI.ImportanceType/High"/></Record>
    <Record Type="UI.DataField"><PropertyValue Property="Value" Path="PartnerID"/></Record>
    <Record Type="UI.DataField"><PropertyValue Property="Value" Path="Status"/><Annotation Term="UI.Importance" EnumMember="UI.ImportanceType/Low"/></Record>
    <Record Type="UI.DataFieldForAction"><PropertyValue Property="Label" String="Approve"/><PropertyValue Property="Action" String="T.approve"/></Record>
    <Record Type="UI.DataFieldForAction"><PropertyValue Property="Label" String="Close"/><PropertyValue Property="Action" String="T.close"/><PropertyValue Property="Inline" Bool="true"/></Record>
  </Collection></Annotation>
  <Annotation Term="UI.LineItem" Qualifier="Short"><Collection><Record Type="UI.DataField"><PropertyValue Property="Value" Path="ID"/></Record></Collection></Annotation>
  <Annotation Term="UI.Identification"><Collection><Record Type="UI.DataFieldForAction"><PropertyValue Property="Label" String="Approve"/><PropertyValue Property="Action" String="T.approve"/><PropertyValue Property="Determining" Bool="true"/></Record></Collection></Annotation>
  <Annotation Term="UI.Chart" Qualifier="ByStatus"><Record><PropertyValue Property="Title" String="By status"/><PropertyValue Property="ChartType" EnumMember="UI.ChartType/Column"/><PropertyValue Property="Dimensions"><Collection><PropertyPath>Status</PropertyPath></Collection></PropertyValue><PropertyValue Property="Measures"><Collection><PropertyPath>Amount</PropertyPath></Collection></PropertyValue></Record></Annotation>
  <Annotation Term="UI.DataPoint" Qualifier="Budget"><Record><PropertyValue Property="Value" Path="Amount"/><PropertyValue Property="TargetValue" Path="Budget"/><PropertyValue Property="MinimumValue" Int="0"/></Record></Annotation>
  <Annotation Term="UI.Chart" Qualifier="Bullet"><Record><PropertyValue Property="ChartType" EnumMember="UI.ChartType/Bullet"/><PropertyValue Property="Measures"><Collection><PropertyPath>Amount</PropertyPath></Collection></PropertyValue>
    <PropertyValue Property="MeasureAttributes"><Collection><Record Type="UI.ChartMeasureAttributeType"><PropertyValue Property="Measure" PropertyPath="Amount"/><PropertyValue Property="DataPoint" AnnotationPath="@UI.DataPoint#Budget"/></Record></Collection></PropertyValue></Record></Annotation>
  <Annotation Term="UI.FieldGroup" Qualifier="Note"><Record><PropertyValue Property="Data"><Collection><Record Type="UI.DataField"><PropertyValue Property="Value" Path="Note"/></Record></Collection></PropertyValue></Record></Annotation>
  <Annotation Term="UI.HeaderFacets"><Collection>
    <Record Type="UI.ReferenceFacet"><PropertyValue Property="ID" String="HBullet"/><PropertyValue Property="Target" AnnotationPath="@UI.Chart#Bullet"/></Record>
    <Record Type="UI.ReferenceFacet"><PropertyValue Property="ID" String="HLine"/><PropertyValue Property="Target" AnnotationPath="Items/@UI.Chart#Qty"/></Record>
    <Record Type="UI.ReferenceFacet"><PropertyValue Property="ID" String="HNote"/><PropertyValue Property="Label" String="Note"/><PropertyValue Property="Target" AnnotationPath="@UI.FieldGroup#Note"/></Record>
    <Record Type="UI.ReferenceFacet"><PropertyValue Property="ID" String="HRating"/><PropertyValue Property="Target" AnnotationPath="Partner/@UI.DataPoint#Rating"/></Record>
  </Collection></Annotation>
  <Annotation Term="UI.SelectionPresentationVariant" Qualifier="Open"><Record><PropertyValue Property="Text" String="Open"/>
    <PropertyValue Property="SelectionVariant"><Record><PropertyValue Property="SelectOptions"><Collection><Record><PropertyValue Property="PropertyName" PropertyPath="Status"/><PropertyValue Property="Ranges"><Collection><Record><PropertyValue Property="Sign" EnumMember="UI.SelectionRangeSignType/I"/><PropertyValue Property="Option" EnumMember="UI.SelectionRangeOptionType/EQ"/><PropertyValue Property="Low" String="OPEN"/></Record></Collection></PropertyValue></Record></Collection></PropertyValue></Record></PropertyValue>
    <PropertyValue Property="PresentationVariant"><Record><PropertyValue Property="Visualizations"><Collection><AnnotationPath>@UI.LineItem#Short</AnnotationPath><AnnotationPath>@UI.Chart#ByStatus</AnnotationPath></Collection></PropertyValue></Record></PropertyValue>
  </Record></Annotation>
  <Annotation Term="UI.SelectionPresentationVariant" Qualifier="All"><Record><PropertyValue Property="Text" String="All"/><PropertyValue Property="PresentationVariant"><Record><PropertyValue Property="Visualizations"><Collection><AnnotationPath>@UI.LineItem</AnnotationPath></Collection></PropertyValue></Record></PropertyValue></Record></Annotation>
</Annotations>
<Annotations Target="T.C/Orders"><Annotation Term="Capabilities.InsertRestrictions"><Record><PropertyValue Property="Insertable" Bool="true"/></Record></Annotation></Annotations>`;

const model = buildModel(doc(types, container, annotations));
const ui = model.ui['T.Order']!;

describe('phase 2 annotation terms (docs/02 §8, P2-GEN-06)', () => {
  it('ANN-80 UI.DataFieldForAction with Core.OperationAvailable, Inline and parameters (P2-LRA-02, P2-LRA-03)', () => {
    expect(ui.actions.map((a) => [a.id, a.inline, a.bound])).toEqual([['DataFieldForAction::T.approve', false, true], ['DataFieldForAction::T.close', true, true]]);
    expect(ui.actions[0]!.operationAvailable).toEqual({ path: 'CanApprove' });
    expect(ui.actions[1]!.parameters).toEqual([{ name: 'Reason', edmType: 'Edm.String', label: 'Reason', nullable: true }]);
    expect(ui.lineItem.map((c) => c.id)).not.toContain('DataFieldForAction::T.approve');
  });

  it('ANN-81 UI.Identification determining actions go to the footer (P2-OP-26)', () => {
    expect(ui.objectActions).toHaveLength(1);
    expect(ui.objectActions[0]).toMatchObject({ action: 'T.approve', determining: true });
  });

  it('ANN-82 UI.Chart: dimensions, measures, measure data points (P2-LR-04, P2-OP-04)', () => {
    expect(ui.charts.ByStatus).toMatchObject({ chartType: 'Column', dimensions: ['Status'], measures: ['Amount'], title: 'By status' });
    expect(ui.charts.Bullet!.dataPoints.Amount).toMatchObject({ value: 'Amount', targetValue: { path: 'Budget' }, minimumValue: { value: 0 } });
  });

  it('ANN-83 header micro chart facets (own entity and collection navigation) and plain text facets (P2-OP-03, P2-OP-04)', () => {
    const kinds = ui.headerFacets.map((f) => [f.id, f.kind]);
    expect(kinds).toEqual([['HBullet', 'chart'], ['HLine', 'chart'], ['HNote', 'text'], ['HRating', 'dataPoint']]);
    const line = ui.headerFacets[1]!;
    expect(line.kind === 'chart' && line.chart).toMatchObject({ navigation: 'Items', typeName: 'T.Item', chartType: 'Line' });
  });

  it('ANN-84 UI.DataPoint SampleSize makes an aggregated rating (P2-OP-06)', () => {
    const r = ui.headerFacets[3]!;
    expect(r.kind === 'dataPoint' && r.dataPoint.sampleSize).toEqual({ path: 'Partner/Votes' });
  });

  it('ANN-85 qualified UI.SelectionPresentationVariant are views with their LineItem and chart (P2-LR-01)', () => {
    expect(ui.views.map((v) => v.id)).toEqual(['Open', 'All']);
    expect(ui.views[0]).toMatchObject({ text: 'Open', conditions: [{ path: 'Status', operator: 'EQ', values: ['OPEN'], exclude: false }] });
    expect(ui.views[0]!.lineItem.map((c) => c.path)).toEqual(['ID']);
    expect(ui.views[0]!.chart?.id).toBe('ByStatus');
    // the inline action is a column of its own (FE Columns _isValidColumn, stage 4)
    expect(ui.views[1]!.lineItem.map((c) => c.path ?? c.id)).toEqual(['ID', 'PartnerID', 'Status', 'DataFieldForAction::T.close']);
  });

  it('ANN-86 UI.QuickViewFacets: fields that refer to the object open a quick view (P2-LR-13)', () => {
    expect(model.ui['T.Partner']!.quickView?.[0]?.fields.map((f) => f.path)).toEqual(['Rating']);
    expect(ui.lineItem.find((c) => c.path === 'PartnerID')!.quickView).toEqual({ navigation: 'Partner', typeName: 'T.Partner' });
    expect(ui.lineItem.find((c) => c.path === 'ID')!.quickView).toBeUndefined();
  });

  it('ANN-87 UI.Importance on records (P2-LR-09, P2-OP-10)', () => {
    expect(ui.lineItem.map((c) => c.importance)).toEqual(['High', undefined, 'Low', undefined]);
  });

  it('ANN-88 Common.FieldControl Mandatory and ReadOnly constants (P2-OP-16, P2-LR-15)', () => {
    const props = model.entityTypes['T.Order']!.properties;
    expect(props.PartnerID!.mandatory).toBe(true);
    expect(props.Budget!.readOnly).toBe(true);
    expect(props.Status!.mandatory).toBe(false);
  });

  it('ANN-89 Common.DraftRoot / DraftNode with their actions (P2-OP-18)', () => {
    const m = buildModel(doc(types, container, `<Annotations Target="T.C/Orders"><Annotation Term="Common.DraftRoot"><Record><PropertyValue Property="ActivationAction" String="T.draftActivate"/><PropertyValue Property="EditAction" String="T.draftEdit"/><PropertyValue Property="PreparationAction" String="T.draftPrepare"/></Record></Annotation></Annotations>
      <Annotations Target="T.C/Items"><Annotation Term="Common.DraftNode"><Record><PropertyValue Property="PreparationAction" String="T.draftPrepare"/></Record></Annotation></Annotations>`));
    expect(m.entitySets.Orders!.draft).toEqual({ root: true, activationAction: 'T.draftActivate', editAction: 'T.draftEdit', preparationAction: 'T.draftPrepare', discardAction: undefined, newAction: undefined });
    expect(m.entitySets.Items!.draft?.root).toBe(false);
  });
});

describe('aggregation for charts (ADR-021)', () => {
  it('P2-LR-04 builds $apply with filter() before groupby and texts of the dimension', () => {
    const req = buildAggregateRequest(model, ui.charts.ByStatus!, { source: { entitySet: 'Orders' }, filters: { PartnerID: [{ operator: 'EQ', values: ['P1'] }] } });
    expect(decodeURIComponent(toQueryString(model, req))).toBe("$apply=filter(PartnerID eq 'P1')/groupby((Status),aggregate(Amount with sum as Amount))&$orderby=Status");
  });

  it('P2-LR-04 the memory provider aggregates the same way', async () => {
    const p = new MemoryProvider({ model, data: { Orders: [{ ID: '1', Status: 'A', Amount: '10' }, { ID: '2', Status: 'A', Amount: '5' }, { ID: '3', Status: 'B', Amount: '1' }] } });
    const r = await p.query(buildAggregateRequest(model, ui.charts.ByStatus!, { source: { entitySet: 'Orders' } }));
    expect(r.rows).toEqual([{ Status: 'A', Amount: 15 }, { Status: 'B', Amount: 1 }]);
  });
});

describe('messages (ADR-023)', () => {
  it('P2-LRC-11 parses sap-messages headers and error details', () => {
    const m = messagesFromHeader(JSON.stringify([{ code: 'W', message: 'Careful', numericSeverity: 3, target: 'Note' }, { message: 'Done', numericSeverity: 1 }]));
    expect(m.map((x) => [x.type, x.message, x.target])).toEqual([['warning', 'Careful', 'Note'], ['success', 'Done', undefined]]);
    expect(messagesFromHeader('not json')).toEqual([]);
    const e = new ODataError({ status: 400, message: 'Invalid', details: [{ message: 'Enter a partner', target: 'PartnerID' }] });
    expect(messagesFromError(e).map((x) => [x.type, x.target])).toEqual([['error', 'PartnerID']]);
    expect(highestSeverity([...m, createMessage('error', 'x')])).toBe('error');
  });
});

/** Records the requests of an ODataV4Provider. */
function recorder(responses: Record<string, { status?: number; body?: unknown; headers?: Record<string, string> }>) {
  const calls: { method: string; url: string; body?: string; headers: Record<string, string> }[] = [];
  const fetch: FetchLike = async (url, init) => {
    calls.push({ method: init?.method ?? 'GET', url, body: init?.body, headers: init?.headers ?? {} });
    const key = Object.keys(responses).find((k) => `${init?.method ?? 'GET'} ${url}`.includes(k));
    const r = key ? responses[key]! : { status: 404, body: { error: { message: 'no' } } };
    const text = r.body === undefined ? '' : JSON.stringify(r.body);
    return { ok: (r.status ?? 200) < 300, status: r.status ?? 200, statusText: '', headers: { get: (n: string) => r.headers?.[n.toLowerCase()] ?? r.headers?.[n] ?? null }, text: async () => text };
  };
  return { calls, fetch };
}

describe('writes of the OData provider (ADR-018, ADR-024)', () => {
  it('P2-LR-15 create posts to the entity set and returns the entity path', async () => {
    const rec = recorder({ 'POST /s/Orders': { status: 201, body: { ID: 'N1', '@odata.etag': 'W/"1"' }, headers: { 'sap-messages': JSON.stringify([{ message: 'Created', numericSeverity: 1 }]) } } });
    const p = new ODataV4Provider({ serviceUrl: '/s/', model, fetch: rec.fetch });
    const r = await p.create({ entitySet: 'Orders' }, { PartnerID: 'P1' });
    expect(r.path).toBe("Orders('N1')");
    expect(r.messages?.[0]?.message).toBe('Created');
    expect(rec.calls[0]).toMatchObject({ method: 'POST', body: '{"PartnerID":"P1"}' });
  });

  it('P2-LRA-02 invoke posts bound actions to <path>/<action>; P2-OP-24 remove sends If-Match', async () => {
    const rec = recorder({ "POST /s/Orders('1')/T.approve": { body: { ID: '1' } }, "DELETE /s/Orders('1')": { status: 204 } });
    const p = new ODataV4Provider({ serviceUrl: '/s/', model, fetch: rec.fetch });
    await p.invoke('T.approve', { path: "Orders('1')" });
    await p.remove("Orders('1')", { etag: 'W/"3"' });
    expect(rec.calls.map((c) => `${c.method} ${c.url}`)).toEqual(["POST /s/Orders('1')/T.approve", "DELETE /s/Orders('1')"]);
    expect(rec.calls[1]!.headers['If-Match']).toBe('W/"3"');
  });
});

describe('edit strategies (P2-GEN-05)', () => {
  it('P2-GEN-05 the strategy is chosen by the model: draft for draft roots, direct otherwise', () => {
    const p = new MemoryProvider({ model, data: {} });
    expect(editStrategyFor(model, 'Orders', p).kind).toBe('direct');
    const m = buildModel(doc(types, container, `<Annotations Target="T.C/Orders"><Annotation Term="Common.DraftRoot"><Record><PropertyValue Property="ActivationAction" String="T.draftActivate"/></Record></Annotation></Annotations>`));
    expect(editStrategyFor(m, 'Orders', p).kind).toBe('draft');
  });

  it('P2-OP-17 direct save patches only the changed properties with the ETag and detects conflicts', async () => {
    const data = { Orders: [{ ID: '1', Note: 'a', Status: 'OPEN', '@odata.etag': 'W/"1"' }] as Row[] };
    const p = new MemoryProvider({ model, data });
    const s = new DirectEditStrategy(p);
    const a = await s.begin("Orders('1')", { ...data.Orders[0]! });
    const b = await s.begin("Orders('1')", { ...data.Orders[0]! });
    a.set('Note', 'b');
    const r = await a.save();
    expect(r.path).toBe("Orders('1')");
    expect(data.Orders[0]!.Note).toBe('b');
    b.set('Status', 'X');
    await expect(b.save()).rejects.toBeInstanceOf(ConcurrencyError);
  });

  it('P2-LR-15 direct create posts the values', async () => {
    const data: Record<string, Row[]> = { Orders: [] };
    const s = new DirectEditStrategy(new MemoryProvider({ model, data }));
    const session = await s.create({ entitySet: 'Orders' }, { ID: '9' });
    session.set('Note', 'new');
    const r = await session.save();
    expect(r.path).toBe("Orders('9')");
    expect(data.Orders![0]).toMatchObject({ ID: '9', Note: 'new' });
  });

  it('P2-OP-18 draft: edit action, background PATCH of the draft, preparation + activation, discard with DELETE', async () => {
    const draftTypes = types.replace('<EntityType Name="Order"><Key><PropertyRef Name="ID"/></Key>\n  <Property Name="ID" Type="Edm.String" Nullable="false"/>', '<EntityType Name="Order"><Key><PropertyRef Name="ID"/><PropertyRef Name="IsActiveEntity"/></Key>\n  <Property Name="ID" Type="Edm.String" Nullable="false"/><Property Name="IsActiveEntity" Type="Edm.Boolean" Nullable="false"/>');
    const m = buildModel(doc(draftTypes, container, `<Annotations Target="T.C/Orders"><Annotation Term="Common.DraftRoot"><Record><PropertyValue Property="ActivationAction" String="T.draftActivate"/><PropertyValue Property="EditAction" String="T.draftEdit"/><PropertyValue Property="PreparationAction" String="T.draftPrepare"/></Record></Annotation></Annotations>`));
    const calls: string[] = [];
    const provider: DataProvider = {
      query: async () => ({ rows: [] }),
      read: async () => ({}),
      update: async (path, patch) => { calls.push(`PATCH ${path} ${JSON.stringify(patch)}`); return { row: {}, messages: [] }; },
      create: async () => ({ row: { ID: 'N', IsActiveEntity: false }, path: '', messages: [] }),
      remove: async (path) => { calls.push(`DELETE ${path}`); return {}; },
      invoke: async (action, o) => { calls.push(`${action} ${o?.path}`); return { row: { ID: '1', IsActiveEntity: action !== 'T.draftEdit' }, messages: [] }; },
    };
    const s = new DraftEditStrategy(m, provider);
    expect(siblingPath(m, 'Orders(ID=\'1\',IsActiveEntity=true)', false)).toBe("Orders(ID='1',IsActiveEntity=false)");
    const session = await s.begin("Orders(ID='1',IsActiveEntity=true)", { ID: '1', IsActiveEntity: true });
    expect(session.draft).toBe(true);
    expect(session.path).toBe("Orders(ID='1',IsActiveEntity=false)");
    session.set('Note', 'x');
    await session.flush();
    const saved = await session.save();
    expect(saved.path).toBe("Orders(ID='1',IsActiveEntity=true)");
    expect(calls).toEqual([
      "T.draftEdit Orders(ID='1',IsActiveEntity=true)",
      `PATCH Orders(ID='1',IsActiveEntity=false) {"Note":"x"}`,
      "T.draftPrepare Orders(ID='1',IsActiveEntity=false)",
      "T.draftActivate Orders(ID='1',IsActiveEntity=false)",
    ]);
    const again = await s.begin("Orders(ID='1',IsActiveEntity=true)", { ID: '1', IsActiveEntity: true });
    await again.cancel();
    expect(calls[calls.length - 1]).toBe("DELETE Orders(ID='1',IsActiveEntity=false)");
  });
});
