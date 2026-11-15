/**
 * @sap-ux/edmx-parser only reads annotations inside <Annotations Target="…"> blocks. CSDL also allows
 * annotations written inline on the annotated element; this pass moves them into external blocks.
 */
import { js2xml, xml2js, type Element } from 'xml-js';

const local = (name: string | undefined) => (name ?? '').replace(/^.*:/, '');
const isAnnotation = (e: Element) => e.type === 'element' && local(e.name) === 'Annotation';

function take(el: Element): Element[] {
  const kids = el.elements ?? [];
  const anns = kids.filter(isAnnotation);
  if (anns.length) el.elements = kids.filter((k) => !isAnnotation(k));
  return anns;
}

function annotationsBlock(target: string, anns: Element[], schemaNs: string | undefined): Element {
  return { type: 'element', name: schemaNs ? `${schemaNs}Annotations` : 'Annotations', attributes: { Target: target }, elements: anns };
}

/** Moves inline annotations to <Annotations Target> blocks. Returns the input unchanged when there are none. */
export function hoistInlineAnnotations(xml: string): string {
  if (!/<(?:\w+:)?Annotation[\s>]/.test(xml)) return xml;
  const doc = xml2js(xml, { compact: false, captureSpacesBetweenElements: false }) as Element;
  let changed = false;
  const visit = (el: Element) => {
    for (const child of el.elements ?? []) {
      if (child.type !== 'element') continue;
      if (local(child.name) === 'Schema') hoistSchema(child);
      else visit(child);
    }
  };
  const hoistSchema = (schema: Element) => {
    const ns = String(schema.attributes?.Namespace ?? '');
    const prefix = (schema.name ?? '').includes(':') ? `${schema.name!.split(':')[0]}:` : undefined;
    const blocks: Element[] = [];
    const add = (target: string, anns: Element[]) => {
      if (anns.length) {
        blocks.push(annotationsBlock(target, anns, prefix));
        changed = true;
      }
    };
    for (const el of schema.elements ?? []) {
      if (el.type !== 'element') continue;
      const kind = local(el.name);
      const name = String(el.attributes?.Name ?? '');
      if (kind === 'EntityType' || kind === 'ComplexType') {
        const typeName = `${ns}.${name}`;
        for (const member of el.elements ?? []) {
          const mk = local(member.name);
          if (mk === 'Property' || mk === 'NavigationProperty') add(`${typeName}/${String(member.attributes?.Name)}`, take(member));
        }
        add(typeName, take(el));
      } else if (kind === 'EntityContainer') {
        const containerName = `${ns}.${name}`;
        for (const member of el.elements ?? []) {
          const mk = local(member.name);
          if (mk === 'EntitySet' || mk === 'Singleton' || mk === 'ActionImport' || mk === 'FunctionImport') add(`${containerName}/${String(member.attributes?.Name)}`, take(member));
        }
        add(containerName, take(el));
      } else if (kind === 'EnumType' || kind === 'TypeDefinition' || kind === 'Term') {
        add(`${ns}.${name}`, take(el));
      }
    }
    if (blocks.length) schema.elements = [...(schema.elements ?? []), ...blocks];
  };
  visit(doc);
  return changed ? js2xml(doc, { compact: false }) : xml;
}
