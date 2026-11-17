/** Page variant management: select, save, save as, manage (LR-02). */
import { ActionIcon, Alert, Badge, Button, Checkbox, Group, Menu, Modal, Radio, Stack, Table, Text, TextInput, UnstyledButton } from '@mantine/core';
import { STANDARD_VARIANT_ID, type VariantContent } from '@rhfan2019/smart-kit-core';
import { Check, ChevronDown, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useText } from '../context/SmartKitProvider';
import type { VariantsApi } from './useVariants';

export interface SmartVariantManagementProps {
  /** Result of `useVariants(...)`. */
  variants: VariantsApi;
  /** Current page content, used for "Modified" and saving. */
  content: VariantContent;
  /** Called after a variant was selected; apply its content (and execute when autoApply). */
  onApply(v: { content: VariantContent; autoApply: boolean }): void;
  /** Shown instead of "Standard" for the standard variant. */
  standardName?: string;
  /** Offer "Apply Automatically" (default true). The list report guideline offers it only in manual update mode. */
  autoApplyOption?: boolean;
  /**
   * Whether views may be saved (default: `VariantStore.canSave`, else true). When false the menu only selects views:
   * no Save, Save As or Manage.
   */
  canSave?: boolean;
}

/** Text of an error thrown by the VariantStore (shown to the user). */
const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));

export function SmartVariantManagement(p: SmartVariantManagementProps) {
  const t = useText();
  const v = p.variants;
  const [saveAs, setSaveAs] = useState(false);
  const [manage, setManage] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [saveError, setSaveError] = useState<string | undefined>();
  const canSave = p.canSave ?? v.canSave;
  // Dialogs open after the menu closed, so the menu never floats above the dialog overlay (S18).
  const openDialog = (open: (o: boolean) => void) => { setMenuOpen(false); setSaveError(undefined); open(true); };
  const saveNow = async () => {
    setMenuOpen(false);
    setSaveError(undefined);
    try { await v.save(p.content); } catch (e) { setSaveError(errorText(e)); }
  };
  const modified = v.isModified(p.content);
  const nameOf = (id: string, name: string) => (id === STANDARD_VARIANT_ID ? p.standardName ?? t('variant.standard') : name);
  const all = [{ id: STANDARD_VARIANT_ID, name: '', isDefault: !v.variants.some((x) => x.isDefault), autoApply: true }, ...v.variants];
  return (
    <>
      <Group gap="xs" wrap="nowrap" className="sk-variant">
        <Menu position="bottom-start" width={280} opened={menuOpen} onChange={setMenuOpen}>
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
            {canSave ? (
              <>
                <Menu.Divider />
                <Group gap="xs" justify="flex-end" className="sk-variant__menu-actions">
                  {v.currentId !== STANDARD_VARIANT_ID ? <Button size="xs" variant="subtle" disabled={!modified} onClick={() => void saveNow()} data-sk-variant-save>{t('variant.save')}</Button> : null}
                  <Button size="xs" variant="subtle" onClick={() => openDialog(setSaveAs)} data-sk-variant-saveas>{t('variant.saveAs')}</Button>
                  <Button size="xs" variant="subtle" onClick={() => openDialog(setManage)} data-sk-variant-manage>{t('variant.manage')}</Button>
                </Group>
              </>
            ) : null}
          </Menu.Dropdown>
        </Menu>
        {modified && canSave ? <Badge variant="light" color="gray" data-sk-variant-modified>{t('variant.modified')}</Badge> : null}
      </Group>
      {saveError ? <Alert color="red" variant="light" role="alert" withCloseButton closeButtonLabel={t('common.close')} onClose={() => setSaveError(undefined)} className="sk-variant__error" data-sk-variant-error>{t('variant.saveFailed', { message: saveError })}</Alert> : null}
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
  const [failed, setFailed] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    const n = name.trim();
    if (!n) return setError(t('variant.nameRequired'));
    if (p.existing.includes(n)) return setError(t('variant.nameExists'));
    setBusy(true);
    setFailed(undefined);
    try {
      await p.onOk(n, isDefault, autoApply);
    } catch (e) {
      // The dialog stays open with the host's error text (S15).
      setFailed(errorText(e));
      return;
    } finally {
      setBusy(false);
    }
    setName(''); setIsDefault(false); setAutoApply(true); setError(undefined);
  };
  const cancel = () => { setFailed(undefined); p.onCancel(); };
  return (
    <Modal opened={p.opened} onClose={cancel} title={t('variant.saveAs')}>
      <form onSubmit={(e) => { e.preventDefault(); void submit(); }}>
        <Stack gap="sm">
          {failed ? <Alert color="red" variant="light" role="alert" data-sk-variant-error>{t('variant.saveFailed', { message: failed })}</Alert> : null}
          <TextInput label={t('variant.name')} value={name} onChange={(e) => { setName(e.currentTarget.value); setError(undefined); }} error={error} data-autofocus required />
          <Checkbox label={t('variant.setDefault')} checked={isDefault} onChange={(e) => setIsDefault(e.currentTarget.checked)} />
          {p.autoApplyOption ? <Checkbox label={t('variant.autoApply')} checked={autoApply} onChange={(e) => setAutoApply(e.currentTarget.checked)} /> : null}
        </Stack>
        <Group justify="flex-end" className="sk-dialog-footer">
          <Button type="submit" loading={busy} data-sk-variant-saveas-ok>{t('variant.save')}</Button>
          <Button variant="default" onClick={cancel}>{t('common.cancel')}</Button>
        </Group>
      </form>
    </Modal>
  );
}

function ManageDialog(p: { opened: boolean; autoApplyOption: boolean; api: VariantsApi; standardName: string; onClose(): void }) {
  const t = useText();
  const v = p.api;
  const defaultId = v.variants.find((x) => x.isDefault)?.id ?? STANDARD_VARIANT_ID;
  const [failed, setFailed] = useState<string | undefined>();
  const run = (op: () => Promise<void>) => { setFailed(undefined); op().catch((e: unknown) => setFailed(errorText(e))); };
  const close = () => { setFailed(undefined); p.onClose(); };
  return (
    <Modal opened={p.opened} onClose={close} title={t('variant.manage')} size="lg">
      {failed ? <Alert color="red" variant="light" role="alert" data-sk-variant-error>{t('variant.saveFailed', { message: failed })}</Alert> : null}
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
            <Table.Td><Radio checked={defaultId === STANDARD_VARIANT_ID} onChange={() => run(() => v.setDefault(STANDARD_VARIANT_ID))} aria-label={t('variant.setDefault')} /></Table.Td>
            {p.autoApplyOption ? <Table.Td /> : null}
            <Table.Td />
          </Table.Tr>
          {v.variants.map((x) => (
            <Table.Tr key={x.id} data-sk-variant-row={x.name}>
              <Table.Td>
                <TextInput size="xs" defaultValue={x.name} aria-label={t('variant.name')} onBlur={(e) => { const n = e.currentTarget.value.trim(); if (n && n !== x.name) run(() => v.update({ ...x, name: n })); }} />
              </Table.Td>
              <Table.Td><Radio checked={defaultId === x.id} onChange={() => run(() => v.setDefault(x.id))} aria-label={t('variant.setDefault')} /></Table.Td>
              {p.autoApplyOption ? <Table.Td><Checkbox checked={x.autoApply} onChange={(e) => { const autoApply = e.currentTarget.checked; run(() => v.update({ ...x, autoApply })); }} aria-label={t('variant.autoApply')} /></Table.Td> : null}
              <Table.Td><ActionIcon onClick={() => run(() => v.remove(x.id))} aria-label={t('variant.delete')}><Trash2 className="sk-icon" /></ActionIcon></Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
      <Group justify="flex-end" className="sk-dialog-footer">
        <Button onClick={close}>{t('common.close')}</Button>
      </Group>
    </Modal>
  );
}
