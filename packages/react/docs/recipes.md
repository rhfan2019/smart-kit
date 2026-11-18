# smart-kit recipes

> Every `tsx` block here is a complete module and is type-checked against the package in CI
> (`tests/unit/agent-docs.test.ts` in the smart-kit repository). All of them assume the app setup of `docs/README.md`
> (`MantineProvider` + `SmartKitProvider` around the page). Entity sets and properties are from the purchasing
> example service (`PurchaseOrders` with items `_Items`, `Suppliers`); replace them with yours.

## 1. List page (filter bar, variants, table)

```tsx
import ListReport from '@rhfan2019/smart-kit/v4/fe/templates/ListReport';

export function PurchaseOrderList() {
  return <ListReport contextPath="/PurchaseOrders" />;
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
import ObjectPage from '@rhfan2019/smart-kit/v4/fe/templates/ObjectPage';

/** `path` is an entity path such as "PurchaseOrders('4500000001')" (usually from the route). */
export function PurchaseOrderObject({ path }: { path: string }) {
  return <ObjectPage key={path} path={path} sectionLayout="Tabs" />;
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

The props are the manifest settings of the FE object page (`sap.ui5 › routing › targets › <target> › options ›
settings`, docs/26c): `sectionLayout="Page"` (default) shows all sections in one scrolling page; `"Tabs"` one section
at a time (better for long sub-tables); `editableHeaderContent` (default `true`: while editing, the header fields are
edited in a "Header" section), `content.header` / `content.body.sections` / `content.footer.actions` (custom facets,
sections and actions; FE fragment names and extension functions become render functions and handlers),
`controlConfiguration["_Item/@com.sap.vocabularies.UI.v1.LineItem"].tableSettings` for sub-tables. New object:
`<ObjectPage path="" create={{ entitySet: 'PurchaseOrders' }} />`. Sub-object pages
(an item of an order) are the same component with the longer path, e.g. `PurchaseOrders('1')/_Items(PurchaseOrder='1',ItemNo=10)`.

## 3. Freestyle page from building blocks

Use when the template does not fit: your own layout, a filter bar and a table wired by `useFilterState`.

```tsx
import { Button } from '@mantine/core';
import FilterSummary from '@rhfan2019/smart-kit/kit/FilterSummary';
import useFilterState from '@rhfan2019/smart-kit/kit/useFilterState';
import FilterBar from '@rhfan2019/smart-kit/v4/fe/macros/FilterBar';
import DynamicPage from '@rhfan2019/smart-kit/f/DynamicPage';
import DynamicPageTitle from '@rhfan2019/smart-kit/f/DynamicPageTitle';
import DynamicPageHeader from '@rhfan2019/smart-kit/f/DynamicPageHeader';
import Table from '@rhfan2019/smart-kit/v4/fe/macros/Table';
import useTableContext from '@rhfan2019/smart-kit/kit/useTableContext';
import { useMetaModel } from '@rhfan2019/smart-kit/context';

function Toolbar() {
  const table = useTableContext();
  return (
    <div className="sk-table__toolbar">
      <Table.Title />
      <span className="sk-grow" />
      <Button variant="default" size="xs" onClick={table.refresh}>Refresh</Button>
      <Table.Settings />
    </div>
  );
}

export function OrdersWorklist() {
  const filter = useFilterState('PurchaseOrders', { pageKey: 'worklist', liveMode: true });
  const { ui } = useMetaModel('PurchaseOrders');
  return (
    <DynamicPage
      title={<DynamicPageTitle heading={ui.headerInfo.typeNamePlural} snappedContent={<FilterSummary entitySet="PurchaseOrders" filters={filter.filters} search={filter.search} />} />}
      header={<DynamicPageHeader><FilterBar state={filter} /></DynamicPageHeader>}
      content={(
        // query: the applied filters; null = not executed yet (mandatory filters missing)
        <Table contextPath="/PurchaseOrders" query={filter.applied} pageKey="worklist">
          <Toolbar />
        </Table>
      )}
    />
  );
}
```

Without AG Grid: `<Table type="ResponsiveTable" …>` (`v4/fe/macros/Table`) still imports AG Grid. If AG Grid is not
installed, use `useListQuery` (`kit/useListQuery`) and render rows yourself (§ 4) or `m/Table` (sap.m.Table) with your own data.

## 4. Fully custom UI with hooks (no AG Grid)

```tsx
import useListQuery from '@rhfan2019/smart-kit/kit/useListQuery';
import Field from '@rhfan2019/smart-kit/v4/fe/macros/Field';
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
          <Field contextPath="/PurchaseOrders" metaPath="PurchaseOrder" row={row} /> —{' '}
          <Field contextPath="/PurchaseOrders" metaPath="NetAmount" row={row} />
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
import useObject from '@rhfan2019/smart-kit/kit/useObject';
import Form from '@rhfan2019/smart-kit/v4/fe/macros/Form';

export function SupplierPanel({ path }: { path: string }) {
  const obj = useObject(path); // e.g. "Suppliers('0000100001')"
  if (obj.isLoading) return <p>Loading…</p>;
  if (obj.error) return <p role="alert">{obj.error.message}</p>;
  // the first form of the first section, as the annotations describe it
  const content = obj.ui.sections[0]?.subSections[0]?.content;
  return content?.kind === 'form' ? <Form typeName={obj.typeName} row={obj.data} metaPath={content.groups} /> : null;
}
```

## 6. Charts

- In a list page: a view whose `UI.PresentationVariant` / `UI.SelectionPresentationVariant` shows a chart
  (`<ListReport contextPath="/PurchaseOrders" views={{ paths: [{ key: 'table', annotationPath: 'com.sap.vocabularies.UI.v1.PresentationVariant' }, { key: 'chart', annotationPath: 'com.sap.vocabularies.UI.v1.PresentationVariant#ByStatus' }] }} />`),
  or a default presentation variant that names a chart first; the chart is `UI.Chart` (Column, Bar, Line, Donut, Pie) aggregated on the server with `$apply` (smart-kit-server supports it).
- In a table column, a header facet or a card: a `DataFieldForAnnotation` pointing to a `UI.Chart` with
  `ChartType` Bullet, Radial, HarveyBall, Delta(Bullet), Column, Line, Comparison, Area, StackedBar — drawn as a
  micro chart, no code.
- Standalone, with your own numbers: the sap.suite.ui.microchart controls (no service needed, about 3 KB gzip each):

```tsx
import BulletMicroChart from '@rhfan2019/smart-kit/suite/ui/microchart/BulletMicroChart'; // sap/suite/ui/microchart/BulletMicroChart
import BulletMicroChartData from '@rhfan2019/smart-kit/suite/ui/microchart/BulletMicroChartData';
import ColumnMicroChart from '@rhfan2019/smart-kit/suite/ui/microchart/ColumnMicroChart';
import SimpleChart from '@rhfan2019/smart-kit/kit/SimpleChart';

export function Kpis() {
  return (
    <>
      <BulletMicroChart aria-label="Budget used" targetValue={80} maxValue={100} thresholds={[{ value: 90, color: 'Error' }]}>
        <BulletMicroChartData value={72} color="Critical" />
      </BulletMicroChart>
      <ColumnMicroChart aria-label="Orders per month" columns={[{ label: 'Jan', value: 12 }, { label: 'Feb', value: 18 }, { label: 'Mar', value: 9 }]}
        leftBottomLabel={{ label: 'Jan' }} rightBottomLabel={{ label: 'Mar' }} />
      <SimpleChart kind="bar" measureLabel="Net amount" dimensionLabel="Supplier" data={[{ key: 'A', label: 'Acme', value: 1200 }, { key: 'B', label: 'Bolt', value: 800 }]} />
    </>
  );
}
```

- From the annotations, outside the templates (sap.fe.macros building blocks):

```tsx
import Chart from '@rhfan2019/smart-kit/v4/fe/macros/Chart'; // sap/fe/macros/Chart
import MicroChart from '@rhfan2019/smart-kit/v4/fe/macros/MicroChart';
import type { FilterState, Row } from '@rhfan2019/smart-kit-core';

declare const filters: FilterState, search: string, order: Row;
<>
  <Chart contextPath="/PurchaseOrders" metaPath="@com.sap.vocabularies.UI.v1.Chart#ByStatus" query={{ filters, search }} onSelectionChange={(e) => console.log(e.data, e.selected)} />
  <MicroChart contextPath="/PurchaseOrders" metaPath="@UI.Chart#BudgetBullet" row={order} size="M" />
</>
```

## 7. Cards (overview tiles)

Names and settings as in SAPUI5 integration / OVP cards. Contents read the same annotations; qualifiers pick a
specific `UI.LineItem#X`, `UI.PresentationVariant#X` (sort, `MaxItems`), `UI.SelectionVariant#X` (fixed filter),
`UI.Chart#X`, `UI.DataPoint#X`. Paths may be written `@UI.LineItem#Card` or `com.sap.vocabularies.UI.v1.LineItem#Card`.

```tsx
import AnalyticalContent from '@rhfan2019/smart-kit/ui/integration/cards/AnalyticalContent';
import Card from '@rhfan2019/smart-kit/f/Card';
import Header from '@rhfan2019/smart-kit/f/cards/Header';
import ListContent from '@rhfan2019/smart-kit/ui/integration/cards/ListContent';
import NumericHeader from '@rhfan2019/smart-kit/f/cards/NumericHeader';
import TableContent from '@rhfan2019/smart-kit/ui/integration/cards/TableContent';

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
bar, the edit field (`Field readOnly={false}`) and the create dialog then show a value help dialog (search, table of
`CollectionPath`, conditions tab) or, with `Common.ValueListWithFixedValues`, a dropdown. Standalone:

```tsx
import { useState } from 'react';
import type { Condition } from '@rhfan2019/smart-kit-core';
import ConditionInput from '@rhfan2019/smart-kit/kit/ConditionInput';
import ValueHelpDialog from '@rhfan2019/smart-kit/kit/ValueHelpDialog';

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
import useActionRunner from '@rhfan2019/smart-kit/kit/useActionRunner';
import useObject from '@rhfan2019/smart-kit/kit/useObject';

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

`ListReport` and `ObjectPage` already contain a `MessageProvider` and a message button. In a freestyle
page, wrap it yourself:

```tsx
import type { ReactNode } from 'react';
import MessageButton from '@rhfan2019/smart-kit/v4/fe/macros/MessageButton';
import MessageProvider from '@rhfan2019/smart-kit/kit/MessageProvider';

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
import ListReport, { type $ListReportSettings } from '@rhfan2019/smart-kit/v4/fe/templates/ListReport';

// The settings of a Fiori elements manifest (sap.ui5 › routing › targets › <list> › options › settings); where FE names a
// fragment or an extension handler (template, press, rowPress), React takes the function. Defined outside the component
// (or in useMemo): a new object on every render re-creates the columns.
const settings: $ListReportSettings = {
  contextPath: '/PurchaseOrders',
  initialLoad: 'Enabled',
  controlConfiguration: {
    '@com.sap.vocabularies.UI.v1.LineItem': {
      tableSettings: { type: 'GridTable', selectionMode: 'Multi' },
      // a custom column after the supplier column
      columns: { 'Custom::Late': { header: 'Late', properties: ['StatusCriticality'], template: (row) => (row.StatusCriticality === 1 ? 'late' : ''), position: { anchor: 'DataField::Supplier', placement: 'After' } } },
      // a toolbar action that needs a selection, and a menu of two annotation actions
      actions: {
        'Custom::Print': { text: 'Print', requiresSelection: true, press: () => window.print() },
        decide: { text: 'Decide', menu: ['DataFieldForAction::Purchasing.approve', 'DataFieldForAction::Purchasing.reject'] },
      },
    },
  },
};

export function OrdersWithExtras() {
  return <ListReport {...settings} />;
}
```

## 13. Host-controlled lists: refresh, export, view permissions, rows from the host

```tsx
import { MemoryProvider, ODataVariantStore, type MetaModel, type ODataV4Provider, type Row } from '@rhfan2019/smart-kit-core';
import type { ServiceConfig } from '@rhfan2019/smart-kit/context';
import ListReport from '@rhfan2019/smart-kit/v4/fe/templates/ListReport';
import type { Table$BeforeExportEvent } from '@rhfan2019/smart-kit/v4/fe/macros/Table';

// Views: users without the permission only select views (no Save, Save As, Manage).
export const variantsFor = (provider: ODataV4Provider, canSave: boolean) => new ODataVariantStore(provider, 'Variants', { canSave });

// Rows computed by the host (a worklist): MemoryProvider filters, searches, sorts, counts, groups and totals them.
export function worklistService(model: MetaModel, rows: Row[]): { service: ServiceConfig; provider: MemoryProvider } {
  const provider = new MemoryProvider({ model, data: { Worklist: rows } });
  return { service: { model, dataProvider: provider }, provider };
}

export function Worklist(p: { revision: number; log(e: Table$BeforeExportEvent): Promise<boolean> }) {
  return (
    <ListReport
      contextPath="/Worklist"
      refreshToken={p.revision} // change it after provider.setRows(...) or after the host changed data elsewhere
      // enableExport: false removes "Export to Spreadsheet"
      controlConfiguration={{ '@com.sap.vocabularies.UI.v1.LineItem': { tableSettings: { enableExport: true } } }}
      onBeforeExport={(e) => p.log(e)} // rows, filters and count of the file; false cancels (no file)
      // grouping with row counts, subtotals and totals: tableSettings.type "AnalyticalTable" (custom aggregates only, D39);
      // responsive tables group without subtotals (view settings → Group, or `UI.PresentationVariant/GroupBy`)
    />
  );
}
```

- A failed save in the view dialogs (the `VariantStore` throws) shows the thrown message in the dialog, which stays open.
- `ObjectPage`: `editableHeaderContent={false}` keeps the header read-only while editing (no "Header" section); there
  is no "Edit Header" dialog and no switch for "Share" (as in Fiori elements V4).
- Custom columns (`controlConfiguration › @UI.LineItem › columns`) take `importance: 'High' | 'Medium' | 'Low'` for the pop-in of responsive tables.
- Host sticky bars above a page that scrolls with the window: set `--sk-sticky-top` to their height.
- Object page header without an image: `UI.HeaderInfo/Initials` (or, for types with `Communication.Contact`, the
  title's initials) in an avatar; round for persons, a rounded square otherwise.

## 14. Next.js App Router, CSS layers, theming, relative dates, FCL ratios

The React entries carry `'use client'` (all except `/i18n`), so a server component that imports one gets a client
reference, not a hooks error. Keep smart-kit in client components:

```tsx
'use client';
import ListReport from '@rhfan2019/smart-kit/v4/fe/templates/ListReport';

export function OrdersList() {
  return <ListReport contextPath="/Orders" />;
}
```

With Tailwind 4 or other layered styles, import the layered stylesheet once and declare the layer order; unlayered
host rules always win over smart-kit, so the host can redefine any `--sk-*` token:

```css
@layer theme, base, mantine, smart-kit, components, utilities;
@import '@mantine/core/styles.layer.css';
@import '@mantine/dates/styles.layer.css';
@import '@rhfan2019/smart-kit/styles.layered.css';

/* the host's own colours for smart-kit (unlayered: wins over @layer smart-kit) */
:root { --sk-color-link: var(--color-brand-600); --sk-color-accent: var(--color-brand-500); }
```

Themes: `data-sk-theme` (`yellow`, `navy`, `sky`, `dark`) and `data-sk-density` (`comfortable`, `compact`) on `<html>`
or a container. If the host uses `data-theme` itself, put `data-sk-theme="host"` on `<html>`: smart-kit then ignores
`data-theme` / `data-density` and keeps its defaults until the host overrides the tokens.

Relative dates in conditions (defaults, `initialFilters`, saved views): the condition stores the operator and is
resolved against today (in `SmartKitProvider` `timeZone`) whenever the list is read. Users pick them with the
calendar-clock button of date filter fields or in the value help ("Define Conditions").

```ts
import type { FilterState } from '@rhfan2019/smart-kit-core';

export const recent: FilterState = {
  OrderDate: [{ operator: 'LASTDAYS', values: [30] }], // the 30 days before today (today excluded, as in SAPUI5)
  DeliveryDate: [{ operator: 'THISMONTH', values: [] }],
  ChangedAt: [{ operator: 'TODAY', values: [], exclude: true }],
};
```

`FlexibleColumnLayout` separators can be dragged (or moved with the keyboard), as in SAPUI5 1.154: the column sizes
change and `onColumnsDistributionChange({ media, layout, columnsSizes })` fires. The full screen / close buttons of
`FlexibleColumnLayoutActions` in a column's title only fire `onStateChange({ layout, maxColumnsCount,
isNavigationArrow, isResize })`; the host's router stores the layout (ADR-022). `autoFocus` (default true) moves the
focus into a column when it shows a new page. The kit extension `separatorArrows` (default false) adds the older arrow
buttons that switch between the ratios (`TwoColumnsMidExpanded` 33/67 ↔ `TwoColumnsBeginExpanded` 67/33; three columns
25/50/25 ↔ 25/25/50 ↔ 67/33/0 …).

```tsx
import FlexibleColumnLayout, { type $FlexibleColumnLayoutSettings } from '@rhfan2019/smart-kit/f/FlexibleColumnLayout';
import { useState, type ReactNode } from 'react';

type LayoutType = NonNullable<$FlexibleColumnLayoutSettings['layout']>;

export function TwoColumns(p: { list: ReactNode; detail: ReactNode; onClose(): void }) {
  const [layout, setLayout] = useState<LayoutType>('TwoColumnsMidExpanded'); // usually a URL parameter
  // closing the mid column (FlexibleColumnLayoutActions) asks for OneColumn
  return (
    <FlexibleColumnLayout
      layout={layout} onStateChange={(e) => (e.layout === 'OneColumn' ? p.onClose() : setLayout(e.layout))}
      beginColumnPages={p.list} midColumnPages={p.detail}
    />
  );
}
```

## 15. Tree table (recursive hierarchy)

The entity type needs `Aggregation.RecursiveHierarchy#Q` (`NodeProperty`, `ParentNavigationProperty`) and
`Hierarchy.RecursiveHierarchy#Q` (`DrillState`, `DistanceFromRoot`, `LimitedDescendantCount`). The table reads the
visible nodes with `$apply=…/com.sap.vocabularies.Hierarchy.v1.TopLevels(…)` (filters and search through
`ancestors(…,keep start)`); `MemoryProvider` answers the same requests. `TreeTable` (`v4/fe/macros/TreeTable`, sap.fe.macros.TreeTable)
shows it; `responsive` gives a responsive tree. The tree methods and the event are those of `sap.ui.table.TreeTable`; row
indexes count the visible rows. No paging, grouping or totals.

```tsx
import TreeTable from '@rhfan2019/smart-kit/v4/fe/macros/TreeTable';
import { useRef } from 'react';

export function CostCenterTree() {
  const ref = useRef<TreeTable>(null);
  return (
    <TreeTable
      contextPath="/CostCenters"
      hierarchyQualifier="CostCenterHierarchy" // default: the first hierarchy of the type
      ref={ref} // expand(rowIndex), collapse(rowIndex), collapseAll(), expandToLevel(level), isExpanded(rowIndex)
      onToggleOpenState={(e) => console.log(e.rowIndex, e.rowContext, e.expanded)} // user toggles only
      toolbarEnd={<button type="button" onClick={() => ref.current?.expandToLevel(3)}>Expand all</button>}
    />
  );
}
```
