/** Page variant management: select, save, save as, manage (LR-02). */
import { ActionIcon, Badge, Button, Checkbox, Group, Menu, Modal, Radio, Stack, Table, Text, TextInput, UnstyledButton } from '@mantine/core';
import { STANDARD_VARIANT_ID, type VariantContent } from '@rhfan2019/smart-kit-core';
import { Check, ChevronDown, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useText } from '../context/SmartKitProvider';
import type { VariantsApi } from './useVariants';

export interface SmartVariantManagementProps {
  variants: VariantsApi;
  /** Current page content, used for "Modified" and saving. */
  content: VariantContent;
  /** Called after a variant was selected; apply its content (and execute when autoApply). */
  onApply(v: { content: VariantContent; autoApply: boolean }): void;
  /** Shown instead of "Standard" for the standard variant. */
  standardName?: string;
  /** Offer "Apply Automatically" (default true). The list report guideline offers it only in manual update mode. */
  autoApplyOption?: boolean;
}

export function SmartVariantManagement(p: SmartVariantManagementProps) {
  const t = useText();
  const v = p.variants;
  const [saveAs, setSaveAs] = useState(false);
  const [manage, setManage] = useState(false);
  const modified = v.isModified(p.content);
  const nameOf = (id: string, name: string) => (id === STANDARD_VARIANT_ID ? p.standardName ?? t('variant.standard') : name);
  const all = [{ id: STANDARD_VARIANT_ID, name: '', isDefault: !v.variants.some((x) => x.isDefault), autoApply: true }, ...v.variants];
  return (
    <>
      <Group gap="xs" wrap="nowrap" className="sk-variant">
        <Menu position="bottom-start" width={280}>
          <Menu.Target>
            <UnstyledButton className="sk-variant__button" title={t('variant.select')} data-sk-variant>
              <h1 className="sk-dynamic-page__heading">{nameOf(v.current.id, v.current.name)}</h1>
              <ChevronDown className="sk-icon" />
            </UnstyledButton>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Label>{t('variant.myViews')}</Menu.Label>
            {all.map((x) => (
              <Menu.Item key={x.id || 'standard'} leftSection={x.id === v.currentId ? <Check className="sk-icon" /> : <span className="sk-icon" />} onClick={() => { const sel = v.select(x.id); p.onApply({ content: sel.content, autoApply: sel.autoApply }); }} data-sk-variant-item={nameOf(x.id, x.name)}>
                {nameOf(x.id, x.name)}{x.isDefault ? <Text span size="xs" c="dimmed"> · {t('variant.default')}</Text> : null}
              </Menu.Item>
            ))}
            <Menu.Divider />
            <Group gap="xs" justify="flex-end" className="sk-variant__menu-actions">
              {v.currentId !== STANDARD_VARIANT_ID ? <Button size="xs" variant="subtle" disabled={!modified} onClick={() => void v.save(p.content)} data-sk-variant-save>{t('variant.save')}</Button> : null}
              <Button size="xs" variant="subtle" onClick={() => setSaveAs(true)} data-sk-variant-saveas>{t('variant.saveAs')}</Button>
              <Button size="xs" variant="subtle" onClick={() => setManage(true)} data-sk-variant-manage>{t('variant.manage')}</Button>
            </Group>
          </Menu.Dropdown>
        </Menu>
        {modified ? <Badge variant="light" color="gray" data-sk-variant-modified>{t('variant.modified')}</Badge> : null}
      </Group>
      <SaveAsDialog opened={saveAs} autoApplyOption={p.autoApplyOption !== false} existing={v.variants.map((x) => x.name)} onCancel={() => setSaveAs(false)} onOk={async (name, isDefault, autoApply) => { await v.saveAs(name, p.content, { isDefault, autoApply }); setSaveAs(false); }} />
      <ManageDialog opened={manage} autoApplyOption={p.autoApplyOption !== false} api={v} standardName={nameOf(STANDARD_VARIANT_ID, '')} onClose={() => setManage(false)} />
    </>
  );
}

function SaveAsDialog(p: { opened: boolean; autoApplyOption: boolean; existing: string[]; onOk(name: string, isDefault: boolean, autoApply: boolean): Promise<void>; onCancel(): void }) {
  const t = useText();
  const [name, setName] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [autoApply, setAutoApply] = useState(true);
  const [error, setError] = useState<string | undefined>();
  const submit = async () => {
    const n = name.trim();
    if (!n) return setError(t('variant.nameRequired'));
    if (p.existing.includes(n)) return setError(t('variant.nameExists'));
    await p.onOk(n, isDefault, autoApply);
    setName(''); setIsDefault(false); setAutoApply(true); setError(undefined);
  };
  return (
    <Modal opened={p.opened} onClose={p.onCancel} title={t('variant.saveAs')}>
      <form onSubmit={(e) => { e.preventDefault(); void submit(); }}>
        <Stack gap="sm">
          <TextInput label={t('variant.name')} value={name} onChange={(e) => { setName(e.currentTarget.value); setError(undefined); }} error={error} data-autofocus required />
          <Checkbox label={t('variant.setDefault')} checked={isDefault} onChange={(e) => setIsDefault(e.currentTarget.checked)} />
          {p.autoApplyOption ? <Checkbox label={t('variant.autoApply')} checked={autoApply} onChange={(e) => setAutoApply(e.currentTarget.checked)} /> : null}
        </Stack>
        <Group justify="flex-end" className="sk-dialog-footer">
          <Button type="submit" data-sk-variant-saveas-ok>{t('variant.save')}</Button>
          <Button variant="default" onClick={p.onCancel}>{t('common.cancel')}</Button>
        </Group>
      </form>
    </Modal>
  );
}

function ManageDialog(p: { opened: boolean; autoApplyOption: boolean; api: VariantsApi; standardName: string; onClose(): void }) {
  const t = useText();
  const v = p.api;
  const defaultId = v.variants.find((x) => x.isDefault)?.id ?? STANDARD_VARIANT_ID;
  return (
    <Modal opened={p.opened} onClose={p.onClose} title={t('variant.manage')} size="lg">
      <Table>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>{t('variant.name')}</Table.Th>
            <Table.Th>{t('variant.default')}</Table.Th>
            {p.autoApplyOption ? <Table.Th>{t('variant.autoApply')}</Table.Th> : null}
            <Table.Th />
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          <Table.Tr>
            <Table.Td>{p.standardName}</Table.Td>
            <Table.Td><Radio checked={defaultId === STANDARD_VARIANT_ID} onChange={() => void v.setDefault(STANDARD_VARIANT_ID)} aria-label={t('variant.setDefault')} /></Table.Td>
            {p.autoApplyOption ? <Table.Td /> : null}
            <Table.Td />
          </Table.Tr>
          {v.variants.map((x) => (
            <Table.Tr key={x.id} data-sk-variant-row={x.name}>
              <Table.Td>
                <TextInput size="xs" defaultValue={x.name} aria-label={t('variant.name')} onBlur={(e) => { const n = e.currentTarget.value.trim(); if (n && n !== x.name) void v.update({ ...x, name: n }); }} />
              </Table.Td>
              <Table.Td><Radio checked={defaultId === x.id} onChange={() => void v.setDefault(x.id)} aria-label={t('variant.setDefault')} /></Table.Td>
              {p.autoApplyOption ? <Table.Td><Checkbox checked={x.autoApply} onChange={(e) => void v.update({ ...x, autoApply: e.currentTarget.checked })} aria-label={t('variant.autoApply')} /></Table.Td> : null}
              <Table.Td><ActionIcon onClick={() => void v.remove(x.id)} aria-label={t('variant.delete')}><Trash2 className="sk-icon" /></ActionIcon></Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
      <Group justify="flex-end" className="sk-dialog-footer">
        <Button onClick={p.onClose}>{t('common.close')}</Button>
      </Group>
    </Modal>
  );
}
