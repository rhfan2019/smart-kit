# Common mistakes (and what to do instead)

| Don't | Do | Why |
| --- | --- | --- |
| Pass columns, filter fields or form fields as React props / arrays | Annotate the service (`UI.LineItem`, `UI.SelectionFields`, `UI.FieldGroup` + `UI.Facets`) | The components read the annotations; there is no `columns={[…]}` prop on templates. `tableExtend` / `filterExtend` / `sectionExtend` are for *custom* additions. |
| Render a smart-kit component before `loadService` resolved, or outside `SmartKitProvider` / `MantineProvider` | Load the services first, render a loader meanwhile (see `docs/README.md` App setup) | Every component needs the model; outside the provider they throw `MissingProviderError`. |
| Forget the stylesheets or import them in the wrong order | `@mantine/core/styles.css`, `@mantine/dates/styles.css`, then `@rhfan2019/smart-kit/styles.css`, once in the entry | Without them the page renders unstyled; smart-kit's rules build on Mantine's. |
| `import … from '@rhfan2019/smart-kit'` everywhere | Import from the subpath (`@rhfan2019/smart-kit/templates`, `/cards`, `/chart`, …) | The root entry makes the bundler resolve AG Grid; subpaths keep the bundle to what you use. |
| Use `/table` or `/templates` without installing AG Grid | `npm install ag-grid-community ag-grid-react`, or use `/cards`, `/chart`, `/field` and `useListQuery` | They are optional peer dependencies needed only by the grid table and the templates. |
| Give the list page / object page no height | Make the route container fill the viewport (`height: 100%` down from `html, body, #root`) | Both pages lay out header, filter bar and table inside their container and scroll the table. |
| Hand-build OData URLs (`$filter=…`) for a list | Use `useListQuery` (`kit/useListQuery`) / `Table` (`v4/fe/macros/Table`) with `query.filters` (conditions per path) | Query generation handles types, `$expand` for texts, `$count`, paging and the service's restrictions. |
| Build entity paths by string concatenation of raw values | `` `Orders${keyPredicate(type, row)}` `` with `keyPredicate` from core | Keys are typed and quoted per Edm type (`'…'` for strings, composite keys `A='1',B=2`). |
| Reuse one `SmartObjectPage` instance for different objects | Give it `key={path}` | State (edit mode, scroll, sections) belongs to one object. |
| Create `tableExtend` / `sectionExtend` arrays inline in render | Define them outside the component or in `useMemo` | A new array each render rebuilds columns and sections. |
| Write labels in React | `Common.Label` (and per-language label bundles on the server) | Labels are shared by columns, filters, forms, value helps and exports. |
| Expect PUT, `$batch`, deep insert or drafts from `@rhfan2019/smart-kit-server` | Use direct save (PATCH with ETag), one POST per object; drafts need another backend | The server implements what smart-kit sends; anything else answers 501. |
| Expect a write to work because the annotation says `Updatable` | Also list the entity set in the server's `entitySets` option | Writes are opt-in on the server; unlisted sets answer 405. |
| Put business validation only in the browser | Throw `validationError(message, details)` in a server hook | The browser checks types and mandatory fields; rules belong to the server, errors with `target` show at the field. |
| Call the generated CSDL file your annotation file | Keep annotations in their own file; rerun `smart-kit generate` after schema changes | `generate` overwrites the generated files only and then checks that the annotation targets still exist. |
| Use the names `SAP`, `Fiori`, `UI5` in your component or CSS names when wrapping smart-kit | Neutral names | Trademarks; smart-kit's own names avoid them (vocabulary namespaces are standard and fine). |
| Change `locale` without reloading the services | Pass the language to `loadService` and reload when it changes | Labels come from `$metadata` per language. |
| Set `data-theme` on `<html>` for the host's own themes and wonder why smart-kit's colours change | Switch smart-kit with `data-sk-theme` / `data-sk-density`; set `data-sk-theme="host"` on `<html>` to make smart-kit ignore `data-theme` | `data-theme` / `data-density` are only read for compatibility while `<html>` has no `data-sk-theme` / `data-sk-density`. |
| `@import '@rhfan2019/smart-kit/styles.css' layer(smart-kit)` and fight the order with Tailwind / Mantine | `@import '@rhfan2019/smart-kit/styles.layered.css'` and one `@layer …, smart-kit, …;` order statement | The layered stylesheet is already inside `@layer smart-kit`; unlayered host rules always win over it. |
| Import smart-kit components in a Next.js server component (`page.tsx` without `'use client'`) and pass functions to them | Render them in a client component; pass only serializable props from the server | The entries are client modules (`'use client'`); callbacks such as `onRowNavigate` cannot cross from a server component. |
| Store "this month" as two dates in a saved view or default | Use the relative operators (`THISMONTH`, `LASTDAYS` with a number …) in the condition | They are resolved against today each time the list is read (`toFilter`, in the time zone of `SmartKitProvider`). |

## Build warnings you can ignore

- `Module "stream" has been externalized for browser compatibility, imported by …/sax/lib/sax.js`: the XML parser of
  `$metadata` (core → xml-js → sax) guards that import; it is never used in the browser.
- "Some chunks are larger than 500 kB" with `/templates` or `/table`: AG Grid and Mantine are most of it. Split the
  list and object routes with `React.lazy` if first-load size matters; pages built only from `/cards`, `/chart`,
  `/field` stay small.

## When something does not show up

- **A column / field is missing**: is it in `UI.LineItem` / the `UI.FieldGroup`? Is the property `UI.Hidden` or
  `Common.FieldControl` Hidden? Does the path exist (`smart-kit check --strict`)? Is the annotation target the
  entity *type* (`My.Order`), not the set?
- **No Create / Edit / Delete button**: `Capabilities.Insert/Update/DeleteRestrictions` on the *entity set*
  (`My.Container/Orders`), the server's `entitySets` lists the set, and `ServiceConfig.dataProvider` is the
  `ODataV4Provider` (it can write).
- **The list stays empty with "To start, set the relevant filters"**: a `Capabilities.FilterRestrictions/RequiredProperties`
  filter has no value; give it a default in `UI.SelectionVariant` or remove the restriction.
- **Rows do not navigate**: `NavigationAdapter.hasObjectPage(entitySet)` returns false or no `navigation` was given
  to `SmartKitProvider`.
- **No value help**: `Common.ValueList` must be on the property of the *filtered* entity type, and `CollectionPath`
  must be an entity set of the same service.
- **Texts show codes only**: `Common.Text` needs a navigation path the service can `$expand`
  (a generated single-valued navigation such as `_Customer`).
