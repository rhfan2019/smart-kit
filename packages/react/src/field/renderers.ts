/** Renderer registry: replace how a kind of value is displayed (AC-EXT-05). See docs/06-extension-and-theming.md §1. */
import type { FieldModel, PropertyModel, Row } from '@rhfan2019/smart-kit-core';
import type { ReactNode } from 'react';

export interface FieldRenderProps {
  /** Raw value. */
  value: unknown;
  /** Locale-formatted value, without unit or text. */
  formatted: string;
  /** Text according to Common.Text / TextArrangement ("Text (Code)" etc.), or the formatted value. */
  display: string;
  /** The entity row as read from the service (`Row`, property paths as keys, expanded navigations as nested objects); undefined while loading. */
  row: Row;
  /** A field from the model. */
  field: FieldModel;
  /** Property model of the field (`model.entityTypes[type].properties[name]`). */
  property?: PropertyModel;
  /** Unit or currency code, if any. */
  unit?: string;
  /** Resolved criticality 0–5, if any. */
  criticality?: number;
  /** "display" or "edit". */
  mode: 'display' | 'edit';
  /** Called with the new value. */
  onChange?(value: unknown): void;
}

export type FieldRenderer = (props: FieldRenderProps) => ReactNode;

/**
 * Keys, from most to least specific:
 * - `path:<EntityType full name>/<path>` — one field
 * - `rating`, `progress`, `image`, `link`, `currency`, `unit`, `criticality`, `boolean`
 * - `type:<Edm type>`, e.g. `type:Edm.Date`
 */
export type RendererRegistry = Record<string, FieldRenderer>;
