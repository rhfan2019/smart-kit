// Draft variant of the purchasing service (ADR-019): an XML transform of purchasing.template.xml, applied
// before the labels are filled in. PurchaseOrder (draft root) and PurchaseOrderItem (draft node) get the
// draft key IsActiveEntity, HasActiveEntity, HasDraftEntity and the DraftAdministrativeData navigation;
// the schema gets the draft actions and Common.DraftRoot / Common.DraftNode, which make
// @sap-ux/fe-mockserver-core treat both entity sets as draft-enabled (DraftMockEntitySet).

export const DRAFT_NS = 'Purchasing';
export const DRAFT_ACTIONS = { edit: 'draftEdit', activate: 'draftActivate', prepare: 'draftPrepare' };

/** Inserts `text` before the first `marker` after `anchor`. Throws when the template no longer matches. */
function insertAfterAnchor(xml, anchor, marker, text) {
  const a = xml.indexOf(anchor);
  if (a < 0) throw new Error(`[mock] draft transform: anchor not found: ${anchor}`);
  const m = xml.indexOf(marker, a + anchor.length);
  if (m < 0) throw new Error(`[mock] draft transform: ${marker} not found after ${anchor}`);
  return xml.slice(0, m) + text + xml.slice(m);
}

// SiblingEntity: the other version of the instance (the own draft of an active instance, the active instance of a
// draft), as RAP and CAP declare it; sap.fe filters the editing status by SiblingEntity/IsActiveEntity.
const draftProps = (type) => `        <Property Name="IsActiveEntity" Type="Edm.Boolean" Nullable="false" DefaultValue="true"/>
        <Property Name="HasActiveEntity" Type="Edm.Boolean" Nullable="false" DefaultValue="false"/>
        <Property Name="HasDraftEntity" Type="Edm.Boolean" Nullable="false" DefaultValue="false"/>
        <NavigationProperty Name="DraftAdministrativeData" Type="Purchasing.DraftAdministrativeData"/>
        <NavigationProperty Name="SiblingEntity" Type="Purchasing.${type}"/>
`;

const ADMIN_PROPS = [
  ['DraftUUID', 'Edm.Guid', 'Nullable="false"'],
  ['DraftEntityType', 'Edm.String', 'MaxLength="60"'],
  ['CreationDateTime', 'Edm.DateTimeOffset', 'Precision="3"'],
  ['CreatedByUser', 'Edm.String', 'MaxLength="40"'],
  ['DraftIsCreatedByMe', 'Edm.Boolean', ''],
  ['LastChangeDateTime', 'Edm.DateTimeOffset', 'Precision="3"'],
  ['LastChangedByUser', 'Edm.String', 'MaxLength="40"'],
  ['DraftIsLastChangedByMe', 'Edm.Boolean', ''],
  ['InProcessByUser', 'Edm.String', 'MaxLength="40"'],
  ['DraftIsProcessedByMe', 'Edm.Boolean', ''],
  ['DraftAccessType', 'Edm.String', 'MaxLength="1"'],
  ['DraftIsKeptByUser', 'Edm.Boolean', ''],
  ['CreatedByUserDescription', 'Edm.String', 'MaxLength="80"'],
  ['LastChangedByUserDescription', 'Edm.String', 'MaxLength="80"'],
  ['InProcessByUserDescription', 'Edm.String', 'MaxLength="80"'],
];

const ADMIN_TYPE = `      <EntityType Name="DraftAdministrativeData">
        <Key><PropertyRef Name="DraftUUID"/></Key>
${ADMIN_PROPS.map(([n, t, f]) => `        <Property Name="${n}" Type="${t}"${f ? ` ${f}` : ''}/>`).join('\n')}
      </EntityType>

`;

const action = (name, params) => `      <Action Name="${name}" IsBound="true">
        <Parameter Name="_it" Type="Purchasing.PurchaseOrder" Nullable="false"/>
${params.map(([n, t]) => `        <Parameter Name="${n}" Type="${t}"/>\n`).join('')}        <ReturnType Type="Purchasing.PurchaseOrder" Nullable="false"/>
      </Action>
`;

const DRAFT_ACTION_XML = `      <!-- =========================================================== draft actions (ADR-019) -->
${action(DRAFT_ACTIONS.edit, [['PreserveChanges', 'Edm.Boolean']])}${action(DRAFT_ACTIONS.activate, [])}${action(DRAFT_ACTIONS.prepare, [['SideEffectsQualifier', 'Edm.String']])}
`;

const DRAFT_ROOT = `        <Annotation Term="Common.DraftRoot">
          <Record Type="Common.DraftRootType">
            <PropertyValue Property="ActivationAction" String="Purchasing.${DRAFT_ACTIONS.activate}"/>
            <PropertyValue Property="EditAction" String="Purchasing.${DRAFT_ACTIONS.edit}"/>
            <PropertyValue Property="PreparationAction" String="Purchasing.${DRAFT_ACTIONS.prepare}"/>
          </Record>
        </Annotation>
`;
const DRAFT_NODE = `        <Annotation Term="Common.DraftNode">
          <Record Type="Common.DraftNodeType">
            <PropertyValue Property="PreparationAction" String="Purchasing.${DRAFT_ACTIONS.prepare}"/>
          </Record>
        </Annotation>
`;

const label = (target, key, extra = '') => `      <Annotations Target="${target}">
        <Annotation Term="Common.Label" String="{{label:${key}}}"/>
${extra}      </Annotations>
`;
const HIDDEN = '        <Annotation Term="UI.Hidden" Bool="true"/>\n        <Annotation Term="Core.Computed" Bool="true"/>\n';

const draftPropertyAnnotations = (type) =>
  label(`Purchasing.${type}/IsActiveEntity`, 'F.IsActiveEntity', HIDDEN) +
  label(`Purchasing.${type}/HasActiveEntity`, 'F.HasActiveEntity', HIDDEN) +
  label(`Purchasing.${type}/HasDraftEntity`, 'F.HasDraftEntity', HIDDEN);

const ADMIN_ANNOTATIONS =
  ADMIN_PROPS.map(([n]) => label(`Purchasing.DraftAdministrativeData/${n}`, `F.Draft.${n}`, n === 'DraftUUID' ? HIDDEN : '')).join('') +
  label('Purchasing.DraftAdministrativeData', 'T.DraftAdministrativeData').replace(
    '      </Annotations>',
    `        <Annotation Term="UI.HeaderInfo">
          <Record Type="UI.HeaderInfoType">
            <PropertyValue Property="TypeName" String="{{label:T.DraftAdministrativeData}}"/>
            <PropertyValue Property="TypeNamePlural" String="{{label:T.DraftAdministrativeData}}"/>
            <PropertyValue Property="Title"><Record Type="UI.DataField"><PropertyValue Property="Value" Path="InProcessByUser"/></Record></PropertyValue>
          </Record>
        </Annotation>
      </Annotations>`,
  );

/** Returns the draft-enabled variant of the purchasing template (still with {{label:…}} placeholders). */
export function toDraftTemplate(template) {
  let x = template;
  // keys and draft properties
  for (const type of ['PurchaseOrder', 'PurchaseOrderItem']) {
    const anchor = `<EntityType Name="${type}">`;
    x = insertAfterAnchor(x, anchor, '</Key>', '<PropertyRef Name="IsActiveEntity"/>');
    x = insertAfterAnchor(x, anchor, '      </EntityType>', draftProps(type));
  }
  x = x.replace('      <!-- =========================================================== bound actions', `${ADMIN_TYPE}${DRAFT_ACTION_XML}      <!-- =========================================================== bound actions`);
  if (!x.includes('Name="DraftAdministrativeData">')) throw new Error('[mock] draft transform: actions anchor not found');
  // container: entity set and navigation bindings
  x = insertAfterAnchor(x, '<EntitySet Name="PurchaseOrders"', '        </EntitySet>', '          <NavigationPropertyBinding Path="DraftAdministrativeData" Target="DraftAdministrativeData"/>\n          <NavigationPropertyBinding Path="SiblingEntity" Target="PurchaseOrders"/>\n');
  x = insertAfterAnchor(x, '<EntitySet Name="PurchaseOrderItems"', '        </EntitySet>', '          <NavigationPropertyBinding Path="DraftAdministrativeData" Target="DraftAdministrativeData"/>\n          <NavigationPropertyBinding Path="SiblingEntity" Target="PurchaseOrderItems"/>\n');
  x = insertAfterAnchor(x, '<EntitySet Name="Variants"', '\n', '\n        <EntitySet Name="DraftAdministrativeData" EntityType="Purchasing.DraftAdministrativeData"/>');
  // DraftRoot / DraftNode on the entity sets
  x = insertAfterAnchor(x, '<Annotations Target="Purchasing.Container/PurchaseOrders">', '      </Annotations>', DRAFT_ROOT);
  x = insertAfterAnchor(x, '<Annotations Target="Purchasing.Container/PurchaseOrderItems">', '      </Annotations>', DRAFT_NODE);
  // labels of the new properties
  x = x.replace(
    '      <!-- =========================================================== Variant',
    `      <!-- =========================================================== draft properties (ADR-019) -->
${draftPropertyAnnotations('PurchaseOrder')}${draftPropertyAnnotations('PurchaseOrderItem')}${ADMIN_ANNOTATIONS}
      <!-- =========================================================== Variant`,
  );
  return x;
}

// ------------------------------------------------------------------ query semantics

/**
 * Draft filter semantics of RAP and CAP that @sap-ux/fe-mockserver-core does not have, for the engine's
 * DraftMockEntitySet.checkSpecificProperties (null = let the engine evaluate):
 * - a draft is visible to its owner only: `IsActiveEntity eq false` matches the user's own drafts, not the
 *   draft another user is editing (DraftIsCreatedByMe false);
 * - `SiblingEntity/IsActiveEntity eq null`: an active instance without an own draft (another user's draft is not
 *   its sibling for this user), or a new draft without an active instance (HasActiveEntity false). The engine only
 *   checks whether any draft with the same key exists.
 * `others(row)` returns the other versions of the row (same key apart from IsActiveEntity).
 */
export function draftFilterCheck(expr, row, others) {
  const id = expr.identifier;
  if (id === 'IsActiveEntity' && expr.operator === 'eq' && expr.literal === 'false') return row.IsActiveEntity === false && row.DraftAdministrativeData?.DraftIsCreatedByMe !== false;
  if (id === 'SiblingEntity/IsActiveEntity' && expr.literal === 'null' && (expr.operator === 'eq' || expr.operator === 'ne')) {
    const none = row.IsActiveEntity === false
      ? !row.HasActiveEntity
      : !others(row).some((r) => r.IsActiveEntity === false && r.DraftAdministrativeData?.DraftIsCreatedByMe !== false);
    return expr.operator === 'eq' ? none : !none;
  }
  return null;
}

// ------------------------------------------------------------------ data

/** The user of the seeded foreign draft (fictional). */
export const OTHER_USER = 'Alex Miller';
/** The order that another user has a draft for. */
export const LOCKED_ORDER = '4500000004';

/**
 * Draft service data from the generated purchasing data: every order and item is an active instance
 * without draft, except LOCKED_ORDER, which has a draft of OTHER_USER (with a changed description).
 */
export function generateDraftData(base) {
  const active = { IsActiveEntity: true, HasActiveEntity: false, HasDraftEntity: false };
  const PurchaseOrders = base.PurchaseOrders.map((r) => ({ ...r, ...active, DraftAdministrativeData: null }));
  const PurchaseOrderItems = base.PurchaseOrderItems.map((r) => ({ ...r, ...active, DraftAdministrativeData: null }));
  const admin = {
    DraftUUID: '6f1d2c3b-4a59-4e1f-9b7a-0c4d5e6f7a81', DraftEntityType: 'Purchasing.PurchaseOrder',
    CreationDateTime: '2026-11-14T08:55:00.000Z', CreatedByUser: OTHER_USER, DraftIsCreatedByMe: false,
    LastChangeDateTime: '2026-11-14T09:30:00.000Z', LastChangedByUser: OTHER_USER, DraftIsLastChangedByMe: false,
    InProcessByUser: OTHER_USER, DraftIsProcessedByMe: false, DraftAccessType: '', DraftIsKeptByUser: false,
    CreatedByUserDescription: OTHER_USER, LastChangedByUserDescription: OTHER_USER, InProcessByUserDescription: OTHER_USER,
  };
  const draft = { IsActiveEntity: false, HasActiveEntity: true, HasDraftEntity: false };
  const po = PurchaseOrders.find((r) => r.PurchaseOrder === LOCKED_ORDER);
  Object.assign(po, { HasDraftEntity: true, DraftAdministrativeData: admin });
  PurchaseOrders.push({ ...po, ...draft, Description: `${po.Description} (rescheduled)`, DraftAdministrativeData: admin });
  for (const it of PurchaseOrderItems.filter((r) => r.PurchaseOrder === LOCKED_ORDER)) {
    Object.assign(it, { HasDraftEntity: true, DraftAdministrativeData: admin });
    PurchaseOrderItems.push({ ...it, ...draft, DraftAdministrativeData: admin });
  }
  return { ...base, PurchaseOrders, PurchaseOrderItems, Variants: [], DraftAdministrativeData: [] };
}
