import type { EdmType } from '../model/types';

const NUMERIC = new Set(['Edm.Byte', 'Edm.SByte', 'Edm.Int16', 'Edm.Int32', 'Edm.Int64', 'Edm.Decimal', 'Edm.Double', 'Edm.Single']);

export class LiteralError extends Error {
  override name = 'LiteralError';
}

/** Formats a value as an OData URL literal of the given Edm type. Numbers travel as strings (exact). */
export function toLiteral(value: unknown, type: EdmType): string {
  if (value === null || value === undefined) return 'null';
  if (NUMERIC.has(type)) {
    const s = String(value).trim();
    if (!/^[-+]?(\d+(\.\d*)?|\.\d+)([eE][-+]?\d+)?$/.test(s) && !/^(INF|-INF|NaN)$/.test(s)) throw new LiteralError(`"${s}" is not a valid ${type}`);
    return s;
  }
  switch (type) {
    case 'Edm.Boolean':
      return value === true || value === 'true' ? 'true' : 'false';
    case 'Edm.Guid': {
      const s = String(value);
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)) throw new LiteralError(`"${s}" is not a valid Edm.Guid`);
      return s;
    }
    case 'Edm.Date': {
      const s = String(value);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new LiteralError(`"${s}" is not a valid Edm.Date`);
      return s;
    }
    case 'Edm.DateTimeOffset': {
      const s = value instanceof Date ? value.toISOString() : String(value);
      if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/.test(s)) throw new LiteralError(`"${s}" is not a valid Edm.DateTimeOffset`);
      return s;
    }
    case 'Edm.TimeOfDay': {
      const s = String(value);
      if (!/^\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(s)) throw new LiteralError(`"${s}" is not a valid Edm.TimeOfDay`);
      return s;
    }
    case 'Edm.Duration':
      return `duration'${String(value)}'`;
    default:
      return `'${String(value).replace(/'/g, "''")}'`;
  }
}

/** Encodes a literal for use inside a key predicate or path segment. */
export function encodeKeyLiteral(value: unknown, type: EdmType): string {
  return encodeURIComponent(toLiteral(value, type)).replace(/%27/g, "'").replace(/%3D/g, '=').replace(/%3A/g, ':');
}
