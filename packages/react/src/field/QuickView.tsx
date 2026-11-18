/**
 * Quick view (LR Navigation · cross navigation): a link that opens a sap.m.QuickView with the referenced object's
 * UI.HeaderInfo (header = TypeName, title, description, image) and UI.QuickViewFacets (one group per facet).
 */
import { Avatar, UnstyledButton } from '@mantine/core';
import { buildObjectRequest, keyPredicate, type FieldModel, type Row } from '@rhfan2019/smart-kit-core';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useRef, useState, type ReactNode } from 'react';
import { QuickView, QuickViewGroup, QuickViewGroupElement, QuickViewPage } from '../controls/quickview/QuickView';
import { useService, useSmartKit, useText } from '../context/SmartKitProvider';
import { Field } from './Field';
import { getPath } from './values';

export function QuickViewLink({ typeName, field, row, service: serviceName, children }: { typeName: string; field: FieldModel; row: Row | undefined; service?: string; children: ReactNode }) {
  const service = useService(serviceName);
  const { navigation } = useSmartKit();
  const t = useText();
  const [opened, setOpened] = useState(false);
  const link = useRef<HTMLButtonElement>(null);
  const qvRef = useRef<QuickView>(null);
  const qv = field.quickView!;
  const model = service.model;
  // Key of the referenced object from the referential constraints of the navigation.
  const target = useMemo(() => {
    const segs = qv.navigation.split('/');
    let tn = typeName;
    let base: Row | undefined = row;
    for (const s of segs.slice(0, -1)) { base = getPath(base, s) as Row | undefined; tn = model.entityTypes[tn]?.navigations[s]?.targetType ?? tn; }
    const nav = model.entityTypes[tn]?.navigations[segs[segs.length - 1]!];
    const set = Object.values(model.entitySets).find((es) => es.typeName === qv.typeName);
    if (!nav || !set || !base) return undefined;
    // the key from the referential constraints, else from the expanded object (a key or semantic key read through the
    // navigation, FE isUsedInNavigationWithQuickViewFacets)
    const key: Row = {};
    const expanded = base[nav.name] as Row | undefined;
    for (const rc of nav.referentialConstraints) key[rc.referencedProperty] = base[rc.property] ?? expanded?.[rc.referencedProperty];
    for (const k of model.entityTypes[qv.typeName]?.keys ?? []) if (key[k] === undefined && expanded?.[k] !== undefined) key[k] = expanded[k];
    try {
      return { entitySet: set.name, path: `${set.name}${keyPredicate(model.entityTypes[qv.typeName]!, key)}` };
    } catch {
      return undefined;
    }
  }, [qv, typeName, row, model]);
  const ui = model.ui[qv.typeName]!;
  const groups = useMemo(() => ui.quickView ?? [], [ui]);
  const req = useMemo(() => buildObjectRequest(model, qv.typeName, { ...ui, headerFacets: [], sections: [] }, groups.flatMap((g) => g.fields)), [model, qv.typeName, ui, groups]);
  const q = useQuery({
    queryKey: ['smart-kit', 'quickView', service.name, target?.path],
    queryFn: ({ signal }) => service.dataProvider.read(target!.path, req, { signal }),
    enabled: opened && Boolean(target),
    staleTime: 60_000,
  });
  if (!target) return <>{children}</>;
  const data = q.data;
  const title = ui.headerInfo.title ? getPath(data, ui.headerInfo.title) : undefined;
  const description = ui.headerInfo.description ? getPath(data, ui.headerInfo.description) : undefined;
  const image = ui.headerInfo.imageUrl && 'path' in ui.headerInfo.imageUrl ? getPath(data, ui.headerInfo.imageUrl.path) : undefined;
  const href = navigation?.hasObjectPage?.(target.entitySet, service.name) ? navigation.href?.({ kind: 'object', path: target.path, service: service.name }) : undefined;
  return (
    <>
      <UnstyledButton
        ref={link} className="sk-link sk-quickview__link" aria-haspopup="dialog" aria-expanded={opened} data-sk-quickview-link
        onClick={(e) => { e.stopPropagation(); if (opened) qvRef.current?.close(); else qvRef.current?.openBy(link.current); }}
      >
        {children}
      </UnstyledButton>
      <QuickView
        ref={qvRef} placement="Bottom" width="var(--sk-size-field-quickview)" busy={q.isLoading} aria-label={t('quickView.title', { type: ui.headerInfo.typeName })}
        onAfterOpen={() => setOpened(true)} onAfterClose={() => setOpened(false)}
      >
        <QuickViewPage
          header={ui.headerInfo.typeName} title={String(title ?? '')} titleUrl={href} description={description ? String(description) : undefined}
          avatar={image ? <Avatar src={String(image)} alt="" radius="md" /> : undefined}
        >
          {groups.map((g) => (
            <QuickViewGroup key={g.id} heading={g.label}>
              {g.fields.map((f) => (
                <QuickViewGroupElement key={f.id} label={f.label} value={<Field typeName={qv.typeName} service={service.name} metaPath={f} row={data} />} />
              ))}
            </QuickViewGroup>
          ))}
        </QuickViewPage>
      </QuickView>
    </>
  );
}
