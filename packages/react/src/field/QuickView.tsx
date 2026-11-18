/** Quick view (LR Navigation · cross navigation): a link that opens a popover with the referenced object's UI.QuickViewFacets. */
import { Avatar, Group, Loader, Popover, Text, UnstyledButton } from '@mantine/core';
import { buildObjectRequest, keyPredicate, type FieldModel, type Row } from '@rhfan2019/smart-kit-core';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState, type ReactNode } from 'react';
import { useService, useSmartKit, useText } from '../context/SmartKitProvider';
import { Field } from './Field';
import { getPath } from './values';

export function QuickViewLink({ typeName, field, row, service: serviceName, children }: { typeName: string; field: FieldModel; row: Row | undefined; service?: string; children: ReactNode }) {
  const service = useService(serviceName);
  const { navigation } = useSmartKit();
  const t = useText();
  const [opened, setOpened] = useState(false);
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
    <Popover opened={opened} onChange={setOpened} width={300} position="bottom-start" withArrow trapFocus returnFocus>
      <Popover.Target>
        <UnstyledButton className="sk-link sk-quickview__link" onClick={(e) => { e.stopPropagation(); setOpened((o) => !o); }} aria-haspopup="dialog" aria-expanded={opened} data-sk-quickview-link>
          {children}
        </UnstyledButton>
      </Popover.Target>
      <Popover.Dropdown role="dialog" aria-label={t('quickView.title', { type: ui.headerInfo.typeName })} data-sk-quickview onClick={(e) => e.stopPropagation()}>
        {q.isLoading ? <Loader size="sm" /> : (
          <div className="sk-quickview">
            <Group gap="sm" wrap="nowrap" mb="sm">
              {image ? <Avatar src={String(image)} alt="" radius="md" /> : null}
              <div>
                <Text fw={600} data-sk-quickview-title>{href ? <a className="sk-link" href={href}>{String(title ?? '')}</a> : String(title ?? '')}</Text>
                {description ? <Text size="sm" c="dimmed">{String(description)}</Text> : null}
                <Text size="xs" c="dimmed">{ui.headerInfo.typeName}</Text>
              </div>
            </Group>
            {groups.map((g) => (
              <dl key={g.id} className="sk-quickview__group">
                {g.label ? <Text size="sm" fw={600}>{g.label}</Text> : null}
                {g.fields.map((f) => (
                  <div key={f.id} className="sk-facet__pair">
                    <dt>{f.label}:</dt>
                    <dd><Field typeName={qv.typeName} service={service.name} metaPath={f} row={data} /></dd>
                  </div>
                ))}
              </dl>
            ))}
          </div>
        )}
      </Popover.Dropdown>
    </Popover>
  );
}
