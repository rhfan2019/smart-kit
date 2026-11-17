// The entity model the CLI generates: from PostgreSQL tables (introspect.ts) to CSDL (csdl.ts).

export interface GenProperty {
  name: string;
  column: string;
  edmType: string;
  nullable: boolean;
  maxLength?: number;
  precision?: number;
  scale?: number | 'variable';
  /** From the column comment: becomes Common.Label. */
  label?: string;
}

export interface GenNavigation {
  name: string;
  targetType: string;
  targetSet: string;
  collection: boolean;
  nullable: boolean;
  partner?: string;
  /** Dependent side only: own property -> property of the target. */
  constraints?: { property: string; referencedProperty: string }[];
}

export interface GenEntity {
  schema: string;
  table: string;
  type: string;
  set: string;
  /** From the table comment: becomes Core.Description. */
  description?: string;
  keys: string[];
  properties: GenProperty[];
  navigations: GenNavigation[];
}

export interface GenModel {
  namespace: string;
  container: string;
  entities: GenEntity[];
  warnings: string[];
}

/** snake_case -> PascalCase ("purchase_order_item" -> "PurchaseOrderItem"). */
export const pascal = (s: string) =>
  s
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((w) => w[0]!.toUpperCase() + w.slice(1))
    .join('');

/** Naive English plural for entity set names; override in the configuration where it is wrong. */
export function plural(s: string): string {
  if (/[^aeiou]y$/i.test(s)) return `${s.slice(0, -1)}ies`;
  if (/(s|x|z|ch|sh)$/i.test(s)) return `${s}es`;
  return `${s}s`;
}
