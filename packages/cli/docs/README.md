# @rhfan2019/smart-kit-cli for coding agents

> Ships inside the package (`node_modules/@rhfan2019/smart-kit-cli/docs/`). Development tool, install it as a dev
> dependency: `npm install -D @rhfan2019/smart-kit-cli`. The command is `smart-kit` (`npx smart-kit …`).
> Whole flow: `node_modules/@rhfan2019/smart-kit/skills/smart-kit-getting-started/SKILL.md`.

## Commands

| Command | What it does |
| --- | --- |
| `smart-kit generate [--config smart-kit.config.json] [--url postgres://…] [--strict]` | Reads one PostgreSQL schema (tables, columns, primary and foreign keys, comments), writes the CSDL (`output.csdl`) and the storage mapping (`output.storage`) for `@rhfan2019/smart-kit-server`, then checks the annotation files. Rewrites only the two generated files ("Unchanged" when nothing changed). |
| `smart-kit check [--config …] [--strict]` | Checks the annotation files against the generated CSDL on disk, and the declared navigations (below) against the generated CSDL and storage mapping, no database. `--strict`: exit code 1 when a target, path, entity or column does not exist (use in CI). |
| `smart-kit agents` | Writes / refreshes a block in `AGENTS.md` that points coding agents to the docs of the installed smart-kit packages, and adds `@AGENTS.md` to `CLAUDE.md`. Run it after installing or upgrading smart-kit. |

Connection: `--url`, else `SMART_KIT_DATABASE_URL`, else `connection` in the config, else the `PG*` environment
variables. The role only needs to read the catalog (a read-only role is enough).

## smart-kit.config.json

```json
{
  "connection": "postgresql://shop_reader@localhost:5432/shop",
  "schema": "shop",
  "namespace": "Shop",
  "output": { "csdl": "generated/shop.csdl.xml", "storage": "generated/shop.storage.json" },
  "annotations": ["annotations/shop.annotations.xml"],
  "entities": {
    "sales_order": { "set": "Orders" },
    "audit_log": { "skip": true },
    "order_status": { "properties": { "criticality": { "type": "Edm.Byte" } } }
  },
  "navigations": {
    "sales_order_item_order_id_fkey": { "toMany": "_Items", "toOne": "_Order" }
  }
}
```

Paths are relative to the config file. `schema`, `namespace`, `output.csdl`, `output.storage` are required;
`container` defaults to `Container` (so entity sets are `Shop.Container/<Set>` as annotation targets).

## Navigations without a foreign key (views)

Navigations come from foreign key constraints, and views have none. Declare them in `navigations` with an entry that
has `from` (the entry's name is free; it only appears in messages):

```json
{
  "entities": {
    "user_list": { "set": "Users", "keys": ["Id"] },
    "user_role_list": { "set": "UserRoles", "keys": ["UserId", "RoleId"] }
  },
  "navigations": {
    "user_roles": { "from": "user_list", "to": "user_role_list", "on": { "id": "user_id" }, "toMany": "_Roles", "partner": "_User" },
    "invoice_scope": { "from": "invoice_list", "to": "invoice_scope_key", "on": { "id": "invoice_id" }, "toMany": "_ScopeKeys" }
  }
}
```

| Key | Meaning |
| --- | --- |
| `from`, `to` | Table or view names in `schema` (as in `entities`); both must be entities (views need `keys`). |
| `on` | Join: column of `from` → column of `to`; several pairs for a composite join. Property names work too. |
| `toMany` or `toOne` | Exactly one: the name of the navigation on `from`, a collection (`toMany`) or single-valued (`toOne`; always nullable, nothing guarantees the row exists). |
| `partner` | Optional: the navigation back on `to` (single-valued for `toMany`, a collection for `toOne`). |

The navigation appears in `$metadata` (with `NavigationPropertyBinding`; a single-valued one with
`ReferentialConstraint`), and its join is written to the storage mapping (`entitySets.<Set>.navigations.<name>.on`),
which `@rhfan2019/smart-kit-server` reads: `$expand`, paths like `Users('1')/_Roles` (object page child tables),
`$filter` with `_Roles/any(r: r/RoleId eq 'ADMIN')`, and data scopes through the navigation all work. A declaration
that names a missing table, view or column is left out with a warning by `generate`, and `smart-kit check` reports it
(`navigations.<name>: "on": column 'x' does not exist in 'user_list'`); with `--strict` the command fails.

## Naming rules (what the generated names are)

| Database | OData | Override |
| --- | --- | --- |
| table `sales_order` | entity type `SalesOrder`, entity set `SalesOrders` (plural) | `entities.<table>.type`, `.set` |
| column `net_amount` | property `NetAmount` | `entities.<table>.properties.<column>.name` |
| column comment | `Common.Label` of the property | — |
| table comment | `Core.Description` of the entity type (set `UI.HeaderInfo/TypeName` in the annotations for the UI name) | — |
| primary key | `Key` | `entities.<table>.keys` (views) |
| foreign key column `customer_id` → table `customer` | single-valued navigation `_Customer` on the child (column name without `Id` / `ID` / `Code`, else the target type) | `navigations.<constraint>.toOne` |
| foreign key that is part of the child's primary key (items of an order) | also a collection navigation `_<ChildType>` on the parent, e.g. `_SalesOrderItem` | `navigations.<constraint>.toMany` (`false` = none) |
| other foreign keys | no collection navigation | `navigations.<constraint>.toMany: "_Name"` |
| no foreign key (views) | none | declare it: `navigations.<name>` with `from`, `to`, `on` (above) |
| `int2/4/8`, `numeric(p,s)`, `float4/8`, `bool`, `varchar(n)`, `char(n)`, `text`, `date`, `timestamptz`, `time`, `uuid` | `Edm.Int16/32/64`, `Edm.Decimal` (Precision, Scale), `Edm.Single/Double`, `Edm.Boolean`, `Edm.String` (MaxLength), `Edm.Date`, `Edm.DateTimeOffset`, `Edm.TimeOfDay`, `Edm.Guid` | `properties.<column>.type`; other types are left out with a warning |

Generated columns (`GENERATED ALWAYS AS (…) STORED`) and identity columns get `Core.Computed` (not offered on create
or edit). Constraint names: PostgreSQL's default for `order_id` in `sales_order_item` is `sales_order_item_order_id_fkey`
(see `\d sales_order_item` in psql). Tables without a primary key are left out (warning).

## Workflow

1. Change the schema (migration).
2. `npx smart-kit generate --strict` → commit the changed `generated/*` files.
3. If the check reports stale targets, fix the annotation file (renamed property, dropped column).
4. In CI: `npx smart-kit check --strict` (and, with a database, `generate` followed by `git diff --exit-code generated`).

Programmatic use: `generate(loadConfig('smart-kit.config.json'))`, `check(config)`, `introspect`, `toCsdl`,
`toStorage`, `agents(cwd)` — see `docs/reference.md`.
