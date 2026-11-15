/**
 * Converts an OASIS CSDL JSON document (4.0 / 4.01) into CSDL XML text, so that JSON
 * input can go through the same @sap-ux/edmx-parser pipeline as XML input.
 * See docs/04-model-spec.md §2.
 */

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };
type Obj = { [k: string]: Json };

const EDMX = 'http://docs.oasis-open.org/odata/ns/edmx';
const EDM = 'http://docs.oasis-open.org/odata/ns/edm';

const isObj = (v: Json | undefined): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function attrs(a: Record<string, string | number | boolean | undefined>): string {
  return Object.entries(a)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => ` ${k}="${esc(String(v))}"`)
    .join('');
}

/** Splits "@UI.LineItem#Q" into term and qualifier. */
function splitTerm(key: string): { term: string; qualifier?: string } {
  const t = key.startsWith('@') ? key.slice(1) : key;
  const hash = t.indexOf('#');
  return hash < 0 ? { term: t } : { term: t.slice(0, hash), qualifier: t.slice(hash + 1) };
}

const PATH_EXPRESSIONS: Record<string, string> = {
  $Path: 'Path',
  $PropertyPath: 'PropertyPath',
  $NavigationPropertyPath: 'NavigationPropertyPath',
  $AnnotationPath: 'AnnotationPath',
  $ModelElementPath: 'ModelElementPath',
  $LabeledElementReference: 'LabeledElementReference',
  $EnumMember: 'EnumMember',
};

const LOGICAL = ['$And', '$Or', '$Eq', '$Ne', '$Gt', '$Ge', '$Lt', '$Le', '$Has', '$In', '$Add', '$Sub', '$Mul', '$Div', '$DivBy', '$Mod'];

function expr(v: Json): string {
  if (v === null) return '<Null/>';
  if (typeof v === 'boolean') return `<Bool>${v}</Bool>`;
  if (typeof v === 'number') return Number.isInteger(v) ? `<Int>${v}</Int>` : `<Decimal>${v}</Decimal>`;
  if (typeof v === 'string') return `<String>${esc(v)}</String>`;
  if (Array.isArray(v)) return `<Collection>${v.map(expr).join('')}</Collection>`;
  for (const [k, el] of Object.entries(PATH_EXPRESSIONS)) {
    if (k in v) return `<${el}>${esc(String(v[k]))}</${el}>`;
  }
  if ('$Null' in v) return '<Null/>';
  if ('$Not' in v) return `<Not>${expr(v.$Not as Json)}</Not>`;
  for (const k of LOGICAL) {
    if (k in v) return `<${k.slice(1)}>${(v[k] as Json[]).map(expr).join('')}</${k.slice(1)}>`;
  }
  if ('$If' in v) return `<If>${(v.$If as Json[]).map(expr).join('')}</If>`;
  if ('$Apply' in v) {
    return `<Apply${attrs({ Function: v.$Function as string })}>${(v.$Apply as Json[]).map(expr).join('')}</Apply>`;
  }
  if ('$Cast' in v) return `<Cast${attrs({ Type: v.$Type as string })}>${expr(v.$Cast as Json)}</Cast>`;
  if ('$IsOf' in v) return `<IsOf${attrs({ Type: v.$Type as string })}>${expr(v.$IsOf as Json)}</IsOf>`;
  if ('$UrlRef' in v) return `<UrlRef>${expr(v.$UrlRef as Json)}</UrlRef>`;
  return record(v);
}

function record(v: Obj): string {
  let type = v['@type'] as string | undefined;
  if (type && type.includes('#')) type = type.slice(type.lastIndexOf('#') + 1);
  const parts: string[] = [];
  for (const [k, val] of Object.entries(v)) {
    if (k === '@type' || k.startsWith('@odata.')) continue;
    if (k.startsWith('@')) continue; // handled below as record annotations
    if (k.includes('@')) continue; // annotations on property values are not supported
    parts.push(`<PropertyValue${attrs({ Property: k })}>${expr(val)}</PropertyValue>`);
  }
  return `<Record${attrs({ Type: type })}>${annotationsOf(v)}${parts.join('')}</Record>`;
}

/** Renders all "@Term" keys of an object as nested <Annotation> elements. */
function annotationsOf(o: Obj): string {
  const out: string[] = [];
  for (const [k, val] of Object.entries(o)) {
    if (!k.startsWith('@') || k === '@type' || k.startsWith('@odata.')) continue;
    const rest = k.slice(1);
    if (rest.includes('@')) continue; // annotation of annotation: emitted inside its host
    out.push(annotation(k, val, o));
  }
  return out.join('');
}

function annotation(key: string, value: Json, host: Obj): string {
  const { term, qualifier } = splitTerm(key);
  const nested = Object.entries(host)
    .filter(([k]) => k.startsWith(`${key}@`))
    .map(([k, v]) => annotation(`@${k.slice(key.length + 1)}`, v, {}))
    .join('');
  return `<Annotation${attrs({ Term: term, Qualifier: qualifier })}>${expr(value)}${nested}</Annotation>`;
}

function facets(p: Obj, jsonDefaultsNullableFalse: boolean): Record<string, string | number | boolean | undefined> {
  return {
    Type: (p.$Collection ? `Collection(${(p.$Type as string) ?? 'Edm.String'})` : ((p.$Type as string) ?? 'Edm.String')),
    Nullable: p.$Nullable === true ? 'true' : jsonDefaultsNullableFalse ? 'false' : undefined,
    MaxLength: p.$MaxLength as number | undefined,
    Precision: p.$Precision as number | undefined,
    Scale: p.$Scale as number | string | undefined,
    SRID: p.$SRID as string | undefined,
    DefaultValue: p.$DefaultValue as string | undefined,
    Unicode: p.$Unicode === false ? 'false' : undefined,
  };
}

function structured(name: string, t: Obj, kind: 'EntityType' | 'ComplexType'): string {
  const head = attrs({
    Name: name,
    BaseType: t.$BaseType as string | undefined,
    Abstract: t.$Abstract ? 'true' : undefined,
    OpenType: t.$OpenType ? 'true' : undefined,
    HasStream: t.$HasStream ? 'true' : undefined,
  });
  const body: string[] = [];
  if (kind === 'EntityType' && Array.isArray(t.$Key)) {
    body.push(
      `<Key>${(t.$Key as Json[])
        .map((k) => (typeof k === 'string' ? `<PropertyRef${attrs({ Name: k })}/>` : Object.entries(k as Obj).map(([alias, path]) => `<PropertyRef${attrs({ Name: path as string, Alias: alias })}/>`).join('')))
        .join('')}</Key>`,
    );
  }
  for (const [k, v] of Object.entries(t)) {
    if (k.startsWith('$') || k.startsWith('@') || !isObj(v)) continue;
    if (v.$Kind === 'NavigationProperty') {
      const rc = isObj(v.$ReferentialConstraint)
        ? Object.entries(v.$ReferentialConstraint).filter(([p]) => !p.includes('@')).map(([p, r]) => `<ReferentialConstraint${attrs({ Property: p, ReferencedProperty: r as string })}/>`).join('')
        : '';
      body.push(
        `<NavigationProperty${attrs({
          Name: k,
          Type: v.$Collection ? `Collection(${v.$Type as string})` : (v.$Type as string),
          Nullable: v.$Collection ? undefined : v.$Nullable === true ? 'true' : 'false',
          Partner: v.$Partner as string | undefined,
          ContainsTarget: v.$ContainsTarget ? 'true' : undefined,
        })}>${rc}${annotationsOf(v)}</NavigationProperty>`,
      );
    } else {
      body.push(`<Property${attrs({ Name: k, ...facets(v, true) })}>${annotationsOf(v)}</Property>`);
    }
  }
  body.push(annotationsOf(t));
  return `<${kind}${head}>${body.join('')}</${kind}>`;
}

function enumType(name: string, t: Obj): string {
  const members = Object.entries(t)
    .filter(([k]) => !k.startsWith('$') && !k.startsWith('@') && !k.includes('@'))
    .map(([k, v]) => `<Member${attrs({ Name: k, Value: v as number })}/>`)
    .join('');
  return `<EnumType${attrs({ Name: name, UnderlyingType: t.$UnderlyingType as string | undefined, IsFlags: t.$IsFlags ? 'true' : undefined })}>${members}${annotationsOf(t)}</EnumType>`;
}

function operation(name: string, kind: 'Action' | 'Function', o: Obj): string {
  const params = Array.isArray(o.$Parameter)
    ? (o.$Parameter as Obj[]).map((p) => `<Parameter${attrs({ Name: p.$Name as string, ...facets(p, true) })}>${annotationsOf(p)}</Parameter>`).join('')
    : '';
  const ret = isObj(o.$ReturnType) ? `<ReturnType${attrs(facets(o.$ReturnType, true))}/>` : '';
  return `<${kind}${attrs({
    Name: name,
    IsBound: o.$IsBound ? 'true' : undefined,
    IsComposable: o.$IsComposable ? 'true' : undefined,
    EntitySetPath: o.$EntitySetPath as string | undefined,
  })}>${params}${ret}${annotationsOf(o)}</${kind}>`;
}

function container(name: string, c: Obj): string {
  const body: string[] = [];
  for (const [k, v] of Object.entries(c)) {
    if (k.startsWith('$') || k.startsWith('@') || !isObj(v)) continue;
    const bindings = isObj(v.$NavigationPropertyBinding)
      ? Object.entries(v.$NavigationPropertyBinding).map(([p, t]) => `<NavigationPropertyBinding${attrs({ Path: p, Target: t as string })}/>`).join('')
      : '';
    if (v.$Action) body.push(`<ActionImport${attrs({ Name: k, Action: v.$Action as string, EntitySet: v.$EntitySet as string | undefined })}>${annotationsOf(v)}</ActionImport>`);
    else if (v.$Function) body.push(`<FunctionImport${attrs({ Name: k, Function: v.$Function as string, EntitySet: v.$EntitySet as string | undefined, IncludeInServiceDocument: v.$IncludeInServiceDocument ? 'true' : undefined })}>${annotationsOf(v)}</FunctionImport>`);
    else if (v.$Collection) body.push(`<EntitySet${attrs({ Name: k, EntityType: v.$Type as string })}>${bindings}${annotationsOf(v)}</EntitySet>`);
    else body.push(`<Singleton${attrs({ Name: k, Type: v.$Type as string })}>${bindings}${annotationsOf(v)}</Singleton>`);
  }
  return `<EntityContainer${attrs({ Name: name })}>${body.join('')}${annotationsOf(c)}</EntityContainer>`;
}

function schema(ns: string, s: Obj): string {
  const body: string[] = [];
  for (const [k, v] of Object.entries(s)) {
    if (k.startsWith('$') || k.startsWith('@')) continue;
    if (Array.isArray(v)) {
      for (const o of v) if (isObj(o) && (o.$Kind === 'Action' || o.$Kind === 'Function')) body.push(operation(k, o.$Kind, o));
      continue;
    }
    if (!isObj(v)) continue;
    switch (v.$Kind) {
      case 'EntityType': body.push(structured(k, v, 'EntityType')); break;
      case 'ComplexType': body.push(structured(k, v, 'ComplexType')); break;
      case 'EnumType': body.push(enumType(k, v)); break;
      case 'TypeDefinition': body.push(`<TypeDefinition${attrs({ Name: k, UnderlyingType: v.$UnderlyingType as string })}>${annotationsOf(v)}</TypeDefinition>`); break;
      case 'EntityContainer': body.push(container(k, v)); break;
      case 'Term': body.push(`<Term${attrs({ Name: k, ...facets(v, false), AppliesTo: Array.isArray(v.$AppliesTo) ? (v.$AppliesTo as string[]).join(' ') : undefined })}/>`); break;
      default: break;
    }
  }
  if (isObj(s.$Annotations)) {
    for (const [target, anns] of Object.entries(s.$Annotations)) {
      if (isObj(anns)) body.push(`<Annotations${attrs({ Target: target })}>${annotationsOf(anns)}</Annotations>`);
    }
  }
  body.push(annotationsOf(s));
  return `<Schema${attrs({ xmlns: EDM, Namespace: ns, Alias: s.$Alias as string | undefined })}>${body.join('')}</Schema>`;
}

export function csdlJsonToXml(doc: unknown): string {
  if (!isObj(doc as Json)) throw new TypeError('CSDL JSON document must be an object');
  const d = doc as Obj;
  const refs = isObj(d.$Reference)
    ? Object.entries(d.$Reference)
        .map(([uri, r]) => {
          const inc = isObj(r) && Array.isArray(r.$Include)
            ? (r.$Include as Obj[]).map((i) => `<edmx:Include${attrs({ Namespace: i.$Namespace as string, Alias: i.$Alias as string | undefined })}/>`).join('')
            : '';
          return `<edmx:Reference${attrs({ Uri: uri })}>${inc}</edmx:Reference>`;
        })
        .join('')
    : '';
  const schemas = Object.entries(d)
    .filter(([k, v]) => !k.startsWith('$') && !k.startsWith('@') && isObj(v))
    .map(([k, v]) => schema(k, v as Obj))
    .join('');
  const version = typeof d.$Version === 'string' ? d.$Version : '4.0';
  return `<?xml version="1.0" encoding="utf-8"?><edmx:Edmx${attrs({ Version: version, 'xmlns:edmx': EDMX })}>${refs}<edmx:DataServices>${schemas}</edmx:DataServices></edmx:Edmx>`;
}
