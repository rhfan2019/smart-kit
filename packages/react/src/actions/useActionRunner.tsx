/**
 * Runs UI.DataFieldForAction actions (ADR-024): availability from Core.OperationAvailable, partial processing
 * (LR Partial Processing), parameter dialog, messages of the responses.
 */
import { Button, Group, Modal, Stack, Text, TextInput } from '@mantine/core';
import { messagesFromError, type ActionModel, type Message, type Row } from '@rhfan2019/smart-kit-core';
import { useState, type ReactNode } from 'react';
import { useService, useText } from '../context/SmartKitProvider';
import { getPath } from '../field/values';
import { useMessages } from '../messages/MessageContext';

/** Whether an action can be applied to a row (Core.OperationAvailable; missing means available). */
export function isActionAvailable(action: ActionModel, row: Row | undefined): boolean {
  const a = action.operationAvailable;
  if (!a) return true;
  if ('value' in a) return a.value !== false && a.value !== 'false';
  const v = getPath(row, a.path);
  return v === true || v === 'true';
}

/** Paths an action needs in $select to decide its availability. */
export function actionPaths(actions: ActionModel[]): string[] {
  return actions.flatMap((a) => (a.operationAvailable && 'path' in a.operationAvailable ? [a.operationAvailable.path] : []));
}

export interface ActionTarget {
  row: Row;
  path: string;
  /** Short identifier shown in the partial processing dialog. */
  label: string;
}

export interface ActionResult {
  action: ActionModel;
  processed: { target: ActionTarget; row?: Row }[];
  failed: { target: ActionTarget; messages: Message[] }[];
  messages: Message[];
}

export interface ActionRunner {
  run(action: ActionModel, targets: ActionTarget[]): void;
  busy: boolean;
  /** Dialogs (partial processing, parameters); render once. */
  dialogs: ReactNode;
}

export function useActionRunner(o: { service?: string; onDone?(r: ActionResult): void }): ActionRunner {
  const service = useService(o.service);
  const t = useText();
  const messages = useMessages();
  const [busy, setBusy] = useState(false);
  const [partial, setPartial] = useState<{ action: ActionModel; ok: ActionTarget[]; skipped: ActionTarget[] } | null>(null);
  const [params, setParams] = useState<{ action: ActionModel; targets: ActionTarget[]; values: Record<string, string> } | null>(null);

  const execute = async (action: ActionModel, targets: ActionTarget[], parameters: Row) => {
    const provider = service.dataProvider;
    if (!provider.invoke) return;
    setBusy(true);
    const result: ActionResult = { action, processed: [], failed: [], messages: [] };
    try {
      for (const target of action.bound ? targets : [targets[0]!]) {
        try {
          const r = await provider.invoke(action.action, { path: action.bound ? target.path : undefined, parameters });
          result.processed.push({ target, row: r.row });
          result.messages.push(...(r.messages ?? []));
        } catch (e) {
          // Failures discovered only while executing are reported afterwards (LR Partial Processing, note).
          const m = messagesFromError(e);
          result.failed.push({ target, messages: m });
          result.messages.push(...m);
        }
      }
    } finally {
      setBusy(false);
    }
    messages?.add(result.messages);
    o.onDone?.(result);
  };

  const withParameters = (action: ActionModel, targets: ActionTarget[]) => {
    if (action.parameters.length) setParams({ action, targets, values: Object.fromEntries(action.parameters.map((p) => [p.name, ''])) });
    else void execute(action, targets, {});
  };

  const run = (action: ActionModel, targets: ActionTarget[]) => {
    const ok = targets.filter((x) => isActionAvailable(action, x.row));
    const skipped = targets.filter((x) => !isActionAvailable(action, x.row));
    if (!ok.length) return;
    if (skipped.length) setPartial({ action, ok, skipped });
    else withParameters(action, ok);
  };

  const dialogs = (
    <>
      <Modal opened={Boolean(partial)} onClose={() => setPartial(null)} title={partial?.action.label} data-sk-partial-dialog>
        {partial ? (
          <Stack>
            <Text data-sk-partial-count>{t('actions.partial', { count: partial.skipped.length, total: partial.ok.length + partial.skipped.length })}</Text>
            <Text size="sm" c="dimmed" data-sk-partial-reason>{t('actions.partialReason', { action: partial.action.label, items: partial.skipped.map((x) => x.label).join(', ') })}</Text>
            <Text size="sm">{t('actions.partialQuestion', { count: partial.ok.length })}</Text>
            <Group justify="flex-end">
              <Button onClick={() => { const p = partial; setPartial(null); withParameters(p.action, p.ok); }} data-sk-partial-continue>{t('actions.continue')}</Button>
              <Button variant="default" onClick={() => setPartial(null)} data-sk-partial-cancel>{t('common.cancel')}</Button>
            </Group>
          </Stack>
        ) : null}
      </Modal>
      <Modal opened={Boolean(params)} onClose={() => setParams(null)} title={params?.action.label}>
        {params ? (
          <form onSubmit={(e) => { e.preventDefault(); const p = params; setParams(null); void execute(p.action, p.targets, p.values); }}>
            <Stack>
              {params.action.parameters.map((p) => (
                <TextInput key={p.name} label={p.label} required={!p.nullable} value={params.values[p.name] ?? ''} onChange={(e) => { const v = e.currentTarget.value; setParams((s) => (s ? { ...s, values: { ...s.values, [p.name]: v } } : s)); }} />
              ))}
              <Group justify="flex-end">
                <Button type="submit">{params.action.label}</Button>
                <Button variant="default" onClick={() => setParams(null)}>{t('common.cancel')}</Button>
              </Group>
            </Stack>
          </form>
        ) : null}
      </Modal>
    </>
  );
  return { run, busy, dialogs };
}
