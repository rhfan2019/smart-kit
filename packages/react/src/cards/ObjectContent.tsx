/**
 * Object card content (sap.ui.integration.cards.ObjectContent; OVP quick view card) — docs/20 §2.2.
 * One object: groups of "label: value" pairs from UI.QuickViewFacets (default), UI.Facets or one UI.FieldGroup;
 * actions from UI.Identification (UI.DataFieldForAction) in the footer. The header defaults to UI.HeaderInfo.
 */
import { buildObjectRequest, entityPathOf, getEntitySet, parseAnnotationPath, type ActionModel, type EntityPath, type FieldModel, type FormGroupModel, type Row } from '@rhfan2019/smart-kit-core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import { isActionAvailable } from '../actions/availability';
import { useService, useSmartKit, useText } from '../context/SmartKitProvider';
import { fieldValue, resolveRef, type ValueContext } from '../field/values';
import { useReportHeaderDefaults, useReportToCard } from './CardContext';
import { CardMessage, CardPlaceholder } from './CardStates';
import { withUnit } from './format';
import { qualifierOf } from './annotations';
import { criticalityState } from './ListContent';

export interface $ObjectContentSettings {
  /** Entity set name as in `$metadata`, e.g. "Orders". */
  entitySet: string;
  /** Name of the service in `SmartKitProvider` `services`; default: the provider's `defaultService`. */
  service?: string;
  /** Key values of the object, e.g. { ID: '42' }. */
  keys?: Row;
  /** Entity path of the object instead of `keys`, e.g. "Orders('42')". */
  path?: EntityPath;
  /** Groups: "UI.QuickViewFacets" (default when present), "UI.Facets" or "UI.FieldGroup#Q". */
  annotationPath?: string;
  /** Footer actions: UI.Identification (default "com.sap.vocabularies.UI.v1.Identification"); false: no actions. */
  identificationAnnotationPath?: string | false;
  /** Runs an action; default: the bound action is invoked without parameters and the card reloads. */
  onAction?(action: ActionModel, row: Row, path: EntityPath): void | Promise<void>;
  /** Header press default: the object page of the object; false: none. */
  headerNavigation?: boolean;
}

function groupsOf(ui: ReturnType<typeof useService>['model']['ui'][string], annotationPath: string | undefined): FormGroupModel[] {
  const term = annotationPath ? parseAnnotationPath(annotationPath).term : undefined;
  const sectionGroups = () => ui.sections.flatMap((s) => s.subSections.filter((ss) => ss.partOfPreview).flatMap((ss) => (ss.content.kind === 'form' ? ss.content.groups : [])));
  if (term === 'FieldGroup') {
    const g = ui.fieldGroups[qualifierOf(annotationPath)];
    return g ? [g] : [];
  }
  if (term === 'Facets') return sectionGroups();
  return ui.quickView?.length ? ui.quickView : sectionGroups();
}

export function ObjectContent(p: $ObjectContentSettings) {
  const service = useService(p.service);
  const { namespace, locale, timeZone, navigation } = useSmartKit();
  const t = useText();
  const qc = useQueryClient();
  const model = service.model;
  const typeName = getEntitySet(model, p.entitySet).typeName;
  const ui = model.ui[typeName]!;
  const groups = useMemo(() => groupsOf(ui, p.annotationPath), [ui, p.annotationPath]);
  const actions = useMemo(() => (p.identificationAnnotationPath === false ? [] : ui.objectActions), [p.identificationAnnotationPath, ui]);
  const path = p.path ?? entityPathOf(model, p.entitySet, p.keys ?? {});
  const fields = useMemo(() => groups.flatMap((g) => g.fields), [groups]);
  const req = useMemo(
    () => buildObjectRequest(model, typeName, ui, fields, actions.flatMap((a) => (a.operationAvailable && 'path' in a.operationAvailable ? [a.operationAvailable.path] : []))),
    [model, typeName, ui, fields, actions],
  );
  const key = ['smart-kit', namespace, service.name, locale, 'card-object', path, JSON.stringify(req)];
  const q = useQuery({ queryKey: key, queryFn: ({ signal }) => service.dataProvider.read(path, req, { signal }) });
  const row = q.data;
  const [busy, setBusy] = useState(false);

  const ctx: ValueContext = { model, typeName, locale, timeZone };
  const hi = ui.headerInfo;
  const title = row && hi.title ? fieldValue(ctx, { id: 'title', kind: 'field', path: hi.title, label: '', criticalityIcon: false, isSemanticKey: false }, row).display : undefined;
  const subtitle = row && hi.description ? fieldValue(ctx, { id: 'description', kind: 'field', path: hi.description, label: '', criticalityIcon: false, isSemanticKey: false }, row).display : undefined;
  const image = row ? resolveRef(row, hi.imageUrl) : undefined;
  useReportHeaderDefaults(row ? { title, subtitle, iconSrc: image ? String(image) : undefined, iconInitials: image ? undefined : initials(title) } : { title: hi.typeName });
  const svcName = service.name;
  const headerPress = useCallback(() => navigation?.toObject(path, svcName), [navigation, path, svcName]);
  const hasObjectPage = navigation?.hasObjectPage?.(p.entitySet, svcName) ?? Boolean(navigation);
  useReportToCard(undefined, p.headerNavigation === false || !hasObjectPage ? undefined : headerPress);

  if (q.isLoading) return <CardPlaceholder kind="object" rows={3} />;
  if (q.error || !row) return <CardMessage kind="error" />;

  const run = async (a: ActionModel) => {
    if (p.onAction) return p.onAction(a, row, path);
    if (!service.dataProvider.invoke) return;
    setBusy(true);
    try {
      await service.dataProvider.invoke(a.action, { path: a.bound ? path : undefined, parameters: {} });
    } finally {
      setBusy(false);
      await qc.invalidateQueries({ queryKey: ['smart-kit', namespace, service.name] });
    }
  };
  const shown = actions.filter((a) => isActionAvailable(a, row) && (p.onAction || a.parameters.length === 0));

  return (
    <div className="sk-card__object" aria-label={t('card.typeObject')}>
      <div className="sk-card__object-groups">
        {groups.map((g) => (
          <div key={g.id} className="sk-card__object-group">
            {g.label && <div className="sk-card__object-group-title" role="heading" aria-level={4}>{g.label}</div>}
            {g.fields.map((f) => <ObjectItem key={f.id} ctx={ctx} field={f} row={row} />)}
          </div>
        ))}
      </div>
      {shown.length > 0 && (
        <div className="sk-card__footer sk-card__actions">
          {shown.map((a, i) => (
            <button key={a.id} type="button" className={`sk-card__button${i === 0 ? ' sk-card__button--emphasized' : ''}`} disabled={busy} onClick={() => void run(a)}>
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ObjectItem({ ctx, field, row }: { ctx: ValueContext; field: FieldModel; row: Row }) {
  const t = useText();
  const v = fieldValue(ctx, field, row);
  const url = field.url ? resolveRef(row, field.url) : undefined;
  return (
    <div className="sk-card__object-item">
      <div className="sk-card__object-label">{t('card.label', { label: field.label })}</div>
      <div className={`sk-card__object-value${criticalityState(v.criticality)}`}>
        {url ? <a className="sk-card__link" href={String(url)} target="_blank" rel="noreferrer">{v.display}</a> : withUnit(v, t) || '–'}
      </div>
    </div>
  );
}

/** Initials of a title for the avatar ("Acme Corp" → "AC"). */
export function initials(text: string | undefined): string | undefined {
  if (!text) return undefined;
  const words = text.split(/\s+/).filter((w) => /\p{L}/u.test(w));
  return words.slice(0, 2).map((w) => w[0]!.toUpperCase()).join('') || undefined;
}

