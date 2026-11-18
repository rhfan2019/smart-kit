/**
 * sap.fe.macros.Form (docs/26b, ADR-033): field groups with labels on top, 1/3/4/6 columns by container width
 * (FE's ColumnLayout defaults, OP-13). `contextPath` + `metaPath` locate the field group or facet as in Fiori elements.
 */
import { resolvePath, type FormGroupModel, type MetaModel, type Row } from '@rhfan2019/smart-kit-core';
import type { CSSProperties, ReactNode } from 'react';
import { useService } from '../context/SmartKitProvider';
import { isEditable } from '../edit/editing';
import { Field, typeOfContextPath } from '../field/Field';
import { applyExtensions, type ExtendEntry } from '../util/extend';

export interface FormFieldItem {
  id: string;
  label: string;
  render?(row: Row | undefined): ReactNode;
}

/** sap.fe.macros.form.FormLayoutOptions (a data aggregation, ADR-032 rule 2). Only the ColumnLayout column counts are used. */
export interface FormLayoutOptions {
  /** 'ColumnLayout' (FE default) or 'ResponsiveGridLayout' (shown as ColumnLayout). */
  type?: 'ColumnLayout' | 'ResponsiveGridLayout';
  /** Columns at container width ≥ 600px. @defaultValue 3 */
  columnsM?: number;
  /** Columns at container width ≥ 1024px. @defaultValue 4 */
  columnsL?: number;
  /** Columns at container width ≥ 1440px. @defaultValue 6 */
  columnsXL?: number;
  /** Not used by smart-kit (labels are always on top): labelCellsLarge, emptyCellsLarge, label and empty spans, breakpoints … */
  labelCellsLarge?: number;
  emptyCellsLarge?: number;
  adjustLabelSpan?: boolean;
  backgroundDesign?: string;
  breakpointL?: number;
  breakpointM?: number;
  breakpointXL?: number;
  emptySpanL?: number;
  emptySpanM?: number;
  emptySpanS?: number;
  emptySpanXL?: number;
  labelSpanL?: number;
  labelSpanM?: number;
  labelSpanS?: number;
  labelSpanXL?: number;
  singleContainerFullSize?: boolean;
}

/** Event object of `onChange` (smart-kit extension: the form's values are kept by the page). */
export interface Form$ChangeEvent {
  /** Property path of the changed field. */
  path: string;
  /** The new value. */
  value: unknown;
}

export interface $FormSettings {
  /** Entity set path, e.g. "/Items". */
  contextPath?: string;
  /**
   * The field group or facet: "@com.sap.vocabularies.UI.v1.FieldGroup#Q" (alias "@UI.FieldGroup#Q"), "@UI.Identification",
   * the id of a facet of UI.Facets (a reference facet, or a collection facet: all its field groups), or the field groups as the model read them (`subSection.content.groups`).
   */
  metaPath?: string | FormGroupModel[];
  /** Entity type full name; instead of `contextPath` when the page has the type. */
  typeName?: string;
  /** Name of the service in `SmartKitProvider` `services`; default: the provider's `defaultService`. */
  service?: string;
  /** The entity row (binding context) as read from the service; undefined while loading. */
  row: Row | undefined;
  /** Title shown above the form. */
  title?: string;
  /** @defaultValue true */
  visible?: boolean;
  /** Layout (sap.fe.macros.form.FormLayoutOptions); default ColumnLayout with columnsM 3, columnsL 4, columnsXL 6. */
  layout?: FormLayoutOptions;
  /** false: editable fields show editors (then pass `values`, `onChange`, `errors`); true or not set: display. */
  readOnly?: boolean;
  /** Insert or replace fields (ids as in the model; anchors may be in any group). */
  extend?: ExtendEntry<FormFieldItem>[];
  /** Edit mode values by property path (the page keeps them). */
  values?: Row;
  /** Edit mode: fired with the property path and the new value. */
  onChange?: (e: Form$ChangeEvent) => void;
  /** Edit mode: error texts by property path. */
  errors?: Record<string, string>;
  /** Edit mode: creating a new object (key and immutable properties are editable). */
  creating?: boolean;
}

const FIELD_GROUP = /^@(?:com\.sap\.vocabularies\.UI\.v1|UI)\.FieldGroup(?:#(.*))?$/;
const IDENTIFICATION = /^@(?:com\.sap\.vocabularies\.UI\.v1|UI)\.Identification$/;

/** The field groups a form metaPath refers to. */
export function formGroupsOf(model: MetaModel, typeName: string, metaPath: string | FormGroupModel[] | undefined): FormGroupModel[] {
  if (Array.isArray(metaPath)) return metaPath;
  const ui = model.ui[typeName];
  if (!metaPath || !ui) return [];
  const fg = FIELD_GROUP.exec(metaPath);
  if (fg) { const g = ui.fieldGroups[fg[1] ?? '']; return g ? [g] : []; }
  if (IDENTIFICATION.test(metaPath)) return [{ id: 'Identification', fields: ui.identification }];
  // a reference facet (subsection), or a collection facet (section): the groups of its form subsections
  for (const s of ui.sections) {
    if (s.id === metaPath) return s.subSections.flatMap((sub) => (sub.content.kind === 'form' ? sub.content.groups : []));
    for (const sub of s.subSections) if (sub.id === metaPath && sub.content.kind === 'form') return sub.content.groups;
  }
  return [];
}

/** sap.fe.macros.Form */
export function Form(p: $FormSettings) {
  const service = useService(p.service);
  const typeName = p.typeName ?? typeOfContextPath(service.model, p.contextPath) ?? '';
  const groups = formGroupsOf(service.model, typeName, p.metaPath);
  if (p.visible === false) return null;
  const anchorGroup = (id: string) => groups.findIndex((g) => g.fields.some((f) => f.id === id));
  const editing = p.readOnly === false;
  const l = p.layout;
  const style = { '--sk-form-cols-m': l?.columnsM, '--sk-form-cols-l': l?.columnsL, '--sk-form-cols-xl': l?.columnsXL } as CSSProperties;
  // FE shows the container titles only when the form has more than one container (the subsection title names a single one)
  const groupTitles = groups.length > 1;
  return (
    <div className="sk-form" data-mode={editing ? 'edit' : 'display'} data-groups={groups.length} style={style}>
      {p.title ? <h4 className="sk-form__title sk-title--h4">{p.title}</h4> : null}
      <div className="sk-form__grid">
        {groups.map((g, gi) => {
          const items: FormFieldItem[] = g.fields.map((f) => ({ id: f.id, label: f.label }));
          const ext = (p.extend ?? []).filter((e) => (e.anchor ? anchorGroup(e.anchor) === gi : e.position === 'replace' ? anchorGroup(e.id) === gi : gi === groups.length - 1));
          const fields = applyExtensions(items, ext, 'Form');
          return (
            <div className="sk-form__group" key={g.id} data-sk-group={g.id} role="group" aria-label={g.label}>
              {groupTitles && g.label ? <h5 className="sk-form__group-title sk-title--h5">{g.label}</h5> : null}
              {fields.map((item) => {
                const model = g.fields.find((f) => f.id === item.id);
                const prop = model?.path ? resolvePath(service.model.entityTypes, typeName, model.path).property : undefined;
                const editable = editing && model?.kind === 'field' && !model.path?.includes('/') && isEditable(prop, Boolean(p.creating));
                const value = model?.path ? (editing ? p.values?.[model.path] : undefined) : undefined;
                const required = Boolean(prop?.mandatory);
                const inputId = model?.path ? `sk-field-${typeName.replace(/\W/g, '_')}-${model.path.replace(/\W/g, '_')}` : undefined;
                return (
                  <div
                    className="sk-form__field" key={item.id} data-sk-field={item.id} data-sk-field-path={model?.path}
                    data-importance={model?.importance} data-sk-editable={editable || undefined}
                    data-sk-mandatory-empty={editable && required && (value === undefined || value === null || value === '') ? true : undefined}
                  >
                    <label className="sk-form__label" htmlFor={editable ? inputId : undefined}>{item.label}{editable && required ? <span className="sk-form__required" aria-hidden> *</span> : null}</label>
                    <div className="sk-form__value">
                      {item.render ? item.render(p.row) : model ? (
                        <Field
                          typeName={typeName} service={p.service} metaPath={model} row={p.row} readOnly={!editable} value={value}
                          onChange={model.path ? (e) => p.onChange?.({ path: model.path!, value: e.value }) : undefined} onLiveChange={model.path ? (e) => p.onChange?.({ path: model.path!, value: e.value }) : undefined} aria-label={model.label}
                          error={model.path ? p.errors?.[model.path] : undefined} id={inputId}
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
