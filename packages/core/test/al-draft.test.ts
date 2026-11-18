/**
 * Stage 3, group "draft" (docs/29 §4 P1-1, P1-6): the draft editing status (FE sap.fe.macros.filterBar.DraftEditState)
 * and the hidden filters of a view (FE multiple views: the view's selection variant), as request filters and in memory.
 */
import { describe, expect, it } from 'vitest';
import {
  buildListRequest, buildModel, DRAFT_EDIT_STATES, EDIT_STATE, editStateFilter, editStateOf, hiddenFiltersOf, MemoryProvider, toQueryString,
  withHiddenFilters, type FilterState, type Row,
} from '../src';

const xml = `<?xml version="1.0"?>
<edmx:Edmx Version="4.0" xmlns:edmx="http://docs.oasis-open.org/odata/ns/edmx">
  <edmx:Reference Uri="u"><edmx:Include Namespace="com.sap.vocabularies.UI.v1" Alias="UI"/></edmx:Reference>
  <edmx:Reference Uri="c"><edmx:Include Namespace="com.sap.vocabularies.Common.v1" Alias="Common"/></edmx:Reference>
  <edmx:DataServices><Schema xmlns="http://docs.oasis-open.org/odata/ns/edm" Namespace="T">
    <EntityType Name="Order"><Key><PropertyRef Name="ID"/><PropertyRef Name="IsActiveEntity"/></Key>
      <Property Name="ID" Type="Edm.String" Nullable="false"/>
      <Property Name="Status" Type="Edm.String"/>
      <Property Name="IsActiveEntity" Type="Edm.Boolean" Nullable="false"/>
      <Property Name="HasActiveEntity" Type="Edm.Boolean" Nullable="false"/>
      <Property Name="HasDraftEntity" Type="Edm.Boolean" Nullable="false"/>
      <NavigationProperty Name="DraftAdministrativeData" Type="T.DraftAdministrativeData"/>
      <NavigationProperty Name="SiblingEntity" Type="T.Order"/>
    </EntityType>
    <EntityType Name="DraftAdministrativeData"><Key><PropertyRef Name="DraftUUID"/></Key>
      <Property Name="DraftUUID" Type="Edm.Guid" Nullable="false"/><Property Name="InProcessByUser" Type="Edm.String"/>
    </EntityType>
    <EntityContainer Name="C">
      <EntitySet Name="Orders" EntityType="T.Order"><NavigationPropertyBinding Path="SiblingEntity" Target="Orders"/></EntitySet>
    </EntityContainer>
    <Annotations Target="T.Order"><Annotation Term="UI.LineItem"><Collection><Record Type="UI.DataField"><PropertyValue Property="Value" Path="Status"/></Record></Collection></Annotation></Annotations>
    <Annotations Target="T.C/Orders"><Annotation Term="Common.DraftRoot"><Record><PropertyValue Property="ActivationAction" String="T.draftActivate"/></Record></Annotation></Annotations>
  </Schema></edmx:DataServices>
</edmx:Edmx>`;
const model = buildModel(xml);
const ui = model.ui['T.Order']!;

const filterOf = (filters: FilterState) => {
  const q = toQueryString(model, buildListRequest(model, ui, { source: { entitySet: 'Orders' }, columns: [], filters }));
  return decodeURIComponent(/\$filter=([^&]*)/.exec(q)?.[1] ?? '');
};
const state = (id: string): FilterState => ({ [EDIT_STATE]: [{ operator: 'EQ', values: [id] }] });

describe('draft editing status (FE DraftEditState)', () => {
  it('AL-10 P1-1 draft list: the six options of a non-collaborative draft, in FE order', () => {
    expect(DRAFT_EDIT_STATES).toEqual(['', 'ALL_HIDING_DRAFTS', 'UNCHANGED', 'OWN_DRAFT', 'LOCKED', 'UNSAVED_CHANGES']);
    expect(editStateOf(undefined)).toBe('');
    expect(editStateOf(state('LOCKED'))).toBe('LOCKED');
    expect(editStateOf(state('others'))).toBe('');
  });

  it('AL-10 P1-1 draft list: All = IsActiveEntity eq false or SiblingEntity/IsActiveEntity eq null, after the filter bar conditions', () => {
    expect(filterOf({ Status: [{ operator: 'EQ', values: ['A'] }], ...state('') })).toBe("Status eq 'A' and (IsActiveEntity eq false or SiblingEntity/IsActiveEntity eq null)");
    expect(filterOf(state(''))).toBe('IsActiveEntity eq false or SiblingEntity/IsActiveEntity eq null');
  });

  it('AL-10 P1-1 draft list: the filters of the other options by InProcessByUser (DraftEditState.getFilterForEditState)', () => {
    expect(editStateFilter('ALL_HIDING_DRAFTS', true)).toBe('IsActiveEntity eq true');
    expect(editStateFilter('UNCHANGED', true)).toBe('IsActiveEntity eq true and HasDraftEntity eq false');
    expect(editStateFilter('OWN_DRAFT', true)).toBe('IsActiveEntity eq false');
    expect(filterOf({ Status: [{ operator: 'EQ', values: ['A'] }], ...state('LOCKED') })).toBe(
      "Status eq 'A' and IsActiveEntity eq true and SiblingEntity/IsActiveEntity eq null and DraftAdministrativeData/InProcessByUser ne '' and DraftAdministrativeData/InProcessByUser ne null",
    );
    expect(filterOf(state('UNSAVED_CHANGES'))).toBe("IsActiveEntity eq true and SiblingEntity/IsActiveEntity eq null and DraftAdministrativeData/InProcessByUser eq ''");
  });

  it('AL-10 P1-1 draft list: the memory provider evaluates the editing status with the sibling versions', async () => {
    const admin = (user: string | null) => ({ DraftUUID: '1', InProcessByUser: user });
    const rows: Row[] = [
      { ID: '1', Status: 'A', IsActiveEntity: true, HasActiveEntity: false, HasDraftEntity: false, DraftAdministrativeData: null },
      // 2: active with an own draft
      { ID: '2', Status: 'A', IsActiveEntity: true, HasActiveEntity: false, HasDraftEntity: true, DraftAdministrativeData: admin('me') },
      { ID: '2', Status: 'A', IsActiveEntity: false, HasActiveEntity: true, HasDraftEntity: false, DraftAdministrativeData: admin('me') },
      // 3: new draft (never activated)
      { ID: '3', Status: 'A', IsActiveEntity: false, HasActiveEntity: false, HasDraftEntity: false, DraftAdministrativeData: admin('me') },
      // 4: locked by another user (the other user's draft is not visible), 5: unsaved changes of another user
      { ID: '4', Status: 'A', IsActiveEntity: true, HasActiveEntity: false, HasDraftEntity: true, DraftAdministrativeData: admin('other') },
      { ID: '5', Status: 'A', IsActiveEntity: true, HasActiveEntity: false, HasDraftEntity: true, DraftAdministrativeData: admin('') },
    ];
    const p = new MemoryProvider({ model, data: { Orders: rows } });
    const ids = async (id: string) => (await p.query(buildListRequest(model, ui, { source: { entitySet: 'Orders' }, columns: [], filters: state(id) }))).rows.map((r) => `${r.ID}:${r.IsActiveEntity}`);
    expect(await ids('')).toEqual(['1:true', '2:false', '3:false', '4:true', '5:true']);
    expect(await ids('ALL_HIDING_DRAFTS')).toEqual(['1:true', '2:true', '4:true', '5:true']);
    expect(await ids('UNCHANGED')).toEqual(['1:true']);
    expect(await ids('OWN_DRAFT')).toEqual(['2:false', '3:false']);
    expect(await ids('LOCKED')).toEqual(['4:true']);
    expect(await ids('UNSAVED_CHANGES')).toEqual(['5:true']);
  });

  it('AL-10 P1-1 draft list: the list requests HasActiveEntity, HasDraftEntity and DraftAdministrativeData(DraftUUID, InProcessByUser) when asked to', () => {
    const req = buildListRequest(model, ui, { source: { entitySet: 'Orders' }, columns: [], extraSelect: ['HasActiveEntity', 'HasDraftEntity', 'DraftAdministrativeData/DraftUUID', 'DraftAdministrativeData/InProcessByUser'] });
    expect(decodeURIComponent(toQueryString(model, req))).toContain('$expand=DraftAdministrativeData($select=DraftUUID,InProcessByUser)');
  });
});

describe('hidden filters of a view (FE multiple views)', () => {
  it('AL-10 P1-6 multiple views: the view selection variant is combined with the filter bar by "and", also for the same property', async () => {
    const bar: FilterState = { Status: [{ operator: 'EQ', values: ['A'] }, { operator: 'EQ', values: ['B'] }] };
    const filters = withHiddenFilters(bar, { Status: [{ operator: 'EQ', values: ['B'] }], ID: [{ operator: 'NE', values: ['9'] }] });
    expect(hiddenFiltersOf(filters)).toEqual({ Status: [{ operator: 'EQ', values: ['B'] }], ID: [{ operator: 'NE', values: ['9'] }] });
    expect(filterOf(filters)).toBe("(Status eq 'A' or Status eq 'B') and (Status eq 'B') and (ID ne '9')");
    const p = new MemoryProvider({ model, data: { Orders: [{ ID: '1', Status: 'A', IsActiveEntity: true }, { ID: '2', Status: 'B', IsActiveEntity: true }, { ID: '9', Status: 'B', IsActiveEntity: true }] } });
    const r = await p.query(buildListRequest(model, ui, { source: { entitySet: 'Orders' }, columns: [], filters }));
    expect(r.rows.map((x) => x.ID)).toEqual(['2']);
  });
});
