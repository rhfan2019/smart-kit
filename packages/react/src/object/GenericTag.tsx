/**
 * sap.m.GenericTag and sap.fe.macros.KPITag (ADR-033; OP Message Handling): a KPI or situation with a status colour, e.g.
 * in the header key information.
 */
import { XCircle } from 'lucide-react';
import type { ReactNode } from 'react';
import type { ValueState } from '../controls/types';
import CriticalityIcon from '../kit/CriticalityIcon';

/** sap.m.GenericTagDesign */
export type GenericTagDesign = 'Full' | 'StatusIconHidden';
export const GenericTagDesign = { Full: 'Full', StatusIconHidden: 'StatusIconHidden' } as const;

/** sap.m.GenericTagValueState */
export type GenericTagValueState = 'None' | 'Error';
export const GenericTagValueState = { None: 'None', Error: 'Error' } as const;

const CLASS: Record<ValueState, string> = { None: 'neutral', Error: 'negative', Warning: 'critical', Success: 'positive', Information: 'info' };
const CRITICALITY: Record<ValueState, number> = { None: 0, Error: 1, Warning: 2, Success: 3, Information: 5 };

export interface $GenericTagSettings {
  /** The label. @defaultValue '' */
  text?: string;
  /** Status colour and icon. @defaultValue 'None' */
  status?: ValueState;
  /** StatusIconHidden hides the status icon. @defaultValue 'Full' */
  design?: GenericTagDesign;
  /** Error shows an error icon instead of the value. @defaultValue 'None' */
  valueState?: GenericTagValueState;
  /** The value after the text (a string or an ObjectNumber). */
  value?: ReactNode;
  /** Makes the tag clickable. */
  onPress?(e: Record<string, never>): void;
  'data-testid'?: string;
}

/** sap.m.GenericTag. */
export function GenericTag(p: $GenericTagSettings) {
  return <TagView {...p} />;
}

/** The tag, with a tooltip (KPITag). */
function TagView({ text = '', status = 'None', design = 'Full', valueState = 'None', value, onPress, title, ...rest }: $GenericTagSettings & { title?: string }) {
  const cls = ['sk-generic-tag', `sk-generic-tag--${CLASS[status] ?? 'neutral'}`].join(' ');
  const body = (
    <>
      {status !== 'None' && design !== 'StatusIconHidden' ? <CriticalityIcon criticality={CRITICALITY[status]} /> : null}
      <span className="sk-generic-tag__text">{text}</span>
      {valueState === 'Error'
        ? <span className="sk-generic-tag__value sk-generic-tag__value--error" data-sk-generic-tag-error><XCircle className="sk-icon" aria-hidden /></span>
        : value !== undefined && value !== '' && value !== null ? <span className="sk-generic-tag__value">{value}</span> : null}
    </>
  );
  return onPress ? (
    <button type="button" className={cls} onClick={() => onPress({})} title={title} data-testid={rest['data-testid']} data-sk-generic-tag={status}>{body}</button>
  ) : (
    <span className={cls} role="status" title={title} data-testid={rest['data-testid']} data-sk-generic-tag={status}>{body}</span>
  );
}

export interface $KPITagSettings {
  /** The KPI label. */
  text?: string;
  /** The KPI value. */
  number?: string;
  /** The unit after the value. */
  unit?: string;
  /** Status colour (a ValueState). @defaultValue 'None' */
  status?: string;
  /** Shows the status icon. @defaultValue false */
  showIcon?: boolean;
  /** Tooltip of the tag. */
  tooltip?: string;
  /** Fired when the tag is pressed (e.g. to open the KPI card). */
  onPress?(e: Record<string, never>): void;
}

const VALUE_STATES = new Set<string>(['None', 'Error', 'Warning', 'Success', 'Information']);

/** sap.fe.macros.KPITag: the KPI usage of GenericTag (text, number and unit, status colour). */
export function KPITag({ text, number, unit, status = 'None', showIcon = false, tooltip, onPress }: $KPITagSettings) {
  const state = (VALUE_STATES.has(status) ? status : 'None') as ValueState;
  const value = number === undefined ? undefined : unit ? `${number} ${unit}` : number;
  return <TagView text={text} value={value} status={state} design={showIcon ? 'Full' : 'StatusIconHidden'} title={tooltip} onPress={onPress} />;
}
