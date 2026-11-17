# @rhfan2019/smart-kit-cli

Development tool for [smart-kit](https://github.com/rhfan2019/smart-kit). The command `smart-kit`:

- `smart-kit generate` — reads a PostgreSQL schema (tables, keys, foreign keys, comments) and writes the OData CSDL
  and the storage mapping for [`@rhfan2019/smart-kit-server`](https://www.npmjs.com/package/@rhfan2019/smart-kit-server),
  then checks that your hand-written annotation file still matches;
- `smart-kit check --strict` — the same check without a database (for CI);
- `smart-kit agents` — writes an index of the smart-kit docs shipped in `node_modules` into `AGENTS.md` (and
  `@AGENTS.md` into `CLAUDE.md`) so that coding agents such as Codex and Claude Code read them.

```bash
npm install -D @rhfan2019/smart-kit-cli
npx smart-kit generate --config smart-kit.config.json
```

```json
{
  "connection": "postgresql://reader@localhost:5432/shop",
  "schema": "shop",
  "namespace": "Shop",
  "output": { "csdl": "generated/shop.csdl.xml", "storage": "generated/shop.storage.json" },
  "annotations": ["annotations/shop.annotations.xml"]
}
```

Naming rules and all options: `docs/README.md` in the package. Node ≥ 24. MIT License.
