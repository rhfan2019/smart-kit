// CSDL helpers: label placeholders in the purchasing template, and CSDL XML -> CSDL JSON (OData CSDL JSON 4.01).
import { xml2js } from 'xml-js';

const PLACEHOLDER = /\{\{label:([A-Za-z0-9_.]+)\}\}/g;
const escapeXml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

/** Replaces {{label:Key}} placeholders; throws when a key is missing. */
export function applyLabels(template, labels, lang) {
  const missing = new Set();
  const out = template.replace(PLACEHOLDER, (m, key) => {
    if (key in labels) return escapeXml(labels[key]);
    missing.add(key);
    return m;
  });
  if (missing.size) throw new Error(`labels.${lang}.json is missing keys: ${[...missing].sort().join(', ')}`);
  return out;
}

export const labelKeys = (template) => [...new Set([...template.matchAll(PLACEHOLDER)].map((m) => m[1]))];

export const stripComments = (xml) => xml.replace(/\s*<!--[\s\S]*?-->/g, '');

const local = (name) => name.slice(name.indexOf(':') + 1);
const kids = (el, name) => (el.elements ?? []).filter((e) => e.type === 'element' && (!name || local(e.name) === name));
const text = (el) => (el.elements ?? []).filter((e) => e.type === 'text' || e.type === 'cdata').map((e) => e.text ?? e.cdata).join('');

/** Converts CSDL XML to CSDL JSON. */
export function csdlXmlToJson(xml) {
  const doc = xml2js(xml, { compact: false, trim: false });
  const edmx = kids(doc, 'Edmx')[0];
  const out = { $Version: edmx.attributes.Version };
  const aliases = {};
  const refs = {};
  for (const ref of kids(edmx, 'Reference')) {
    const includes = kids(ref, 'Include').map((inc) => {
      if (inc.attributes.Alias) aliases[inc.attributes.Alias] = inc.attributes.Namespace;
      return { $Namespace: inc.attributes.Namespace, ...(inc.attributes.Alias ? { $Alias: inc.attributes.Alias } : {}) };
    });
    refs[ref.attributes.Uri] = { $Include: includes };
  }
  const schemas = kids(kids(edmx, 'DataServices')[0], 'Schema');
  for (const s of schemas) if (s.attributes.Alias) aliases[s.attributes.Alias] = s.attributes.Namespace;
  const qualify = (name) => {
    const dot = name.lastIndexOf('.');
    return dot > 0 && aliases[name.slice(0, dot)] ? aliases[name.slice(0, dot)] + name.slice(dot) : name;
  };

  for (const s of schemas) {
    const ns = s.attributes.Namespace;
    const container = kids(s, 'EntityContainer')[0];
    if (container) out.$EntityContainer = `${ns}.${container.attributes.Name}`;
  }
  if (Object.keys(refs).length) out.$Reference = refs;

  for (const s of schemas) {
    const ns = s.attributes.Namespace;
    const schema = {};
    if (s.attributes.Alias) schema.$Alias = s.attributes.Alias;
    for (const el of kids(s)) {
      const kind = local(el.name);
      if (kind === 'EntityType' || kind === 'ComplexType') schema[el.attributes.Name] = structuredType(el, kind);
      else if (kind === 'EnumType') {
        const t = { $Kind: 'EnumType' };
        let next = 0;
        for (const m of kids(el, 'Member')) {
          const v = m.attributes.Value === undefined ? next : Number(m.attributes.Value);
          t[m.attributes.Name] = v;
          next = v + 1;
        }
        schema[el.attributes.Name] = t;
      } else if (kind === 'EntityContainer') schema[el.attributes.Name] = entityContainer(el);
    }
    const annotations = {};
    for (const block of kids(s, 'Annotations')) {
      const target = block.attributes.Target;
      const obj = annotations[target] ?? {};
      for (const ann of kids(block, 'Annotation')) addAnnotation(obj, ann, '');
      annotations[target] = obj;
    }
    if (Object.keys(annotations).length) schema.$Annotations = annotations;
    out[ns] = schema;
  }
  return out;

  function facets(target, a) {
    if (a.Nullable === 'false') {
      /* default */
    } else if (target.$Kind !== 'NavigationProperty' || target.$Collection !== true) target.$Nullable = true;
    if (a.MaxLength !== undefined) target.$MaxLength = a.MaxLength === 'max' ? 'max' : Number(a.MaxLength);
    if (a.Precision !== undefined) target.$Precision = Number(a.Precision);
    if (a.Scale !== undefined) target.$Scale = a.Scale === 'variable' || a.Scale === 'floating' ? a.Scale : Number(a.Scale);
    if (a.Unicode === 'false') target.$Unicode = false;
    if (a.SRID !== undefined) target.$SRID = a.SRID;
    if (a.DefaultValue !== undefined) target.$DefaultValue = a.DefaultValue;
  }

  function typeRef(target, type) {
    const m = /^Collection\((.*)\)$/.exec(type);
    if (m) target.$Collection = true;
    const t = qualify(m ? m[1] : type);
    if (t !== 'Edm.String') target.$Type = t;
  }

  function structuredType(el, kind) {
    const a = el.attributes;
    const t = { $Kind: kind };
    if (a.BaseType) t.$BaseType = qualify(a.BaseType);
    if (a.Abstract === 'true') t.$Abstract = true;
    if (a.OpenType === 'true') t.$OpenType = true;
    if (a.HasStream === 'true') t.$HasStream = true;
    const key = kids(el, 'Key')[0];
    if (key) t.$Key = kids(key, 'PropertyRef').map((r) => (r.attributes.Alias ? { [r.attributes.Alias]: r.attributes.Name } : r.attributes.Name));
    for (const p of kids(el)) {
      const pk = local(p.name);
      if (pk === 'Property') {
        const prop = {};
        typeRef(prop, p.attributes.Type);
        facets(prop, p.attributes);
        for (const ann of kids(p, 'Annotation')) addAnnotation(prop, ann, '');
        t[p.attributes.Name] = prop;
      } else if (pk === 'NavigationProperty') {
        const nav = { $Kind: 'NavigationProperty' };
        typeRef(nav, p.attributes.Type);
        if (p.attributes.Partner) nav.$Partner = p.attributes.Partner;
        if (p.attributes.ContainsTarget === 'true') nav.$ContainsTarget = true;
        if (!nav.$Collection && p.attributes.Nullable !== 'false') nav.$Nullable = true;
        const rc = kids(p, 'ReferentialConstraint');
        if (rc.length) nav.$ReferentialConstraint = Object.fromEntries(rc.map((r) => [r.attributes.Property, r.attributes.ReferencedProperty]));
        const od = kids(p, 'OnDelete')[0];
        if (od) nav.$OnDelete = od.attributes.Action;
        for (const ann of kids(p, 'Annotation')) addAnnotation(nav, ann, '');
        t[p.attributes.Name] = nav;
      } else if (pk === 'Annotation') addAnnotation(t, p, '');
    }
    return t;
  }

  function entityContainer(el) {
    const c = { $Kind: 'EntityContainer' };
    for (const m of kids(el)) {
      const mk = local(m.name);
      if (mk === 'EntitySet' || mk === 'Singleton') {
        const set = mk === 'EntitySet' ? { $Collection: true, $Type: qualify(m.attributes.EntityType) } : { $Type: qualify(m.attributes.Type) };
        const bindings = kids(m, 'NavigationPropertyBinding');
        if (bindings.length) set.$NavigationPropertyBinding = Object.fromEntries(bindings.map((b) => [b.attributes.Path, b.attributes.Target]));
        if (m.attributes.IncludeInServiceDocument === 'false') set.$IncludeInServiceDocument = false;
        for (const ann of kids(m, 'Annotation')) addAnnotation(set, ann, '');
        c[m.attributes.Name] = set;
      } else if (mk === 'Annotation') addAnnotation(c, m, '');
    }
    return c;
  }

  function addAnnotation(target, ann, prefix) {
    const key = `${prefix}@${qualifyTerm(ann.attributes.Term)}${ann.attributes.Qualifier ? `#${ann.attributes.Qualifier}` : ''}`;
    target[key] = expr(ann, true);
    for (const nested of kids(ann, 'Annotation')) addAnnotation(target, nested, key);
  }

  // Terms keep their alias as authored (CSDL JSON allows aliases; the samples use them).
  function qualifyTerm(term) {
    return term;
  }

  function expr(holder, isAnnotation) {
    for (const [name, v] of Object.entries(holder.attributes ?? {})) {
      switch (name) {
        case 'String': return v;
        case 'Bool': return v === 'true';
        case 'Int': return Number(v);
        case 'Decimal': return Number(v);
        case 'Float': return Number(v);
        case 'Date': case 'DateTimeOffset': case 'TimeOfDay': case 'Duration': case 'Guid': return v;
        case 'EnumMember': return enumValue(v);
        case 'Path': case 'PropertyPath': case 'NavigationPropertyPath': case 'AnnotationPath': case 'ModelElementPath':
          return { [`$${name}`]: v };
        default:
      }
    }
    const child = kids(holder).find((e) => local(e.name) !== 'Annotation');
    if (child) return element(child);
    return isAnnotation ? true : null;
  }

  function element(e) {
    switch (local(e.name)) {
      case 'String': return text(e);
      case 'Bool': return text(e) === 'true';
      case 'Int': case 'Decimal': case 'Float': return Number(text(e));
      case 'Date': case 'DateTimeOffset': case 'TimeOfDay': case 'Duration': case 'Guid': return text(e);
      case 'EnumMember': return enumValue(text(e));
      case 'Path': case 'PropertyPath': case 'NavigationPropertyPath': case 'AnnotationPath': case 'ModelElementPath':
        return { [`$${local(e.name)}`]: text(e) };
      case 'Null': return null;
      case 'Collection': return kids(e).map(element);
      case 'Record': {
        const obj = {};
        if (e.attributes?.Type) obj['@type'] = qualify(e.attributes.Type);
        for (const c of kids(e)) {
          if (local(c.name) === 'PropertyValue') {
            const name = c.attributes.Property;
            obj[name] = expr(c, false);
            for (const nested of kids(c, 'Annotation')) addAnnotation(obj, nested, name);
          } else if (local(c.name) === 'Annotation') addAnnotation(obj, c, '');
        }
        return obj;
      }
      default:
        throw new Error(`CSDL JSON conversion: expression <${local(e.name)}> is not supported`);
    }
  }
}

// "UI.TextArrangementType/TextFirst" -> "TextFirst"; flags "A/x A/y" -> "x,y"
const enumValue = (v) => v.trim().split(/\s+/).map((m) => m.slice(m.lastIndexOf('/') + 1)).join(',');
