/** SmartForm: field groups with labels on top, 1/3/4/6 columns by container width (OP-13). */
import type { FormGroupModel, Row } from '@rhfan2019/smart-kit-core';
import type { ReactNode } from 'react';
import { SmartField } from '../field/SmartField';
import { applyExtensions, type ExtendEntry } from '../util/extend';

export interface FormFieldItem {
  id: string;
  label: string;
  render?(row: Row | undefined): ReactNode;
}

export interface SmartFormProps {
  typeName: string;
  service?: string;
  row: Row | undefined;
  groups: FormGroupModel[];
  mode?: 'display' | 'edit';
  /** Insert or replace fields (ids as in the model; anchors may be in any group). */
  extend?: ExtendEntry<FormFieldItem>[];
  /** Edit mode values and changes (edit seam). */
  values?: Row;
  onChange?(path: string, value: unknown): void;
  /** Show group titles (hidden when a group title would repeat the subsection title). */
  showGroupTitles?: boolean;
}

export function SmartForm(p: SmartFormProps) {
  const anchorGroup = (id: string) => p.groups.findIndex((g) => g.fields.some((f) => f.id === id));
  return (
    <div className="sk-form" data-mode={p.mode ?? 'display'} data-groups={p.groups.length}>
      <div className="sk-form__grid">
        {p.groups.map((g, gi) => {
          const items: FormFieldItem[] = g.fields.map((f) => ({ id: f.id, label: f.label }));
          const ext = (p.extend ?? []).filter((e) => (e.anchor ? anchorGroup(e.anchor) === gi : e.position === 'replace' ? anchorGroup(e.id) === gi : gi === p.groups.length - 1));
          const fields = applyExtensions(items, ext, 'SmartForm');
          return (
            <div className="sk-form__group" key={g.id} data-sk-group={g.id} role="group" aria-label={g.label}>
              {p.showGroupTitles !== false && g.label ? <h4 className="sk-form__group-title">{g.label}</h4> : null}
              {fields.map((item) => {
                const model = g.fields.find((f) => f.id === item.id);
                return (
                  <div className="sk-form__field" key={item.id} data-sk-field={item.id}>
                    <div className="sk-form__label">{item.label}</div>
                    <div className="sk-form__value">
                      {item.render ? item.render(p.row) : model ? (
                        <SmartField typeName={p.typeName} service={p.service} field={model} row={p.row} mode={p.mode} value={model.path ? p.values?.[model.path] : undefined} onChange={model.path ? (v) => p.onChange?.(model.path!, v) : undefined} aria-label={model.label} />
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
