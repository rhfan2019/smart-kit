import { parse, merge } from '@sap-ux/edmx-parser';
import { convert } from '@sap-ux/annotation-converter';
import type { ConvertedMetadata } from '@sap-ux/vocabularies-types';
import { csdlJsonToXml } from './csdlJsonToXml';
import { hoistInlineAnnotations } from './hoist';

/** A CSDL document: XML text, JSON text, or an already parsed CSDL JSON object. */
export type CsdlSource = string | Record<string, unknown>;

export class ModelError extends Error {
  override name = 'ModelError';
}

/** Normalizes any CSDL source to CSDL XML text. */
export function toCsdlXml(source: CsdlSource): string {
  if (typeof source !== 'string') return csdlJsonToXml(source);
  const trimmed = source.trimStart();
  if (trimmed.startsWith('<')) return source;
  if (trimmed.startsWith('{')) {
    let doc: unknown;
    try {
      doc = JSON.parse(source);
    } catch (e) {
      throw new ModelError(`CSDL JSON is not valid JSON: ${(e as Error).message}`);
    }
    return csdlJsonToXml(doc);
  }
  throw new ModelError('CSDL source is neither XML nor JSON');
}

export interface ConvertResult {
  converted: ConvertedMetadata;
  diagnostics: string[];
}

/**
 * Parses the service metadata plus annotation files and a local overlay, in this order
 * of increasing precedence, and converts them with @sap-ux/annotation-converter.
 */
export function convertSources(metadata: CsdlSource, annotationFiles: CsdlSource[] = [], overlay?: CsdlSource): ConvertResult {
  const sources = [metadata, ...annotationFiles, ...(overlay ? [overlay] : [])];
  const diagnostics: string[] = [];
  // The upstream parser reports unsupported expressions with console.error; capture them as diagnostics.
  const original = console.error;
  console.error = (...args: unknown[]) => diagnostics.push(args.map(String).join(' '));
  try {
    const raws = sources.map((s, i) => {
      const xml = hoistInlineAnnotations(toCsdlXml(s));
      try {
        return parse(xml, i === 0 ? 'service' : i === sources.length - 1 && overlay ? 'overlay' : `annotations-${i}`);
      } catch (e) {
        throw new ModelError(`Cannot parse CSDL document #${i}: ${(e as Error).message}`);
      }
    });
    const service = raws[0];
    if (!service || service.schema.entityContainer === undefined || !service.schema.entityContainer.name) {
      throw new ModelError('$metadata has no EntityContainer');
    }
    const converted = convert(raws.length > 1 ? merge(...raws) : service);
    for (const d of converted.diagnostics ?? []) {
      // Inferred record types are expected for hand-written annotations; keep the rest.
      if (!/was not defined and was inferred/.test(d.message)) diagnostics.push(d.message);
    }
    return { converted, diagnostics };
  } finally {
    console.error = original;
  }
}
