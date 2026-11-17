/** SmartForm: field groups with labels on top, 1/3/4/6 columns by container width (OP-13). */
import { resolvePath, type FormGroupModel, type Row } from '@rhfan2019/smart-kit-core';
import type { ReactNode } from 'react';
import { useService } from '../context/SmartKitProvider';
import { isEditable } from '../edit/editing';
import { SmartField } from '../field/SmartField';
import { applyExtensions, type ExtendEntry } from '../util/extend';

export interface FormFieldItem {
  id: string;
  label: string;
  render?(row: Row | undefined): ReactNode;
}

export interface SmartFormProps {
  /** Full name of the entity type, e.g. "Shop.Order" (`model.entitySets[set].typeName`). */
  typeName: string;
  /** Name of the service in `SmartKitProvider` `services`; default: the provider's `defaultService`. */
  service?: string;
  /** The entity row as read from the service (`Row`, property paths as keys, expanded navigations as nested objects); undefined while loading. */
  row: Row | undefined;
  /** Field groups to show, e.g. `subSection.content.groups` of the model or `ui.fieldGroups[qualifier]`. */
  groups: FormGroupModel[];
  /** "display" (default) or "edit" (then pass `values`, `onChange`, `errors`). */
  mode?: 'display' | 'edit';
  /** Insert or replace fields (ids as in the model; anchors may be in any group). */
  extend?: ExtendEntry<FormFieldItem>[];
  /** Edit mode values and changes (edit seam). */
  values?: Row;
  /** Edit mode: called with the property path and the new value. */
  onChange?(path: string, value: unknown): void;
  /** Show group titles (hidden when a group title would repeat the subsection title). */
  showGroupTitles?: boolean;
  /** Edit mode: error texts by property path. */
  errors?: Record<string, string>;
  /** Edit mode: creating a new object (key and immutable properties are editable). */
  creating?: boolean;
}

export function SmartForm(p: SmartFormProps) {
  const service = useService(p.service);
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
              {p.showGroupTitles !== false && g.label ? <h5 className="sk-form__group-title sk-title--h5">{g.label}</h5> : null}
              {fields.map((item) => {
                const model = g.fields.find((f) => f.id === item.id);
                const prop = model?.path ? resolvePath(service.model.entityTypes, p.typeName, model.path).property : undefined;
                const editing = p.mode === 'edit';
                const editable = editing && model?.kind === 'field' && !model.path?.includes('/') && isEditable(prop, Boolean(p.creating));
                const value = model?.path ? (editing ? p.values?.[model.path] : undefined) : undefined;
                const required = Boolean(prop?.mandatory);
                const inputId = model?.path ? `sk-field-${p.typeName.replace(/\W/g, '_')}-${model.path.replace(/\W/g, '_')}` : undefined;
                return (
                  <div
                    className="sk-form__field" key={item.id} data-sk-field={item.id} data-sk-field-path={model?.path}
                    data-importance={model?.importance} data-sk-editable={editable || undefined}
                    data-sk-mandatory-empty={editable && required && (value === undefined || value === null || value === '') ? true : undefined}
                  >
                    <label className="sk-form__label" htmlFor={editable ? inputId : undefined}>{item.label}{editable && required ? <span className="sk-form__required" aria-hidden> *</span> : null}</label>
                    <div className="sk-form__value">
                      {item.render ? item.render(p.row) : model ? (
                        <SmartField
                          typeName={p.typeName} service={p.service} field={model} row={p.row} mode={editable ? 'edit' : 'display'} value={value}
                          onChange={model.path ? (v) => p.onChange?.(model.path!, v) : undefined} aria-label={model.label}
                          error={model.path ? p.errors?.[model.path] : undefined} required={required} id={inputId}
                        />
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
