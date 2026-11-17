# smart-kit recipes

> Every `tsx` block here is a complete module and is type-checked against the package in CI
> (`tests/unit/agent-docs.test.ts` in the smart-kit repository). All of them assume the app setup of `docs/README.md`
> (`MantineProvider` + `SmartKitProvider` around the page). Entity sets and properties are from the purchasing
> example service (`PurchaseOrders` with items `_Items`, `Suppliers`); replace them with yours.

## 1. List page (filter bar, variants, table)

```tsx
import { SmartListReport } from '@rhfan2019/smart-kit/templates';

export function PurchaseOrderList() {
  return <SmartListReport entitySet="PurchaseOrders" />;
}
```

That is the whole page. What appears comes from annotations on the entity type / set (see `docs/annotations.md`):

| UI part | Annotation |
| --- | --- |
| Title | `UI.HeaderInfo/TypeNamePlural` |
| Filter fields (default, in order) | `UI.SelectionFields`; mandatory ones from `Capabilities.FilterRestrictions/RequiredProperties` |
| Search field | `Capabilities.SearchRestrictions/Searchable` |
| Columns | `UI.LineItem` (`DataField`, `DataFieldForAnnotation` → `UI.DataPoint` / `UI.Chart`, `DataFieldForAction` → toolbar or inline actions) |
| Default sort, default filters | `UI.PresentationVariant/SortOrder`, `UI.SelectionVariant` (or a `UI.SelectionPresentationVariant`) |
| Value help on a filter field | `Common.ValueList` (dialog) or `Common.ValueListWithFixedValues` (dropdown) |
| Text next to a code | `Common.Text` + `UI.TextArrangement` |
| Amount / unit | `Measures.ISOCurrency` / `Measures.Unit` |
| Status colour | `UI.Criticality` on the property or `Criticality` on the DataField |
| Create / Delete buttons | `Capabilities.InsertRestrictions` / `DeleteRestrictions` (and a writable service) |
| Saved views ("variants") | an entity set `Variants` in the service + `ODataVariantStore` in `ServiceConfig.variants` |

Common props: `pageKey` (variants and back-navigation state; set it when one entity set has two list pages),
`liveMode={false}` (manual "Go" for slow services), `tableType="responsive"` (no AG Grid look, phone-friendly),
`chart` (table / chart toggle from `UI.Chart`), `views={{ mode: 'tabs' }}` (one tab per qualified
`UI.SelectionPresentationVariant`), `headerActions`, `tableExtend`, `filterExtend`.

## 2. Object page (header, sections, sub-tables, edit)

```tsx
import { SmartObjectPage } from '@rhfan2019/smart-kit/templates';

/** `path` is an entity path such as "PurchaseOrders('4500000001')" (usually from the route). */
export function PurchaseOrderObject({ path }: { path: string }) {
  return <SmartObjectPage key={path} path={path} navigation="tabs" />;
}
```

| UI part | Annotation |
| --- | --- |
| Title, subtitle, image | `UI.HeaderInfo/Title`, `Description`, `ImageUrl`; type name `TypeName` |
| Header facets (key values, forms, micro charts) | `UI.HeaderFacets` → `UI.DataPoint`, `UI.FieldGroup`, `UI.Chart` |
| Sections and subsections | `UI.Facets`: `CollectionFacet` = section, its `ReferenceFacet`s = subsections; a `ReferenceFacet` to `@UI.FieldGroup#X` is a form, to `_Items/@UI.LineItem` a sub-table |
| "Show More" in a section | `UI.PartOfPreview: false` on the facet |
| Header / footer actions | `UI.Identification` → `DataFieldForAction` (`Determining: true` = footer) |
| Edit, Delete | `Capabilities.UpdateRestrictions` / `DeleteRestrictions`; field-level `Core.Computed`, `Core.Immutable`, `Common.FieldControl` |
| Draft vs. direct save | automatic: `Common.DraftRoot` on the set = draft, else direct save (PATCH with ETag) |

`navigation="anchor"` (default) shows all sections in one scrolling page; `"tabs"` one section at a time (better for
long sub-tables). New object: `<SmartObjectPage path="" create={{ entitySet: 'PurchaseOrders' }} />`. Sub-object pages
(an item of an order) are the same component with the longer path, e.g. `PurchaseOrders('1')/_Items(PurchaseOrder='1',ItemNo=10)`.

## 3. Freestyle page from building blocks

Use when the template does not fit: your own layout, a filter bar and a table wired by `useFilterState`.

```tsx
import { Button } from '@mantine/core';
import { FilterSummary, SmartFilterBar, useFilterState } from '@rhfan2019/smart-kit/filter';
import { DynamicPage } from '@rhfan2019/smart-kit/page';
import { SmartTable, useTableContext } from '@rhfan2019/smart-kit/table';
import { useMetaModel } from '@rhfan2019/smart-kit/context';

function Toolbar() {
  const table = useTableContext();
  return (
    <div className="sk-table__toolbar">
      <SmartTable.Title />
      <span className="sk-grow" />
      <Button variant="default" size="xs" onClick={table.refresh}>Refresh</Button>
      <SmartTable.Settings />
    </div>
  );
}

export function OrdersWorklist() {
  const filter = useFilterState('PurchaseOrders', { pageKey: 'worklist', liveMode: true });
  const { ui } = useMetaModel('PurchaseOrders');
  return (
    <DynamicPage
      heading={ui.headerInfo.typeNamePlural}
      summary={<FilterSummary entitySet="PurchaseOrders" filters={filter.filters} search={filter.search} />}
      header={<SmartFilterBar state={filter} />}
    >
      {/* query: the applied filters; null = not executed yet (mandatory filters missing) */}
      <SmartTable entitySet="PurchaseOrders" query={filter.applied} pageKey="worklist">
        <Toolbar />
      </SmartTable>
    </DynamicPage>
  );
}
```

Without AG Grid: `<SmartTable mode="responsive" …>` still needs the `/table` subpath, which imports AG Grid. If AG
Grid is not installed, use `useListQuery` and render rows yourself (§ 4) or `ResponsiveTable` with your own data.

## 4. Fully custom UI with hooks (no AG Grid)

```tsx
import { useListQuery } from '@rhfan2019/smart-kit/table';
import { SmartField } from '@rhfan2019/smart-kit/field';
import { useMetaModel } from '@rhfan2019/smart-kit/context';
import { keyPredicate } from '@rhfan2019/smart-kit-core';

export function OpenOrders() {
  const { type } = useMetaModel('PurchaseOrders');
  const list = useListQuery({
    source: { entitySet: 'PurchaseOrders' },
    filters: { Status: [{ operator: 'EQ', values: ['NEW'] }] },
    sort: [{ path: 'OrderDate', descending: true }],
    pageSize: 20,
  });
  if (list.isLoading) return <p>Loading…</p>;
  if (list.error) return <p role="alert">{list.error.message}</p>;
  return (
    <ul>
      {list.rows.map((row) => (
        <li key={keyPredicate(type, row)}>
          {/* formatted like the table: text arrangement, currency, criticality */}
          <SmartField entitySet="PurchaseOrders" path="PurchaseOrder" row={row} /> —{' '}
          <SmartField entitySet="PurchaseOrders" path="NetAmount" row={row} />
        </li>
      ))}
      {list.hasMore && <button onClick={list.loadMore}>More</button>}
    </ul>
  );
}
```

A filter value is a list of conditions per property path: `{ Status: [{ operator: 'EQ', values: ['NEW'] }] }`.
Operators: `EQ`, `NE`, `BT` (two values), `NB`, `LT`, `LE`, `GT`, `GE`, `Contains`, `NotContains`, `StartsWith`,
`EndsWith`, `Empty`, `NotEmpty` (`OPERATORS` in core lists them with their arity).

## 5. One object, custom layout

```tsx
import { useObject, SmartForm } from '@rhfan2019/smart-kit/object';

export function SupplierPanel({ path }: { path: string }) {
  const obj = useObject(path); // e.g. "Suppliers('0000100001')"
  if (obj.isLoading) return <p>Loading…</p>;
  if (obj.error) return <p role="alert">{obj.error.message}</p>;
  // the first form of the first section, as the annotations describe it
  const content = obj.ui.sections[0]?.subSections[0]?.content;
  return content?.kind === 'form' ? <SmartForm typeName={obj.typeName} row={obj.data} groups={content.groups} /> : null;
}
```

## 6. Charts

- In a list page: `<SmartListReport entitySet="PurchaseOrders" chart />` adds a table / chart toggle; the chart is
  `UI.Chart` (Column, Bar, Line, Donut, Pie) aggregated on the server with `$apply` (smart-kit-server supports it).
- In a table column, a header facet or a card: a `DataFieldForAnnotation` pointing to a `UI.Chart` with
  `ChartType` Bullet, Radial, HarveyBall, Delta(Bullet), Column, Line, Comparison, Area, StackedBar — drawn as a
  micro chart, no code.
- Standalone, with your own numbers (no service needed, about 5 KB gzip):

```tsx
import { MicroChart, SimpleChart } from '@rhfan2019/smart-kit/chart';

export function Kpis() {
  return (
    <>
      <MicroChart kind="bullet" label="Budget used" value={72} target={80} max={100} criticality={2} />
      <MicroChart kind="column" label="Orders per month" points={[{ label: 'Jan', value: 12 }, { label: 'Feb', value: 18 }, { label: 'Mar', value: 9 }]} />
      <SimpleChart kind="bar" measureLabel="Net amount" dimensionLabel="Supplier" data={[{ key: 'A', label: 'Acme', value: 1200 }, { key: 'B', label: 'Bolt', value: 800 }]} />
    </>
  );
}
```

## 7. Cards (overview tiles)

Names and settings as in SAPUI5 integration / OVP cards. Contents read the same annotations; qualifiers pick a
specific `UI.LineItem#X`, `UI.PresentationVariant#X` (sort, `MaxItems`), `UI.SelectionVariant#X` (fixed filter),
`UI.Chart#X`, `UI.DataPoint#X`. Paths may be written `@UI.LineItem#Card` or `com.sap.vocabularies.UI.v1.LineItem#Card`.

```tsx
import { AnalyticalContent, Card, Header, ListContent, NumericHeader, TableContent } from '@rhfan2019/smart-kit/cards';

export function Overview() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, 340px)', gap: 16 }}>
      <Card header={<Header title="Large orders" subtitle="By net amount" />}>
        <ListContent entitySet="PurchaseOrders" maxItems={4} highlight presentationAnnotationPath="@UI.PresentationVariant#CardLarge" />
      </Card>
      <Card header={<NumericHeader title="Spend" entitySet="PurchaseOrders" dataPointAnnotationPath="@UI.DataPoint#CardSpend" />}>
        <AnalyticalContent entitySet="PurchaseOrders" chartAnnotationPath="@UI.Chart#ByStatus" />
      </Card>
      <Card header={<Header title="To approve" />}>
        <TableContent entitySet="PurchaseOrders" selectionAnnotationPath="@UI.SelectionVariant#CardNew" />
      </Card>
      <Card header={<Header title="Note" />}>
        <p style={{ padding: 16 }}>Any React content works as a card body.</p>
      </Card>
    </div>
  );
}
```

Other contents: `ObjectContent` (one object: `keys={{ Supplier: '0000100001' }}`), `TimelineContent` and
`CalendarContent` (entity type with `Communication.Event`-style start / end properties, see `docs/reference.md`).
Cards pass `filters` down for a page-level filter bar above them. Cards do not need AG Grid.

## 8. Value help

No component code: annotate the property with `Common.ValueList` (see `docs/annotations.md` § Value help). The filter
bar, the edit field (`SmartField mode="edit"`) and the create dialog then show a value help dialog (search, table of
`CollectionPath`, conditions tab) or, with `Common.ValueListWithFixedValues`, a dropdown. Standalone:

```tsx
import { useState } from 'react';
import type { Condition } from '@rhfan2019/smart-kit-core';
import { ConditionInput, ValueHelpDialog } from '@rhfan2019/smart-kit/filter';

export function SupplierFilter() {
  const [conditions, setConditions] = useState<Condition[]>([]);
  const [open, setOpen] = useState(false);
  return (
    <>
      <ConditionInput entitySet="PurchaseOrders" path="Supplier" label="Supplier" conditions={conditions} onChange={setConditions} onValueHelp={() => setOpen(true)} />
      <ValueHelpDialog
        opened={open}
        entitySet="PurchaseOrders"
        path="Supplier"
        title="Supplier"
        conditions={conditions}
        onOk={(c) => { setConditions(c); setOpen(false); }}
        onCancel={() => setOpen(false)}
      />
    </>
  );
}
```

## 9. Editing: direct save and draft

You do not choose in React. The edit strategy follows the model (ADR-018):
- **Direct save** (default; what `@rhfan2019/smart-kit-server` serves): "Edit" switches the object page to edit mode,
  "Save" sends one `PATCH` with the changed fields and `If-Match` (ETag from `Core.OptimisticConcurrency`); a stale
  ETag shows "changed by someone else" (412). Create sends `POST`, delete `DELETE`.
- **Draft** (the set has `Common.DraftRoot` with `EditAction` / `ActivationAction`, e.g. a CAP or RAP service): edit
  creates a draft, every field change is saved to the draft, "Save" activates it; the list shows draft markers.
- Validation: mandatory fields (`Common.FieldControl` Mandatory, `Nullable="false"`), `MaxLength`, Edm types are
  checked in the browser; server errors with `details[].target` appear at the field; `sap-messages` headers in the
  message popover.
- Override per entity set: `ServiceConfig.editStrategy(entitySet)` returning `new DirectEditStrategy(...)` or
  `new DraftEditStrategy(...)` from core.
- Fields that may be edited: not `Core.Computed`, not a key (except on create), not `Core.Immutable` (except on
  create), `Capabilities.UpdateRestrictions/Updatable` not false.

## 10. Actions

Annotate bound actions as `UI.DataFieldForAction` in `UI.LineItem` (table toolbar; `Inline: true` = button in the
row) or `UI.Identification` (object page header; `Determining: true` = footer). Availability per row from
`Core.OperationAvailable` on the action (a path such as `_it/IsApprovable`). Parameters (basic types) get a dialog;
several selected rows get a partial-processing dialog. After the action the list refreshes (`workingMode="worklist"`)
or keeps and marks the changed rows (`"continuous"`). To run one from your own button:

```tsx
import { useActionRunner } from '@rhfan2019/smart-kit/actions';
import { useObject } from '@rhfan2019/smart-kit/object';

export function ApproveButton({ path }: { path: string }) {
  const obj = useObject(path);
  const runner = useActionRunner({ onDone: () => obj.refresh() });
  const approve = obj.ui.objectActions.find((a) => a.action === 'Purchasing.approve');
  if (!approve || !obj.data) return null;
  return (
    <>
      <button disabled={runner.busy} onClick={() => runner.run(approve, [{ row: obj.data!, path, label: path }])}>Approve</button>
      {runner.dialogs}
    </>
  );
}
```

## 11. Messages

`SmartListReport` and `SmartObjectPage` already contain a `MessageProvider` and a message button. In a freestyle
page, wrap it yourself:

```tsx
import type { ReactNode } from 'react';
import { MessageButton, MessageProvider } from '@rhfan2019/smart-kit/messages';

export function PageWithMessages({ children }: { children: ReactNode }) {
  return (
    <MessageProvider>
      <header style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <MessageButton />
      </header>
      {children}
    </MessageProvider>
  );
}
```

## 12. Extend a template

```tsx
import { SmartListReport } from '@rhfan2019/smart-kit/templates';
import type { TableExtendEntry } from '@rhfan2019/smart-kit/table';

// Defined outside the component (or in useMemo): a new array on every render re-creates the columns.
const tableExtend: TableExtendEntry[] = [
  // a custom column after the supplier column
  { id: 'Custom::Late', position: 'after', anchor: 'DataField::Supplier', item: { id: 'Custom::Late', label: 'Late', select: ['StatusCriticality'], render: (row) => (row.StatusCriticality === 1 ? 'late' : '') } },
  // a different cell for a model column
  { id: 'DataField::PurchaseOrderType', position: 'replace', item: (col) => ({ ...col, render: (row) => <code>{String(row.PurchaseOrderType ?? '')}</code> }) },
  // a toolbar action that needs a selection
  { kind: 'action', id: 'Custom::Print', position: 'start', item: { id: 'Custom::Print', label: 'Print', requiresSelection: true, onPress: (ctx) => window.print() } },
];

export function OrdersWithExtras() {
  return <SmartListReport entitySet="PurchaseOrders" tableExtend={tableExtend} />;
}
```
