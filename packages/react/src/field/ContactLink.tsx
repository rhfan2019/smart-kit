/**
 * Communication.Contact in a cell or form (sap.fe.macros.contact.Contact, ContactDelegate, ContactQuickView fragment):
 * the contact's name (`fn`) as a link that opens a popover with the name, role, job title, department, e-mail and phone.
 * As the OData V4 model of Fiori elements, the list reads only the name; the details are read when the popover opens.
 */
import { Group, Loader, Popover, Text, UnstyledButton } from '@mantine/core';
import { keyPredicate, selectAndExpand, type FieldModel, type Row, type ValueRef } from '@rhfan2019/smart-kit-core';

type ContactModel = NonNullable<FieldModel['contact']>;
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState, type ReactNode } from 'react';
import { useService, useText } from '../context/SmartKitProvider';
import { resolveRef } from './values';

const text = (row: Row | undefined, ref: ValueRef | undefined) => {
  const v = resolveRef(row, ref);
  return v === null || v === undefined || v === '' ? undefined : String(v);
};

export function ContactLink({ typeName, field, row, service: serviceName }: { typeName: string; field: FieldModel; row: Row | undefined; service?: string }) {
  const service = useService(serviceName);
  const t = useText();
  const [opened, setOpened] = useState(false);
  const contact: ContactModel = field.contact ?? {};
  const model = service.model;
  const name = text(row, contact.fn);
  // the row's own entity: details missing in the row are read by its key
  const target = useMemo(() => {
    const set = Object.values(model.entitySets).find((es) => es.typeName === typeName);
    const type = model.entityTypes[typeName];
    if (!set || !type || !row || type.keys.some((k) => row[k] === undefined)) return undefined;
    try {
      return `${set.name}${keyPredicate(type, row)}`;
    } catch {
      return undefined;
    }
  }, [model, typeName, row]);
  const paths = Object.values(contact).flatMap((r) => (r && 'path' in r ? [(r as { path: string }).path] : []));
  const missing = paths.some((p) => resolveRef(row, { path: p }) === undefined);
  const q = useQuery({
    queryKey: ['smart-kit', 'contact', service.name, target, paths.join(',')],
    queryFn: ({ signal }) => service.dataProvider.read(target!, selectAndExpand(model, typeName, paths), { signal }),
    enabled: opened && missing && Boolean(target),
    staleTime: 60_000,
  });
  if (!name) return null;
  const data: Row | undefined = missing ? (q.data ? { ...row, ...q.data } : undefined) : row;
  const email = text(data, contact.email);
  const tel = text(data, contact.tel);
  const pairs: [string, ReactNode][] = [];
  const title = text(data, contact.title);
  const org = text(data, contact.org);
  if (title) pairs.push([t('contact.jobTitle'), title]);
  if (org) pairs.push([t('contact.department'), org]);
  if (tel) pairs.push([t('contact.phone'), <a key="tel" className="sk-link" href={`tel:${tel}`}>{tel}</a>]);
  if (email) pairs.push([t('contact.email'), <a key="mail" className="sk-link" href={`mailto:${email}`}>{email}</a>]);
  return (
    <Popover opened={opened} onChange={setOpened} width={300} position="bottom-start" withArrow trapFocus returnFocus>
      <Popover.Target>
        <UnstyledButton className="sk-link sk-quickview__link" onClick={(e) => { e.stopPropagation(); setOpened((o) => !o); }} aria-haspopup="dialog" aria-expanded={opened} data-sk-contact-link>
          {name}
        </UnstyledButton>
      </Popover.Target>
      <Popover.Dropdown role="dialog" aria-label={name} data-sk-contact onClick={(e) => e.stopPropagation()}>
        {!data ? <Loader size="sm" /> : (
          <div className="sk-quickview">
            <Group gap="sm" wrap="nowrap" mb="sm">
              <div>
                <Text fw={600} data-sk-contact-name>{name}</Text>
                {text(data, contact.role) ? <Text size="sm" c="dimmed">{text(data, contact.role)}</Text> : null}
              </div>
            </Group>
            <dl className="sk-quickview__group">
              {pairs.map(([label, value]) => (
                <div key={label} className="sk-facet__pair">
                  <dt>{label}:</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}
      </Popover.Dropdown>
    </Popover>
  );
}
