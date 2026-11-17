/** UI.TextArrangement (ANN-13): how a code and its text are shown together. */
import { resolvePath } from './buildModel';
import type { MetaModel, PropertyModel, TextArrangement } from './types';

/**
 * The display of a code with its text: TextFirst (default) "Text (Code)", TextLast "Code (Text)", TextOnly "Text",
 * TextSeparate "Code" (the text goes in a column of its own). Without a text, the code; without a code, the text
 * (except TextSeparate).
 */
export function arrangeText(code: string, text: string | undefined, arrangement: TextArrangement = 'TextFirst'): string {
  if (text === undefined || text === '') return code;
  switch (arrangement) {
    case 'TextOnly': return text;
    case 'TextLast': return code ? `${code} (${text})` : text;
    case 'TextSeparate': return code;
    default: return code ? `${text} (${code})` : text;
  }
}

/**
 * Text arrangement for the values of a property's value list: the property's own (Common.Text@UI.TextArrangement or
 * the entity type's UI.TextArrangement), else the one of the value list's key property; undefined when neither says.
 */
export function valueListTextArrangement(model: MetaModel, prop: PropertyModel | undefined): TextArrangement | undefined {
  if (!prop) return undefined;
  if (prop.textArrangement) return prop.textArrangement;
  const vl = prop.valueList;
  const typeName = vl ? model.entitySets[vl.collectionPath]?.typeName : undefined;
  return typeName ? resolvePath(model.entityTypes, typeName, vl!.keyProperty).property?.textArrangement : undefined;
}
