// Compares one smart-kit export with its SAPUI5 counterpart (docs/30 §7.1 step 4). Pure: no file or network access,
// so the self-test (tests/unit/check-ui5-api.test.ts, AL-20) can feed it hand-made descriptions.

/** Props every control may have without a deviation: sap.ui.core.Control / Element basics (ADR-032 rule 4). */
export const CONTROL_BASICS = new Set(['visible', 'busy', 'busyIndicatorDelay', 'fieldGroupIds', 'id']);

/** UI5 module path → smart-kit module path: only the prefix changes; sap.fe.* gets `v4` (ADR-033 §2, D35). */
export function kitModuleOf(ui5Module) {
  if (!ui5Module) return undefined;
  if (ui5Module.startsWith('sap/fe/')) return 'v4/' + ui5Module.slice('sap/'.length);
  if (ui5Module.startsWith('sap/')) return ui5Module.slice('sap/'.length);
  return undefined;
}

/** The library module of an enum: sap.ui.core.ValueState lives in sap/ui/core/library (api.json `module`). */
export function enumModuleOf(ui5) {
  return kitModuleOf(ui5.module);
}

/** Compares a TSDoc default with an api.json default; arrays may be written as JSON (`[]`, `["A","B"]`) or comma-separated. */
function sameDefault(kit, ui5) {
  const norm = (v) => (Array.isArray(v) ? v.join(',') : typeof v === 'string' && /^\[.*\]$/.test(v.trim()) ? (() => { try { return JSON.parse(v).join(','); } catch { return v; } })() : String(v));
  return norm(kit) === norm(ui5);
}

const ALLOWED_EVENT_FIELDS = new Set(['preventDefault']);

/**
 * @param {object} entry mapping entry { module, export, ui5 }
 * @param {object|undefined} ui5 describeUi5() result
 * @param {object|undefined} kit describeExport() result
 * @param {object} where { atTarget: boolean, typeExports: Set<string>, exportName: string }
 * @returns {{ kind: string, member: string, detail?: string }[]}
 */
export function compareExport(entry, ui5, kit, where) {
  const f = [];
  const add = (kind, member = '', detail) => f.push({ kind, member, detail });
  if (entry.ui5 === 'delete') {
    // to be removed in its stage (docs/30 §4); the entry goes away together with the export
    if (kit) add('to-delete', entry.export, `replace with ${entry.replacement}`);
    else add('stale-mapping', entry.export, 'deleted export: remove the mapping entry');
    return f;
  }
  if (!kit) { add('missing-export', entry.export, 'export not found'); return f; }
  if (entry.ui5?.startsWith('manifest:')) {
    // templates and card contents: settings come from the manifest (docs/26c), checked by e2e:fe and the manifest check
    if (!where.atTarget) add('module-path', '', `not yet at ${entry.module}`);
    if (!entry.settingsVerified) add('manifest-settings', '', `${entry.ui5.slice('manifest:'.length)}: settings not yet compared with the manifest`);
    return f;
  }
  if (entry.ui5 === 'none') {
    if (!/^(kit\/|context$|theme$|i18n$|util$)/.test(entry.module)) add('module-path', '', `no UI5 counterpart: must be in kit/… or a base subpath, is ${entry.module}`);
    if (!where.atTarget) add('module-path', '', `not yet at ${entry.module}`);
    return f;
  }
  if (!ui5) { add('ui5-unknown', entry.ui5, 'not in api.json'); return f; }
  if (ui5.deprecated) add('ui5-deprecated', entry.ui5, 'mapped UI5 symbol is deprecated in 1.154');

  const expectedModule = kitModuleOf(ui5.module);
  if (expectedModule && expectedModule !== entry.module) add('mapping-path', '', `UI5 module ${ui5.module} → ${expectedModule}, mapping says ${entry.module}`);
  if (!where.atTarget) add('module-path', '', `not yet at ${entry.module}`);

  if (ui5.kind === 'enum') {
    // enums of a library module are named exports; an enum with its own module (sap/m/AvatarShape) is its default export
    const ownModule = ui5.module && !ui5.module.endsWith('/library');
    const expectedExport = ownModule ? 'default' : ui5.basename;
    if (entry.export !== expectedExport) add('export-name', '', `enum must be exported as ${expectedExport}`);
    if (kit.kind !== 'enum') { add('kind', '', `UI5 enum, smart-kit ${kit.kind}`); return f; }
    if (where.atTarget && !where.typeExports.has(ownModule ? 'default' : expectedExport)) add('enum-type', '', `type ${expectedExport} not exported`);
    for (const v of ui5.enumValues) if (!kit.enumValues.includes(v)) add('enum-value', v);
    for (const v of kit.enumValues) if (!ui5.enumValues.includes(v)) add('extra-enum-value', v);
    return f;
  }

  // classes and namespaces
  // a namespace of constants in a library module (sap.f.DynamicPageTitleShrinkRatio) is a named export like an enum
  if (where.atTarget && entry.export !== 'default' && !(ui5.kind === 'namespace' && ui5.module?.endsWith('/library'))) add('export-name', '', 'a class module must export it as default');
  if (where.exportName && where.exportName !== ui5.basename) add('class-name', '', `export named ${where.exportName}, UI5 class ${ui5.basename}`);

  // a UI5 class with settings must be a component; static-only APIs (MessageBox, MessageToast) may be plain objects
  if (ui5.kind === 'class' && kit.kind !== 'component' && (ui5.properties.length || ui5.events.length)) add('kind', '', `UI5 class with settings, smart-kit ${kit.kind}`);

  if (kit.domAttributes) add('dom-attributes', '', 'props extend the DOM attributes of the root element');
  const kitProps = new Map(kit.props.map((p) => [p.name, p]));
  const ui5Names = new Set();
  for (const p of ui5.properties) {
    ui5Names.add(p.name);
    const k = kitProps.get(p.name);
    if (!k) { add('property', p.name); continue; }
    const d = p.defaultValue;
    if (d !== undefined && d !== '' && d !== null) {
      if (!k.hasDefaultTag) add('default-value', p.name, `UI5 default ${JSON.stringify(d)}, no @defaultValue`);
      else if (!sameDefault(k.defaultValue, d)) add('default-value', p.name, `UI5 default ${JSON.stringify(d)}, smart-kit ${JSON.stringify(k.defaultValue)}`);
    }
  }
  const hasChildren = kitProps.has('children');
  for (const a of ui5.aggregations) {
    ui5Names.add(a.name);
    if (kitProps.has(a.name)) continue;
    if (a.name === ui5.defaultAggregation && hasChildren) continue;
    add('aggregation', a.name);
  }
  for (const a of ui5.associations) {
    ui5Names.add(a.name);
    if (!kitProps.has(a.name)) add('association', a.name);
  }
  for (const p of kit.props) {
    if (ui5Names.has(p.name) || CONTROL_BASICS.has(p.name)) continue;
    if (p.name === 'children' && ui5.aggregations.length) continue;
    add('extra-property', p.name);
  }

  const kitEvents = new Map(kit.events.map((e) => [e.name, e]));
  const ui5Events = new Set();
  for (const e of ui5.events) {
    ui5Events.add(e.name);
    const k = kitEvents.get(e.name);
    if (!k) { add('event', e.name); continue; }
    const fields = k.params ?? [];
    for (const p of e.params) if (!fields.includes(p)) add('event-param', `${e.name}.${p}`);
    for (const p of fields) if (!e.params.includes(p) && !ALLOWED_EVENT_FIELDS.has(p)) add('extra-event-param', `${e.name}.${p}`);
    if (e.allowPreventDefault && !fields.includes('preventDefault')) add('event-preventDefault', e.name);
    if (where.atTarget && e.params.length) {
      const typeName = `${ui5.basename}$${e.name[0].toUpperCase()}${e.name.slice(1)}Event`;
      if (!where.typeExports.has(typeName)) add('event-type', e.name, `type ${typeName} not exported`);
    }
  }
  for (const e of kit.events) if (!ui5Events.has(e.name)) add('extra-event', e.name);

  const instance = new Set(kit.instance);
  const statics = new Set(kit.statics);
  const ui5Methods = new Set();
  for (const m of ui5.methods) {
    ui5Methods.add(m.name);
    if (m.static) { if (!statics.has(m.name)) add('static-method', m.name); }
    else if (!instance.has(m.name)) add('method', m.name);
  }
  for (const s of ui5.staticMembers) {
    ui5Methods.add(s);
    if (!statics.has(s)) add('static-member', s);
  }
  for (const m of kit.instance) if (!ui5Methods.has(m)) add('extra-method', m);
  for (const s of kit.statics) if (!ui5Methods.has(s)) add('extra-static', s);

  if (where.atTarget && kit.kind === 'component') {
    if (ui5.properties.length && !where.typeExports.has(`$${ui5.basename}Settings`)) add('settings-type', '', `type $${ui5.basename}Settings not exported`);
    // the instance type is an interface merged with the component (default import gives both, as in UI5's TypeScript)
    if (kit.hasRef && !kit.mergedInterface) add('instance-type', '', `interface ${ui5.basename} (instance type) not merged with the component`);
  }
  return f;
}

/** Key a finding is matched against the deviation register with. */
export const findingKey = (module, kind, member) => `${module}|${kind}|${member}`;

/** Splits findings into registered and unregistered, and lists deviations no finding matches any more (stale). */
export function matchDeviations(findings, deviations) {
  const byKey = new Map();
  for (const d of deviations) byKey.set(findingKey(d.module, d.kind, d.member ?? ''), d);
  const used = new Set();
  const registered = [];
  const unregistered = [];
  for (const x of findings) {
    const d = byKey.get(findingKey(x.module, x.kind, x.member)) ?? byKey.get(findingKey('*', x.kind, x.member));
    if (d) { used.add(d); registered.push({ ...x, deviation: d.id }); } else unregistered.push(x);
  }
  // fe:<scenario> entries belong to the Fiori elements comparison (npm run e2e:fe), not to this check
  // manifest-* entries belong to the manifest settings check (scripts/check-manifest-settings.mjs, AL-13)
  const stale = deviations.filter((d) => d.module !== '*' && !String(d.module).startsWith('fe:') && !String(d.kind).startsWith('manifest-') && !used.has(d));
  return { registered, unregistered, stale };
}
