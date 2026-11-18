# Annotations that drive smart-kit

> The UI is described in the service's `$metadata`. With `@rhfan2019/smart-kit-server`, the CSDL (entity types,
> keys, navigations) is generated from the database by `smart-kit generate`, and **all annotations are in a
> hand-written XML file** (e.g. `annotations/service.annotations.xml`) that the server merges into `$metadata`.
> Other OData V4 services (CAP, RAP, Olingo, …) can deliver the same annotations; `loadService({ annotationUrls })`
> or `annotationFiles` adds local ones in the browser.

Vocabulary aliases used below: `UI` = `com.sap.vocabularies.UI.v1`, `Common` = `com.sap.vocabularies.Common.v1`,
`Measures` = `Org.OData.Measures.V1`, `Capabilities` = `Org.OData.Capabilities.V1`, `Core` = `Org.OData.Core.V1`,
`Aggregation` = `Org.OData.Aggregation.V1`.

Chart views, analytical cards, numeric card headers and table totals read aggregates with `$apply` (`groupby`,
`aggregate`, `$count as`): the service must support it (smart-kit-server does).

## What each annotation does

| Annotation (target) | Effect |
| --- | --- |
| `Common.Label` (property, entity type) | Label of columns, filter fields, form fields. Missing: the property name split into words. |
| `Common.Text` (property) + `UI.TextArrangement` | Show a text with a code (`TextFirst` "Acme (1001)", `TextLast`, `TextOnly`, `TextSeparate`); the path may go through a navigation (`_Supplier/SupplierName`), smart-kit `$expand`s it. |
| `Common.ValueList` (property) | Value help dialog: `CollectionPath` (entity set), `Parameters` (`ValueListParameterInOut` = the key that is written back, `ValueListParameterDisplayOnly` = extra columns, `ValueListParameterIn` = filter from another field). |
| `Common.ValueListWithFixedValues` (property) | Dropdown instead of a dialog (small code lists). Use it **together with** `Common.ValueList` on the same property: the value list says where the values come from, this term only switches the presentation. The values (dropdown, suggestions, tokens) follow `UI.TextArrangement` of the property (or of the value list's key property): `TextOnly` shows the text without the code; without an arrangement "Text (Code)". |
| `Common.SemanticKey` (entity type) | The human key: bold in tables, used in titles and breadcrumbs. |
| `Common.FieldControl` (property) | `Mandatory` (marker + validation), `ReadOnly`, `Hidden` (constant values). |
| `Common.DraftRoot` (entity set) | Draft editing (a draft-capable service; smart-kit-server does not serve drafts). |
| `Measures.ISOCurrency` / `Measures.Unit` (property) | Amount with currency (digits per currency) / quantity with unit; path or constant. |
| `UI.HeaderInfo` (entity type) | `TypeName`, `TypeNamePlural` (list title), `Title`, `Description`, `ImageUrl` (object page header). |
| `UI.LineItem` (entity type) | Table columns in order: `DataField` (`Value`, `Label`, `Criticality`), `DataFieldWithUrl`, `DataFieldForAnnotation` (→ `@UI.DataPoint#X` rating / progress / key value, or `@UI.Chart#X` micro chart), `DataFieldForAction` (toolbar button; `Inline: true` = in the row). `UI.Importance` (High / Medium / Low) decides which columns the responsive table drops first. Qualified `UI.LineItem#X` for sub-tables, cards, views. |
| `UI.SelectionFields` (entity type) | Filter bar fields, in order. Other filterable properties are in "Adapt Filters". |
| `UI.PresentationVariant` (entity type) | Default `SortOrder`, which `UI.LineItem` / `UI.Chart` to show (`Visualizations`), `RequestAtLeast`, `MaxItems` (cards), `GroupBy` (card groups; default grouping of list tables), `Total` (columns totaled by default in analytical tables; an empty `Total` totals nothing, without it all custom aggregates). |
| `Aggregation.ApplySupported` (entity set or type) | Enables totals and group subtotals of **analytical tables** (`type="AnalyticalTable"`, `tableType="AnalyticalTable"`): `GroupableProperties` = what a table can group by. Grid tables never group or total; responsive tables group without subtotals (D39). |
| `Aggregation.CustomAggregate#Prop` (entity type or set) | The measures an analytical table can total (qualifier = property name, value = its type, e.g. `<Annotation Term="Aggregation.CustomAggregate" Qualifier="NetAmount" String="Edm.Decimal"/>`); requested with its unit as `aggregate(NetAmount,Currency)` (smart-kit-server sums it and returns the currency, or null for several: the cell then shows "Show Details" with the amount per currency). Without custom aggregates nothing is totaled. |
| `UI.SelectionVariant` (entity type) | Default / fixed filter conditions (`SelectOptions` with `Ranges`). |
| `UI.SelectionPresentationVariant#X` (entity type) | One view of a list (`views` prop): `Text`, `SelectionVariant`, `PresentationVariant`. |
| `UI.Facets` (entity type) | Object page body: `CollectionFacet` = section with `ID` and `Label`; nested `ReferenceFacet` = subsection with `Target`: `@UI.FieldGroup#X` (form), `@UI.Identification` (form), `_Nav/@UI.LineItem#X` (sub-table of a collection navigation), `@UI.DataPoint#X`, `@UI.Chart#X`. A top-level `ReferenceFacet` is a section with one subsection. `UI.PartOfPreview: false` = behind "Show More". |
| `UI.HeaderFacets` (entity type) | Object page header: `ReferenceFacet`s to `@UI.DataPoint#X` (key value, rating, progress), `@UI.FieldGroup#X` (small form), `@UI.Chart#X` (micro chart). |
| `UI.FieldGroup#X` (entity type) | A form group: `Data` with `DataField`s. |
| `UI.Identification` (entity type) | Default form fields; `DataFieldForAction` here = object page header actions (`Determining: true` = footer). |
| `UI.DataPoint#X` (entity type) | `Value`, `Title`, `TargetValue`, `Visualization` (`Rating`, `Progress`, `Number`), `Criticality` or `CriticalityCalculation`, `TrendCalculation`. |
| `UI.Chart#X` (entity type) | `ChartType`, `Dimensions`, `Measures` (or `DynamicMeasures`), `MeasureAttributes`. Column / Bar / Line / Donut / Pie in list chart views and analytical cards; Bullet, Radial, HarveyBall, Delta, Column, Line, Comparison, Area, StackedBar as micro charts. |
| `UI.Criticality` (property) / `DataField/Criticality` | Status colour: 0 neutral, 1 negative, 2 critical, 3 positive, 5 information (a path to a numeric property, or a constant). `UI.CriticalityRepresentation` `WithoutIcon` hides the icon. |
| `UI.Hidden` (property) | Never shown. `UI.HiddenFilter`: not offered as a filter. |
| `UI.MultiLineText`, `UI.IsImageURL` (property) | Text area / avatar. |
| `UI.QuickViewFacets` (entity type of a navigation target) | Popover on a link to that entity. |
| `Capabilities.SearchRestrictions/Searchable` (entity set) | Search field in the filter bar (`$search`). With smart-kit-server also list the fields in `searchFields`. |
| `Capabilities.FilterRestrictions` (entity set) | `RequiredProperties` (mandatory filters: the list waits for them), `NonFilterableProperties`, `FilterExpressionRestrictions` (`SingleValue`, `MultiValue`, `SingleRange`, `SearchExpression`). |
| `Capabilities.SortRestrictions` (entity set) | `NonSortableProperties`. |
| `Capabilities.InsertRestrictions` / `UpdateRestrictions` / `DeleteRestrictions` (entity set) | Create / Edit / Delete buttons (`Insertable`, `Updatable`, `Deletable`). Also `NavigationRestrictions` per sub-table. |
| `Core.Computed` / `Core.Immutable` (property) | Not editable / editable only on create. |
| `Core.OptimisticConcurrency` (entity set) | ETag property; edits send `If-Match`. |
| `Core.OperationAvailable` (action) | Whether an action is enabled for a row (path such as `_it/IsOpen`). |

Annotation targets: an entity type is `Namespace.Type`, a property `Namespace.Type/Property`, an entity set
`Namespace.Container/Set`, a bound action `Namespace.action(Namespace.Type)`. Annotations on the same target and term
from a later file replace earlier ones (whole term).

## Annotation file template (list page + object page)

Replace `My`, `Order`, `Orders`, `Items` and the property names; every target and path must exist in the generated
CSDL (`smart-kit check --strict` tells you when one does not). Labels can be literal strings, or
`{{label:key}}` placeholders filled per language from `metadata.labels` of `createODataService`.

```xml
<?xml version="1.0" encoding="utf-8"?>
<edmx:Edmx Version="4.0" xmlns:edmx="http://docs.oasis-open.org/odata/ns/edmx">
  <edmx:Reference Uri="https://sap.github.io/odata-vocabularies/vocabularies/UI.xml">
    <edmx:Include Namespace="com.sap.vocabularies.UI.v1" Alias="UI"/>
  </edmx:Reference>
  <edmx:Reference Uri="https://sap.github.io/odata-vocabularies/vocabularies/Common.xml">
    <edmx:Include Namespace="com.sap.vocabularies.Common.v1" Alias="Common"/>
  </edmx:Reference>
  <edmx:Reference Uri="https://oasis-tcs.github.io/odata-vocabularies/vocabularies/Org.OData.Measures.V1.xml">
    <edmx:Include Namespace="Org.OData.Measures.V1" Alias="Measures"/>
  </edmx:Reference>
  <edmx:Reference Uri="https://oasis-tcs.github.io/odata-vocabularies/vocabularies/Org.OData.Capabilities.V1.xml">
    <edmx:Include Namespace="Org.OData.Capabilities.V1" Alias="Capabilities"/>
  </edmx:Reference>
  <edmx:Reference Uri="https://oasis-tcs.github.io/odata-vocabularies/vocabularies/Org.OData.Core.V1.xml">
    <edmx:Include Namespace="Org.OData.Core.V1" Alias="Core"/>
  </edmx:Reference>
  <edmx:DataServices>
    <Schema Namespace="My" xmlns="http://docs.oasis-open.org/odata/ns/edm">
      <!-- entity set: search, mandatory filters, what may be changed -->
      <Annotations Target="My.Container/Orders">
        <Annotation Term="Capabilities.SearchRestrictions">
          <Record><PropertyValue Property="Searchable" Bool="true"/></Record>
        </Annotation>
        <Annotation Term="Capabilities.InsertRestrictions">
          <Record><PropertyValue Property="Insertable" Bool="true"/></Record>
        </Annotation>
        <Annotation Term="Capabilities.UpdateRestrictions">
          <Record><PropertyValue Property="Updatable" Bool="true"/></Record>
        </Annotation>
        <Annotation Term="Capabilities.DeleteRestrictions">
          <Record><PropertyValue Property="Deletable" Bool="true"/></Record>
        </Annotation>
        <!-- optimistic locking: an integer column "version"; the server counts it up on every write -->
        <Annotation Term="Core.OptimisticConcurrency">
          <Collection><PropertyPath>Version</PropertyPath></Collection>
        </Annotation>
      </Annotations>
      <!-- entity type: list, header, object page -->
      <Annotations Target="My.Order">
        <Annotation Term="UI.HeaderInfo">
          <Record Type="UI.HeaderInfoType">
            <PropertyValue Property="TypeName" String="Order"/>
            <PropertyValue Property="TypeNamePlural" String="Orders"/>
            <PropertyValue Property="Title"><Record Type="UI.DataField"><PropertyValue Property="Value" Path="OrderNo"/></Record></PropertyValue>
            <PropertyValue Property="Description"><Record Type="UI.DataField"><PropertyValue Property="Value" Path="Description"/></Record></PropertyValue>
          </Record>
        </Annotation>
        <Annotation Term="UI.SelectionFields">
          <Collection>
            <PropertyPath>OrderNo</PropertyPath>
            <PropertyPath>Customer</PropertyPath>
            <PropertyPath>Status</PropertyPath>
          </Collection>
        </Annotation>
        <Annotation Term="UI.LineItem">
          <Collection>
            <Record Type="UI.DataField"><PropertyValue Property="Value" Path="OrderNo"/></Record>
            <Record Type="UI.DataField"><PropertyValue Property="Value" Path="Customer"/></Record>
            <Record Type="UI.DataField">
              <PropertyValue Property="Value" Path="Status"/>
              <PropertyValue Property="Criticality" Path="StatusCriticality"/>
            </Record>
            <Record Type="UI.DataField"><PropertyValue Property="Value" Path="NetAmount"/></Record>
          </Collection>
        </Annotation>
        <Annotation Term="UI.PresentationVariant">
          <Record Type="UI.PresentationVariantType">
            <PropertyValue Property="SortOrder">
              <Collection>
                <Record Type="Common.SortOrderType">
                  <PropertyValue Property="Property" PropertyPath="OrderNo"/>
                  <PropertyValue Property="Descending" Bool="true"/>
                </Record>
              </Collection>
            </PropertyValue>
          </Record>
        </Annotation>
        <Annotation Term="UI.FieldGroup" Qualifier="General">
          <Record Type="UI.FieldGroupType">
            <PropertyValue Property="Data">
              <Collection>
                <Record Type="UI.DataField"><PropertyValue Property="Value" Path="Customer"/></Record>
                <Record Type="UI.DataField"><PropertyValue Property="Value" Path="OrderDate"/></Record>
                <Record Type="UI.DataField"><PropertyValue Property="Value" Path="NetAmount"/></Record>
              </Collection>
            </PropertyValue>
          </Record>
        </Annotation>
        <Annotation Term="UI.Facets">
          <Collection>
            <Record Type="UI.CollectionFacet">
              <PropertyValue Property="ID" String="General"/>
              <PropertyValue Property="Label" String="General Information"/>
              <PropertyValue Property="Facets">
                <Collection>
                  <Record Type="UI.ReferenceFacet">
                    <PropertyValue Property="ID" String="GeneralData"/>
                    <PropertyValue Property="Label" String="General"/>
                    <PropertyValue Property="Target" AnnotationPath="@UI.FieldGroup#General"/>
                  </Record>
                </Collection>
              </PropertyValue>
            </Record>
            <Record Type="UI.ReferenceFacet">
              <PropertyValue Property="ID" String="Items"/>
              <PropertyValue Property="Label" String="Items"/>
              <PropertyValue Property="Target" AnnotationPath="_Items/@UI.LineItem"/>
            </Record>
          </Collection>
        </Annotation>
        <Annotation Term="Common.SemanticKey">
          <Collection><PropertyPath>OrderNo</PropertyPath></Collection>
        </Annotation>
      </Annotations>
      <!-- properties: labels, texts, currencies, value help -->
      <Annotations Target="My.Order/Customer">
        <Annotation Term="Common.Label" String="Customer"/>
        <Annotation Term="Common.Text" Path="_Customer/Name">
          <Annotation Term="UI.TextArrangement" EnumMember="UI.TextArrangementType/TextFirst"/>
        </Annotation>
        <Annotation Term="Common.ValueList">
          <Record Type="Common.ValueListType">
            <PropertyValue Property="Label" String="Customers"/>
            <PropertyValue Property="CollectionPath" String="Customers"/>
            <PropertyValue Property="Parameters">
              <Collection>
                <Record Type="Common.ValueListParameterInOut">
                  <PropertyValue Property="LocalDataProperty" PropertyPath="Customer"/>
                  <PropertyValue Property="ValueListProperty" String="Customer"/>
                </Record>
                <Record Type="Common.ValueListParameterDisplayOnly">
                  <PropertyValue Property="ValueListProperty" String="Name"/>
                </Record>
              </Collection>
            </PropertyValue>
          </Record>
        </Annotation>
      </Annotations>
      <Annotations Target="My.Order/Version">
        <Annotation Term="Core.Computed" Bool="true"/>
        <Annotation Term="UI.Hidden" Bool="true"/>
      </Annotations>
      <Annotations Target="My.Order/StatusCriticality">
        <Annotation Term="UI.Hidden" Bool="true"/>
      </Annotations>
      <Annotations Target="My.Order/NetAmount">
        <Annotation Term="Common.Label" String="Net Amount"/>
        <Annotation Term="Measures.ISOCurrency" Path="Currency"/>
      </Annotations>
      <!-- the item entity type needs its own UI.LineItem for the sub-table -->
      <Annotations Target="My.OrderItem">
        <Annotation Term="UI.LineItem">
          <Collection>
            <Record Type="UI.DataField"><PropertyValue Property="Value" Path="ItemNo"/></Record>
            <Record Type="UI.DataField"><PropertyValue Property="Value" Path="Product"/></Record>
            <Record Type="UI.DataField"><PropertyValue Property="Value" Path="Quantity"/></Record>
          </Collection>
        </Annotation>
      </Annotations>
    </Schema>
  </edmx:DataServices>
</edmx:Edmx>
```

## Status with a colour

`Criticality` needs a number (0 neutral, 1 negative/red, 2 critical/orange, 3 positive/green, 5 information) per row.
The simplest source is a generated column next to the status — `smart-kit generate` marks it `Core.Computed`, so it is
never offered for editing; hide it with `UI.Hidden`:

```sql
ALTER TABLE my.sales_order ADD COLUMN status_criticality smallint
  GENERATED ALWAYS AS (CASE status WHEN 'DONE' THEN 3 WHEN 'LATE' THEN 1 WHEN 'OPEN' THEN 2 ELSE 0 END) STORED;
```

Then `<PropertyValue Property="Criticality" Path="StatusCriticality"/>` on the `DataField` of `Status` (and the same
`Path` in `UI.DataPoint/Criticality` for the object page header). A constant also works:
`<PropertyValue Property="Criticality" EnumMember="UI.CriticalityType/Positive"/>`.

Bound actions are declared in the same file (the database does not know them) and implemented in the server's
`actions` option — see `@rhfan2019/smart-kit-server` `docs/README.md` § Actions.
