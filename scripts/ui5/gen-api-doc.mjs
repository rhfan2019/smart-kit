#!/usr/bin/env node
// Generates docs/26b-ui5-api-fe-1.154.md: the public API of the sap.fe.macros building blocks (SAPUI5 1.154.0),
// in the format of docs/26a (docs/31 stage 0 item 5).
//
//   node scripts/ui5/gen-api-doc.mjs --lib fe                          print the document
//   node scripts/ui5/gen-api-doc.mjs --lib fe --out docs/26b-ui5-api-fe-1.154.md   write it
//
// The api.json files are SAP's: they are only cached under .cache/ui5/1.154.0 (git-ignored) and never committed.
// The document holds names, types and defaults only, no SAP descriptions. The "effective defaults" tables come from
// reading the sap.fe 1.154.0 sources (resources/sap/fe/**/*.ts, cached under .cache/ui5/1.154.0/src); they are data
// in this file (EFFECTIVE_DEFAULTS) so that regenerating the document keeps them.
import fs from 'node:fs';
import path from 'node:path';
import { ensureApi, loadApi, ROOT, UI5_VERSION } from './api-cache.mjs';
import { describeUi5 } from './ui5-model.mjs';

const args = process.argv.slice(2);
const opt = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
const lib = opt('--lib') ?? 'fe';
const out = opt('--out');
if (lib !== 'fe') { console.error(`unsupported --lib ${lib} (only "fe")`); process.exit(2); }

const FE_LIBS = ['sap.fe.macros', 'sap.fe.core', 'sap.fe.base', 'sap.fe.templates'];
// sap.ui.layout is needed for the ancestor of sap.fe.macros.FormElement; sap.ui.core for the base classes.
await ensureApi([...FE_LIBS, 'sap.ui.layout', 'sap.ui.core'], { log: (m) => console.error(m) });
const symbols = loadApi();

/** The building blocks docs/31 stage 0 item 5 asks for, in this order. */
const MAIN = ['Table', 'TreeTable', 'FilterBar', 'Field', 'Form', 'FormElement', 'Chart', 'MicroChart', 'VariantManagement', 'MessageButton',
  'Share', 'KPITag', 'Paginator', 'MultiValueField', 'Status', 'FlexibleColumnLayoutActions'].map((n) => `sap.fe.macros.${n}`);
/** Sub-namespaces whose members are listed after the main blocks. */
const SUB = ['table', 'chart', 'filterBar', 'field', 'form', 'share', 'microchart', 'controls'];

const isPublic = (x) => (x.visibility ?? 'public') === 'public';
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
/** Shortens type names like 26a: "sap.m.Button" -> "m.Button", "sap.ui.core.Control" -> "core.Control", "sap.fe.macros.table.Column" -> "table.Column". */
function short(type) {
  if (type === undefined || type === null) return '';
  return String(type).replace(/sap\.fe\.macros\./g, '').replace(/\bsap\.ui\.(?=[a-z])/g, '').replace(/\bsap\.(?=[a-z])/g, '');
}
function fmtDefault(v) {
  if (v === undefined || v === null) return '';
  if (typeof v === 'string') return `="${v.replace(/^sap\.[\w.]+\.([A-Z]\w*)\.(\w+)$/, '$2')}"`;
  return `=${JSON.stringify(v)}`;
}
const allowed = (p) => p['ui5-metadata']?.['sap.fe']?.allowedValues ?? [];

/** Accessor names ManagedObject generates for the members of a class (used when the metadata lists none). */
function generatedNames(md) {
  const names = new Set();
  const add = (list) => { for (const n of list ?? []) names.add(n); };
  for (const p of md.properties ?? []) { add(p.methods); for (const pre of ['get', 'set', 'bind', 'unbind']) if (!p.methods) names.add(pre + cap(p.name)); }
  for (const a of [...(md.aggregations ?? []), ...(md.associations ?? [])]) {
    add(a.methods);
    if (!a.methods) for (const n of [a.name, a.singularName ?? a.name]) for (const pre of ['get', 'set', 'add', 'insert', 'remove', 'removeAll', 'indexOf', 'destroy', 'bind', 'unbind']) names.add(pre + cap(n));
  }
  for (const e of md.events ?? []) { add(e.methods); if (!e.methods) for (const pre of ['attach', 'detach', 'fire']) names.add(pre + cap(e.name)); }
  return names;
}

function ownerSymbol(name) { return symbols.get(name); }
function rawMember(owner, kind, name) { return (ownerSymbol(owner)?.['ui5-metadata']?.[kind] ?? []).find((m) => m.name === name); }

function renderClass(name, lines) {
  const d = describeUi5(name, symbols);
  const sym = symbols.get(name);
  const chain = [sym, ...d.ancestors.map((a) => symbols.get(a))];
  lines.push(`### ${name} (${sym.kind}) extends ${sym.extends ?? ''}, module ${sym.module}`);
  // Members each non-base ancestor declares; the ones this class (or a nearer ancestor) declares again are marked.
  const owners = new Map([...d.properties, ...d.aggregations, ...d.associations, ...d.events].map((m) => [m.name, m.owner]));
  const inherited = d.ancestors.map((a) => {
    const md = symbols.get(a)?.['ui5-metadata'] ?? {};
    const names = [...new Set(['properties', 'aggregations', 'associations', 'events'].flatMap((k) => (md[k] ?? []).filter((m) => isPublic(m) && !m.deprecated).map((m) => m.name)))];
    const taken = names.filter((n) => owners.get(n) === a);
    const redeclared = names.filter((n) => owners.get(n) !== a);
    if (!names.length) return undefined;
    return `${a} (${[taken.join(', '), redeclared.length ? `重新声明：${redeclared.join(', ')}` : ''].filter(Boolean).join('；')})`;
  }).filter(Boolean);
  if (inherited.length) lines.push(`  inherited: ${inherited.join('; ')}`);
  if (d.unresolvedAncestor) lines.push(`  (ancestor ${d.unresolvedAncestor} not in the cached api.json files)`);
  const props = d.properties.map((p) => {
    const raw = rawMember(p.owner, 'properties', p.name) ?? {};
    const av = allowed(raw);
    return `${p.name}:${short(raw.type ?? p.type)}${av.length ? `{${av.join('|')}}` : ''}${fmtDefault(raw.defaultValue)}`;
  });
  if (props.length) lines.push(`  props: ${props.join('; ')}`);
  const aggs = d.aggregations.map((a) => {
    const raw = rawMember(a.owner, 'aggregations', a.name) ?? {};
    return `${a.name}:${short(raw.type ?? a.type)}[${raw.cardinality ?? (a.multiple ? '0..n' : '0..1')}]`;
  });
  if (aggs.length) lines.push(`  aggs: ${aggs.join('; ')}`);
  if (d.associations.length) lines.push(`  assocs: ${d.associations.map((a) => `${a.name}:${short(a.type)}`).join('; ')}`);
  if (d.defaultAggregation) lines.push(`  defaultAgg: ${d.defaultAggregation}`);
  for (const e of d.events) {
    const raw = rawMember(e.owner, 'events', e.name) ?? {};
    const params = Object.values(raw.parameters ?? {}).filter((v) => !v.deprecated).map((v) => `${v.name}:${short(v.type)}`);
    lines.push(`  event ${e.name}: ${params.join(', ')}${e.allowPreventDefault ? ' (preventDefault)' : ''}`);
  }
  // Methods: our own filter instead of describeUi5's prefix rule, because the building blocks have explicit
  // get/set/add methods (getSelectedContexts, setPresentationVariant, addColumn) that are not generated accessors.
  const generated = new Set();
  for (const s of chain) for (const n of generatedNames(s['ui5-metadata'] ?? {})) generated.add(n);
  const seen = new Set();
  const methods = [];
  for (const s of chain) {
    for (const m of s.methods ?? []) {
      if (!isPublic(m) || m.deprecated || generated.has(m.name)) continue;
      if (m.static && s !== sym) continue;
      const key = (m.static ? 'S:' : 'm:') + m.name;
      if (seen.has(key)) continue;
      seen.add(key);
      const params = (m.parameters ?? []).map((p) => p.name + (p.optional ? '?' : ''));
      methods.push(`${m.static ? 'static ' : ''}${m.name}(${params.join(', ')})${s !== sym ? ` [${s.basename}]` : ''}`);
    }
  }
  if (methods.length) lines.push(`  methods: ${methods.join(', ')}`);
}

function flattenTypedef(propsList, prefix = '') {
  const outList = [];
  for (const p of propsList ?? []) {
    if (!isPublic(p) || p.deprecated) continue;
    const n = prefix + p.name + (p.optional ? '?' : '');
    if (p.properties?.length) outList.push(...flattenTypedef(p.properties, `${prefix}${p.name}.`));
    else outList.push(`${n}:${short(p.type)}`);
  }
  return outList;
}

function render(name, lines) {
  const sym = symbols.get(name);
  if (sym.kind === 'class') return renderClass(name, lines);
  if (sym.kind === 'enum') {
    lines.push(`### ${name} (enum), module ${sym.module}`);
    lines.push(`  values: ${(sym.properties ?? []).filter(isPublic).map((p) => p.name + (p.deprecated ? ' (dep)' : '')).join(', ')}`);
    return undefined;
  }
  lines.push(`### ${name} (${sym.kind}), module ${sym.module}`);
  if (sym.kind === 'typedef') {
    const props = flattenTypedef(sym.properties);
    lines.push(`  props: ${props.length ? props.join('; ') : '(none listed in api.json)'}`);
  }
  const methods = (sym.methods ?? []).filter((m) => isPublic(m) && !m.deprecated).map((m) => `${m.static ? 'static ' : ''}${m.name}(${(m.parameters ?? []).map((p) => p.name + (p.optional ? '?' : '')).join(', ')})`);
  if (methods.length) lines.push(`  methods: ${methods.join(', ')}`);
  return undefined;
}

// ---- choose the symbols -------------------------------------------------------------------------------------------
const fe = [...symbols.values()].filter((s) => FE_LIBS.includes(s.library) && isPublic(s));
const deprecated = fe.filter((s) => s.deprecated && s.name.startsWith('sap.fe.macros.')).map((s) => s.name).sort();
const usable = fe.filter((s) => !s.deprecated);
const macros = usable.filter((s) => s.name.startsWith('sap.fe.macros.') && s.kind !== 'namespace');
const listed = new Set();
const sections = [];
function section(title, names) {
  const ns = names.filter((n) => symbols.has(n) && !listed.has(n) && !symbols.get(n).deprecated);
  ns.forEach((n) => listed.add(n));
  if (ns.length) sections.push({ title, names: ns });
}
section('主要积木', MAIN);
section('MacroAPI 和辅助类', ['sap.fe.macros.MacroAPI', 'sap.fe.macros.CollectionBindingInfo', 'sap.fe.macros.CollectionBindingInfo.SerializedCollectionBindingInfo']);
for (const sub of SUB) section(`sap.fe.macros.${sub}.*`, macros.filter((s) => s.name.startsWith(`sap.fe.macros.${sub}.`)).map((s) => s.name).sort());
section('sap.fe.macros 的其他积木（不在阶段 0 的清单里，列出备查）', macros.map((s) => s.name).sort());
section('sap.fe.core 的枚举和 manifest typedef（library 模块、converters/ManifestSettings）',
  usable.filter((s) => s.library === 'sap.fe.core' && (s.kind === 'enum' || s.name.startsWith('sap.fe.core.converters.ManifestSettings.'))).map((s) => s.name).sort());

// ---- effective defaults read from the sap.fe sources ----------------------------------------------------------------
// [property, effective default, source module]; "未核实" where the source did not settle it.
const T = 'core/converters/controls/Common/Table';
const EFFECTIVE_DEFAULTS = {
  'sap.fe.macros.Table': [
    ['type', '未设：实体支持分析（ApplySupported 含 filter、identity、orderby、skip、top、groupby、aggregate、concat）→ `AnalyticalTable`；有成对的 RecursiveHierarchy / Aggregation 限定符 → `TreeTable`；否则 `ResponsiveTable`。非法值回退 `ResponsiveTable`', `${T} (getTableType)`],
    ['selectionMode', '未设或 `Auto`：有删除、批量编辑、剪切或需要选择的操作时 `Multi`，否则 `None`（对象页只在编辑态）；`ForceMulti`→`Multi`，`ForceSingle`→`Single`；`None` 遇到删除按钮仍为 `Multi`；最终空值按 `None`', `${T} (getSelectionMode)；macros/table/MdcTableTemplate`],
    ['enableExport', '未设：`true`；对象页上等于 `enablePaste`（对象页 `enablePaste` 默认 `true`）', `${T} (_getEnableExport)`],
    ['enablePaste', '未设：对象页 `true`；列表页只有草稿树表 `true`；其他 `false`', `${T} (getTableManifestConfiguration)`],
    ['header', '未设：目标实体类型的 `UI.HeaderInfo/TypeNamePlural`', `${T} (getTableAnnotationConfiguration)；macros/table/MdcTableTemplate`],
    ['headerVisible', '`true`；quickVariantSelection 有 `hideTableTitle` 且有快速筛选时 `false`', `${T} (getFilterConfiguration)；macros/table/MdcTableTemplate`],
    ['initialLoad', '文档默认 `false`；源码里没找到读取点。MDC 表格 `autoBindOnInit` = 用基本搜索或没有关联筛选栏，即有 `filterBar` 时等筛选栏的搜索（未核实）', 'macros/Table；macros/table/MdcTableTemplate'],
    ['personalization', '未设：`Sort, Column`；列表页只有 Control 级变式管理或隐藏筛选栏时加 `Filter`，其他页面都加 `Filter`；ResponsiveTable 加 `Group`；AnalyticalTable 加 `Group, Aggregate`', `${T} (getP13nMode)`],
    ['variantManagement', '未设：页面的变式管理（列表页模板默认 `Page`，对象页 `None`，自由页面 `None`）；`Control` 但没有个性化 → `None`', `${T}；templates/ListComponent；templates/ObjectPage/Component`],
    ['threshold', '未设：PresentationVariant `MaxItems`；否则 TreeTable 200，GridTable / AnalyticalTable 100，其他 30（导航属性表格 10）', `${T} (getThreshold)；macros/Table`],
    ['scrollThreshold', '非 ResponsiveTable 300；ResponsiveTable 不设', `${T}`],
    ['popinLayout', 'ResponsiveTable：manifest `sap.fe › macros › table › defaultPopinLayout`，再没有则 `Block`', `${T}`],
    ['rowCountMode / rowCount', '只对非 ResponsiveTable：列表页 `Auto` / 3；其他页面 `Fixed`，行数 GridTable 5、TreeTable / AnalyticalTable 10（rowCountMode=Auto 时 3）', `${T} (_getTableMode)`],
    ['selectionLimit', '200；`enableSelectAll=true` 或 `selectionLimit=0` 时 0（不限）', `${T} (_getTableSelectionLimit)`],
    ['enableSelectAll', 'ResponsiveTable 的 multiSelectMode：未设 → `Default`（`false` → `ClearAll`）；对象页用 IconTabBar 时未设 → `ClearAll`', `${T} (_getMultiSelectMode)`],
    ['enableFullScreen', '未设：只在手机上 `true`；列表页非手机强制 `false`', `${T} (_getFullScreenBasedOnDevice)`],
    ['creationMode.name', '未设：`NewPage`（`sap.fe › macros › table › defaultCreationMode` 为 `InlineCreationRows` 时用它）；对象页没有子页面路由时改为 `Inline`；`createAtEnd` 默认 Inline / CreationDialog 为 `false`，其他 `true`', `${T} (getTableManifestConfiguration, _getCreationBehaviour)；macros/table/TableDefinition`],
    ['isSearchable', '未设：平表看 `Capabilities.SearchRestrictions/Searchable`；分析表、树表看 ApplySupported 是否含 `search`', `${T} (getTableAnnotationConfiguration)`],
    ['readOnly', '未设：显示模式或 manifest `readOnly=true` 时 `true`；AnalyticalTable 在 `aggregationOnLeafLevel` 时 `true`', `${T}；macros/Table`],
    ['modeForNoDataMessage', '列表页 `illustratedMessage-Auto`；对象页 `illustratedMessage-ExtraSmall`（`useTextForNoDataMessages` 时 `text`）；积木回退 `illustratedMessage-Auto`', `${T}；macros/Table (getNoDataMessageMode)`],
    ['condensedTableLayout', '`false`；只对非 ResponsiveTable 且内容密度允许时生效', `${T} (_getCondensedTableLayout)`],
    ['enableAutoColumnWidth', '非手机 `true`', `${T}`],
    ['disableColumnFreeze / frozenColumnCount', '列冻结默认可用；冻结列数不设', `${T}`],
    ['busy、exportRequestSize、exportFileName、exportSheetName', '未设时原样不传（未核实下游默认）', `${T}`],
  ],
  'sap.fe.macros.TreeTable': [
    ['type', '`TreeTable`（唯一取值）', 'macros/TreeTable'],
    ['hierarchyQualifier', '必填（RecursiveHierarchy 限定符）', 'macros/TreeTable'],
    ['selectionMode', '未设：`Multi`', `${T} (getSelectionMode)`],
    ['threshold', '200（有 `MaxItems` 时用它）', `${T} (getThreshold)`],
    ['rowCountMode / rowCount', '列表页 `Auto` / 3；其他 `Fixed` / 10', `${T} (_getTableMode)`],
    ['enablePaste', '草稿根实体的列表页 `true`；对象页 `true`；粘贴按钮在树表上不显示', `${T}；macros/table/MdcTableTemplate`],
    ['isSearchable', '看 ApplySupported 是否含 `search`', `${T}`],
    ['其他', '同 `Table`', ''],
  ],
  'sap.fe.macros.FilterBar': [
    ['liveMode', '`false`', 'macros/FilterBar'],
    ['showClearButton', '`false`', 'macros/FilterBar；core/converters/templates/ListReportConverter'],
    ['showMessages', '积木 `true`；列表页模板里固定写 `false`', 'macros/FilterBar；templates/ListReport/ListReport.view.xml'],
    ['navigationPropertiesForPersonalization', '`[]`', 'macros/FilterBar'],
    ['useSemanticDateRange（非公开）', '`true`', 'macros/FilterBar；core/converters/templates/ListReportConverter'],
    ['initialLayout（非公开）', '`compact`', 'macros/FilterBar'],
    ['p13nMode（非公开）', '`Item, Value`', 'macros/FilterBar'],
  ],
  'sap.fe.macros.Field': [
    ['readOnly', '未设：由编辑状态和注解（`Core.Computed`、`Core.Immutable`、`Common.FieldControl`）推导（未核实细节）', 'macros/Field'],
    ['formatOptions', '未设：显示方式按 `Common.Text` + `UI.TextArrangement`（未核实细节）', 'macros/field/FieldFormatOptions'],
    ['value / description', '未设：由 `metaPath` 指向的属性和它的 `Common.Text` 绑定', 'macros/Field'],
  ],
  'sap.fe.macros.Form': [
    ['layout', '未设：`ColumnLayout`，`columnsM=3`、`columnsL=4`、`columnsXL=6`、`labelCellsLarge=12`；manifest 的 `controlConfiguration › <facet> › layout` 或 `sections › <facet> › layout` 优先', 'macros/Form (getLayoutInformation)'],
    ['visible', '`true`', 'macros/Form'],
    ['title', '未设：取 facet 的 `Label`（未核实）', 'macros/Form'],
    ['navigationPropertiesForAdaptationDialog', '未设（未核实）', 'macros/Form'],
  ],
  'sap.fe.macros.Chart': [
    ['selectionMode', '`Multiple`', 'macros/Chart'],
    ['headerVisible', '`true`', 'macros/Chart'],
    ['personalization', '积木 `true`；模板里未设时 `Sort,Type,Item`，Control 级变式管理时加 `Filter`', 'macros/Chart；core/converters/controls/Common/Chart (getP13nMode)'],
    ['variantManagement', '模板里取页面的变式管理（没有个性化时 `None`）；积木单独使用时未核实', 'core/converters/controls/Common/Chart'],
    ['header', '未设：模板里取 manifest `chartSettings.header`，否则未核实（应为 `UI.Chart/Title`）', 'core/converters/controls/Common/Chart'],
  ],
  'sap.fe.macros.VariantManagement': [
    ['showSetAsDefault', '`true`', 'macros/VariantManagement'],
    ['headerLevel', '未设：原样传给 sap.ui.fl 的 VariantManagement（其默认值未核实）', 'macros/VariantManagement'],
  ],
};

// ---- output --------------------------------------------------------------------------------------------------------
const today = new Date().toLocaleDateString('sv-SE'); // local date as YYYY-MM-DD
const lines = [];
lines.push(`# 26b SAPUI5 ${UI5_VERSION} 的 sap.fe.macros 积木 API（核实用）`, '');
lines.push(`> ${today} 从 SAPUI5 ${UI5_VERSION} 的官方 API 描述文件生成（\`https://ui5.sap.com/${UI5_VERSION}/test-resources/<库>/designtime/api.json\`，库：${FE_LIBS.join('、')}，祖先类用到 sap.ui.layout）。`
  + `生成命令：\`node scripts/ui5/gen-api-doc.mjs --lib fe --out docs/26b-ui5-api-fe-1.154.md\`（文件缓存在 \`.cache/ui5/${UI5_VERSION}/\`，不提交）。格式同 \`26a\`。`);
lines.push('>');
lines.push('> - 只列公开、未废弃的成员：属性（名字:类型{允许值}=默认值，没有默认值就不写 `=`）、聚合（类型[基数]）、关联、默认聚合、事件（参数:类型）、方法（不含 ManagedObject 生成的 get/set/add/attach… 访问方法；`static` 标静态，`[祖先]` 标从哪个祖先来）。'
  + '类型名去掉 `sap.` 前缀，`sap.fe.macros.` 整个去掉（`table.Column` 即 `sap.fe.macros.table.Column`）。');
lines.push('> - `inherited:` 一行列出从非基础祖先（例如 `sap.fe.macros.MacroAPI`、`sap.fe.macros.controls.BaseAction`、`sap.ui.layout.form.FormElement`）继承的成员；`BuildingBlock`、`BuildingBlockBase`、`BuildingBlockObjectProperty`、`Control`、`Element` 等基础类的成员不列（`scripts/ui5/ui5-model.mjs` 的 `BASE_CLASSES`）。');
lines.push('> - 每节标题后面是 api.json 的 `module`（导入路径）。注意 `FlexibleColumnLayoutActions` 的模块是 `sap/fe/macros/fcl/FlexibleColumnLayoutActions.block`，不是 `sap/fe/macros/FlexibleColumnLayoutActions`。');
lines.push('> - api.json 里很多属性的默认值是空的，实际默认值由 sap.fe 的转换器决定，见文末"实际默认值（源码）"。');
lines.push(`> - 已废弃、不列的类：${deprecated.map((n) => `\`${n}\``).join('、')}。`);
lines.push('');
let count = 0;
for (const s of sections) {
  lines.push(`## ${s.title}`, '', '```text');
  for (const n of s.names) { render(n, lines); count++; }
  lines.push('```', '');
}
lines.push('## 实际默认值（源码）', '');
lines.push(`api.json 没写默认值、但影响行为的属性，按 sap.fe ${UI5_VERSION} 的 TypeScript 源码（\`https://ui5.sap.com/${UI5_VERSION}/resources/sap/fe/<模块>.ts\`，缓存在 \`.cache/ui5/${UI5_VERSION}/src/\`）核对。`
  + '积木单独使用时，`createTableDefinition`（`macros/table/TableDefinition`）把积木属性当作 manifest 的 `tableSettings` 交给同一个转换器，所以积木和模板的默认值来自同一处；模板类型（列表页 / 对象页 / 自由页面）会改变其中一些默认值。来源模块省略 `sap/fe/` 前缀。', '');
for (const [cls, rows] of Object.entries(EFFECTIVE_DEFAULTS)) {
  lines.push(`### ${cls}`, '', '| 属性 | 实际默认值 | 来源模块 |', '| --- | --- | --- |');
  for (const [p, v, src] of rows) lines.push(`| \`${p}\` | ${v} | ${src} |`);
  lines.push('');
}
const text = lines.join('\n');
if (out) {
  fs.writeFileSync(path.resolve(ROOT, out), text);
  console.error(`wrote ${out}: ${count} symbols, ${deprecated.length} deprecated skipped`);
} else {
  process.stdout.write(text);
}
