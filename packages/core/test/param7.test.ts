/**
 * Stage 7, action parameters (FE sap.fe.macros.coreUI.OperationParameterDialog, sap.fe.core editFlow operations
 * OperationParameters / ODataOperation): the parameter model from the annotations of `Ns.action/P` and
 * `Ns.action(Ns.Type)/P`, default values, the request body and the mandatory check.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  actionParameterBody, actionParameterDefaults, actionParameterErrors, actionParameterState, buildModel, skipsParameterDialog, type ActionModel,
} from '../src';

const template = readFileSync(join(import.meta.dirname, '../../../apps/mock/Csdl/purchasing.template.xml'), 'utf8').replace(/\{\{label:([^}]+)\}\}/g, '$1');
const reject = buildModel(template).ui['Purchasing.PurchaseOrder']!.objectActions.find((a) => a.name === 'reject')!;

const doc = (params: string, annotations: string) => `<?xml version="1.0"?><edmx:Edmx Version="4.0" xmlns:edmx="http://docs.oasis-open.org/odata/ns/edmx">
<edmx:Reference Uri="c"><edmx:Include Namespace="com.sap.vocabularies.Common.v1" Alias="Common"/></edmx:Reference>
<edmx:Reference Uri="u"><edmx:Include Namespace="com.sap.vocabularies.UI.v1" Alias="UI"/></edmx:Reference>
<edmx:Reference Uri="o"><edmx:Include Namespace="Org.OData.Core.V1" Alias="Core"/></edmx:Reference>
<edmx:DataServices><Schema Namespace="T" xmlns="http://docs.oasis-open.org/odata/ns/edm">
<EntityType Name="O"><Key><PropertyRef Name="ID"/></Key><Property Name="ID" Type="Edm.String" Nullable="false"/><Property Name="S" Type="Edm.String"/><Property Name="FC" Type="Edm.Byte"/></EntityType>
<Action Name="a" IsBound="true"><Parameter Name="_it" Type="T.O" Nullable="false"/>${params}</Action>
<EntityContainer Name="C"><EntitySet Name="Os" EntityType="T.O"/></EntityContainer>
<Annotations Target="T.O"><Annotation Term="UI.Identification"><Collection><Record Type="UI.DataFieldForAction"><PropertyValue Property="Action" String="T.a"/><PropertyValue Property="Label" String="Act"/></Record></Collection></Annotation></Annotations>
${annotations}
</Schema></edmx:DataServices></edmx:Edmx>`;
const actionOf = (params: string, annotations: string): ActionModel => buildModel(doc(params, annotations)).ui['T.O']!.objectActions[0]!;

describe('AL-11 param7 action parameters in the model', () => {
  it('AL-11 param7 the test service reject: label, fixed values, multi-line, mandatory, defaults (both target forms)', () => {
    expect(reject.parameters.map((p) => [p.name, p.edmType, p.label])).toEqual([
      ['FollowUpType', 'Edm.String', 'P.FollowUpType'], ['RejectionNote', 'Edm.String', 'P.RejectionNote'], ['ReplyBy', 'Edm.Date', 'P.ReplyBy'], ['Priority', 'Edm.Int32', 'P.Priority'],
    ]);
    const [type, note, reply, prio] = reject.parameters;
    // Purchasing.reject/FollowUpType (all overloads)
    expect(type!.property?.valueList).toMatchObject({ collectionPath: 'PurchaseOrderTypes', keyProperty: 'Code', fixedValues: true });
    expect(type!.defaultValue).toEqual({ value: 'NB' });
    // Purchasing.reject(Purchasing.PurchaseOrder)/… (the overload)
    expect(note!.property).toMatchObject({ multiLine: true, mandatory: true, maxLength: 255 });
    expect(actionParameterState(note!)).toEqual({ hidden: false, required: true, readOnly: false, disabled: false });
    expect(reply!.defaultValue).toEqual({ path: 'OrderDate' });
    expect(prio!.defaultValue).toEqual({ value: 2 });
    expect(actionParameterState(prio!).required).toBe(false);
  });

  it('AL-11 param7 overload-specific annotations win over the unoverloaded target; label falls back to the name; Nullable is not mandatory', () => {
    const a = actionOf('<Parameter Name="R" Type="Edm.String" Nullable="false"/><Parameter Name="N" Type="Edm.Decimal"/>',
      `<Annotations Target="T.a/R"><Annotation Term="Common.Label" String="all"/><Annotation Term="UI.Placeholder" String="type"/></Annotations>
       <Annotations Target="T.a(T.O)/R"><Annotation Term="Common.Label" String="specific"/></Annotations>`);
    expect(a.parameters[0]).toMatchObject({ name: 'R', label: 'specific', nullable: false, property: { placeholder: 'type' } });
    expect(a.parameters[1]).toMatchObject({ name: 'N', label: 'N', nullable: true });
    expect(actionParameterState(a.parameters[0]!).required).toBe(false);
  });

  it('AL-11 param7 UI.Hidden, FieldControl paths of the binding parameter, read-only, inapplicable; all hidden skips the dialog', () => {
    const a = actionOf('<Parameter Name="H" Type="Edm.String"/><Parameter Name="P" Type="Edm.String"/><Parameter Name="C" Type="Edm.String"/><Parameter Name="I" Type="Edm.String"/>',
      `<Annotations Target="T.a(T.O)/H"><Annotation Term="UI.Hidden" Bool="true"/><Annotation Term="UI.ParameterDefaultValue" String="x"/></Annotations>
       <Annotations Target="T.a(T.O)/P"><Annotation Term="Common.FieldControl" Path="_it/FC"/></Annotations>
       <Annotations Target="T.a(T.O)/C"><Annotation Term="Core.Computed" Bool="true"/></Annotations>
       <Annotations Target="T.a(T.O)/I"><Annotation Term="Common.FieldControl" EnumMember="Common.FieldControlType/Inapplicable"/></Annotations>`);
    const [h, p, c, i] = a.parameters;
    expect(actionParameterState(h!).hidden).toBe(true);
    expect(p!.property?.fieldControl).toEqual({ path: 'FC' });
    expect(actionParameterState(p!, { FC: 7 }).required).toBe(true);
    expect(actionParameterState(p!, { FC: 1 }).readOnly).toBe(true);
    expect(actionParameterState(c!).readOnly).toBe(true);
    expect(actionParameterState(i!)).toMatchObject({ hidden: false, disabled: true });
    expect(skipsParameterDialog(a)).toBe(false);
    const hiddenOnly = actionOf('<Parameter Name="H" Type="Edm.String"/>', '<Annotations Target="T.a/H"><Annotation Term="UI.Hidden" Bool="true"/><Annotation Term="UI.ParameterDefaultValue" String="x"/></Annotations>');
    expect(skipsParameterDialog(hiddenOnly)).toBe(true);
    expect(actionParameterDefaults(hiddenOnly, [], { constantsOnly: true })).toEqual({ H: 'x' });
  });
});

describe('AL-10 param7 action parameter values in the request', () => {
  it('AL-10 param7 defaults: constants, paths of the rows, no value when the selected rows differ', () => {
    expect(actionParameterDefaults(reject, [{ OrderDate: '2026-01-02' }])).toEqual({ FollowUpType: 'NB', ReplyBy: '2026-01-02', Priority: 2 });
    expect(actionParameterDefaults(reject, [{ OrderDate: '2026-01-02' }, { OrderDate: '2026-01-02' }])).toMatchObject({ ReplyBy: '2026-01-02' });
    expect(actionParameterDefaults(reject, [{ OrderDate: '2026-01-02' }, { OrderDate: '2026-03-04' }])).not.toHaveProperty('ReplyBy');
  });

  it('AL-10 param7 typed values (numbers, Int64 / Decimal strings, booleans, dates), empty values, non-nullable type defaults', () => {
    const a = actionOf(['<Parameter Name="I" Type="Edm.Int32"/><Parameter Name="L" Type="Edm.Int64"/><Parameter Name="D" Type="Edm.Decimal"/><Parameter Name="F" Type="Edm.Double"/>',
      '<Parameter Name="B" Type="Edm.Boolean"/><Parameter Name="T" Type="Edm.Date"/><Parameter Name="S" Type="Edm.String"/><Parameter Name="E" Type="Edm.Int32"/>',
      '<Parameter Name="NS" Type="Edm.String" Nullable="false"/><Parameter Name="NB" Type="Edm.Boolean" Nullable="false"/><Parameter Name="NI" Type="Edm.Int16" Nullable="false"/><Parameter Name="ND" Type="Edm.Decimal" Nullable="false"/>'].join(''), '');
    expect(actionParameterBody(a, { I: '42', L: '9007199254740993', D: ' 12.50', F: '1.5', B: true, T: '2026-02-03', S: 'x', E: '' }))
      .toEqual({ I: 42, L: '9007199254740993', D: '12.50', F: 1.5, B: true, T: '2026-02-03', S: 'x', E: null, NS: '', NB: false, NI: 0, ND: '0' });
  });

  it('AL-10 param7 a mandatory parameter without value and a number that is none block the action', () => {
    expect(actionParameterErrors(reject, { FollowUpType: 'NB', Priority: '2' })).toEqual([{ name: 'RejectionNote', kind: 'missing' }]);
    expect(actionParameterErrors(reject, { RejectionNote: 'no', Priority: 'two' })).toEqual([{ name: 'Priority', kind: 'invalid' }]);
    expect(actionParameterErrors(reject, { RejectionNote: 'no' })).toEqual([]);
  });
});
