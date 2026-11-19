/**
 * Runs UI.DataFieldForAction actions (ADR-024): availability from Core.OperationAvailable, partial processing
 * (LR Partial Processing), parameter dialog, messages of the responses.
 *
 * Parameter dialog (FE sap.fe.macros.coreUI.OperationParameterDialog): one field per shown parameter, in parameter
 * order, with the field editor of its Edm type and annotations (fixed values: a selection, value list: a value help,
 * UI.MultiLineText: a text area, dates, numbers, booleans); defaults from UI.ParameterDefaultValue (a path is read from
 * the selected rows), overruled by the manifest's defaultValuesFunction; Common.FieldControl Mandatory parameters are
 * checked before the action runs; the request body carries typed values (core actionParameterBody).
 */
import { Button, Group, Modal, Stack, Text, TextInput } from '@mantine/core';
import {
  actionParameterBody, actionParameterDefaults, actionParameterErrors, actionParameterState, messagesFromError, skipsParameterDialog,
  type ActionModel, type Message, type Row,
} from '@rhfan2019/smart-kit-core';
import { useState, type ReactNode } from 'react';
import { useService, useText } from '../context/SmartKitProvider';
import { FieldEditor } from '../field/FieldEditor';
import { useMessages } from '../messages/MessageContext';

import { isActionAvailable } from './availability';

export { actionPaths, isActionAvailable } from './availability';

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

/** Options of one run (FE invokeAction parameters of a manifest-configured annotation action). */
export interface ActionRunOptions {
  /** Default values of the parameter dialog by parameter name (FE `defaultValuesFunction`); they win over the others. */
  defaultValues?(): Row | Promise<Row>;
  /** Called after this run, before the runner's own `onDone`. */
  onDone?(r: ActionResult): void;
}

export interface ActionRunner {
  run(action: ActionModel, targets: ActionTarget[], options?: ActionRunOptions): void;
  busy: boolean;
  /** Dialogs (partial processing, parameters); render once. */
  dialogs: ReactNode;
}

/** Common.IsActionCritical: a constant, or a path of the bound entity (FE ActionHelper getIsActionCriticalExpression: `equal(x, true)`). */
export function isCritical(action: ActionModel, row: Row | undefined): boolean {
  const c = action.critical;
  if (!c) return false;
  return ('path' in c ? row?.[c.path] : c.value) === true;
}

export function useActionRunner(o: { service?: string; onDone?(r: ActionResult): void }): ActionRunner {
  const service = useService(o.service);
  const t = useText();
  const messages = useMessages();
  const [busy, setBusy] = useState(false);
  const [partial, setPartial] = useState<{ action: ActionModel; ok: ActionTarget[]; skipped: ActionTarget[]; options?: ActionRunOptions } | null>(null);
  const [params, setParams] = useState<{ action: ActionModel; targets: ActionTarget[]; values: Row; errors: Record<string, string>; options?: ActionRunOptions } | null>(null);

  const execute = async (action: ActionModel, targets: ActionTarget[], parameters: Row, options?: ActionRunOptions) => {
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
    options?.onDone?.(result);
    o.onDone?.(result);
  };

  const [confirm, setConfirm] = useState<{ action: ActionModel; targets: ActionTarget[]; parameters: Row; options?: ActionRunOptions } | null>(null);
  const withParameters = (action: ActionModel, targets: ActionTarget[], options?: ActionRunOptions) => {
    if (action.parameters.length && !skipsParameterDialog(action)) {
      // FE OperationParameterDialog setOperationDefaultValues: UI.ParameterDefaultValue (paths read from the selected
      // rows), overruled by the manifest extension function's values (getManifestFunctionValues)
      const values: Row = actionParameterDefaults(action, action.bound ? targets.map((x) => x.row) : []);
      const open = () => setParams({ action, targets, values, errors: {}, options });
      if (options?.defaultValues) {
        void Promise.resolve(options.defaultValues()).then((d) => {
          for (const p of action.parameters) if (d?.[p.name] !== undefined && d[p.name] !== null) values[p.name] = d[p.name];
          open();
        }, open);
      } else open();
      return;
    }
    // every parameter hidden (FE OperationParameters skipParametersDialog): the constant default values, no dialog
    const parameters = action.parameters.length ? actionParameterBody(action, actionParameterDefaults(action, [], { constantsOnly: true })) : {};
    // Common.IsActionCritical without a parameter dialog: confirm first (FE Operation confirmAction; a path is read
    // from the first context).
    if (isCritical(action, targets[0]?.row)) setConfirm({ action, targets, parameters, options });
    else void execute(action, targets, parameters, options);
  };

  const setParameter = (name: string, value: unknown) =>
    setParams((s) => (s ? { ...s, values: { ...s.values, [name]: value }, errors: { ...s.errors, [name]: '' } } : s));
  // FE ActionParameterDialog onApply / ActionRuntime validateProperties: mandatory and type checks block the action
  const submit = () => {
    const p = params;
    if (!p) return;
    const errors = actionParameterErrors(p.action, p.values, p.targets[0]?.row);
    if (errors.length) {
      const label = (name: string) => p.action.parameters.find((x) => x.name === name)?.label ?? name;
      setParams({ ...p, errors: Object.fromEntries(errors.map((e) => [e.name, t(e.kind === 'missing' ? 'actions.parameterMissing' : 'edit.invalidNumber', { field: label(e.name) })])) });
      return;
    }
    setParams(null);
    void execute(p.action, p.targets, actionParameterBody(p.action, p.values), p.options);
  };

  const run = (action: ActionModel, targets: ActionTarget[], options?: ActionRunOptions) => {
    const ok = targets.filter((x) => isActionAvailable(action, x.row));
    const skipped = targets.filter((x) => !isActionAvailable(action, x.row));
    if (!ok.length) return;
    if (skipped.length) setPartial({ action, ok, skipped, options });
    else withParameters(action, ok, options);
  };

  const dialogs = (
    <>
      <Modal opened={Boolean(confirm)} onClose={() => setConfirm(null)} title={t('actions.confirmTitle')} data-sk-action-confirm>
        <Stack>
          <Text>{t('actions.criticalConfirm')}</Text>
          <Group justify="flex-end">
            <Button onClick={() => { const c = confirm; setConfirm(null); if (c) void execute(c.action, c.targets, c.parameters, c.options); }} data-sk-action-confirm-ok>{t('common.ok')}</Button>
            <Button variant="default" onClick={() => setConfirm(null)}>{t('common.cancel')}</Button>
          </Group>
        </Stack>
      </Modal>
      <Modal opened={Boolean(partial)} onClose={() => setPartial(null)} title={partial?.action.label} data-sk-partial-dialog>
        {partial ? (
          <Stack>
            <Text data-sk-partial-count>{t('actions.partial', { count: partial.skipped.length, total: partial.ok.length + partial.skipped.length })}</Text>
            <Text size="sm" c="dimmed" data-sk-partial-reason>{t('actions.partialReason', { action: partial.action.label, items: partial.skipped.map((x) => x.label).join(', ') })}</Text>
            <Text size="sm">{t('actions.partialQuestion', { count: partial.ok.length })}</Text>
            <Group justify="flex-end">
              <Button onClick={() => { const p = partial; setPartial(null); withParameters(p.action, p.ok, p.options); }} data-sk-partial-continue>{t('actions.continue')}</Button>
              <Button variant="default" onClick={() => setPartial(null)} data-sk-partial-cancel>{t('common.cancel')}</Button>
            </Group>
          </Stack>
        ) : null}
      </Modal>
      <Modal opened={Boolean(params)} onClose={() => setParams(null)} title={params?.action.label}>
        {params ? (
          <form noValidate onSubmit={(e) => { e.preventDefault(); submit(); }} data-sk-action-parameter-dialog={params.action.action}>
            <Stack>
              {params.action.parameters.map((p) => {
                const state = actionParameterState(p, params.targets[0]?.row);
                if (state.hidden) return null;
                const value = params.values[p.name];
                // text editors report every keystroke, so that Enter submits what was typed; value helps commit a key
                const valueHelp = Boolean(p.property?.valueList || p.property?.valueListReferences?.length);
                return (
                  <div key={p.name} data-sk-action-parameter={p.name}>
                    {state.readOnly ? (
                      <TextInput label={p.label} value={value === undefined || value === null ? '' : String(value)} readOnly variant="unstyled" data-sk-editor="display" />
                    ) : (
                      <FieldEditor
                        property={p.property} value={value} label={p.label} showLabel required={state.required} disabled={state.disabled}
                        error={params.errors[p.name] || undefined} service={o.service}
                        onChange={(v) => setParameter(p.name, v)} onLiveChange={valueHelp ? undefined : (v) => setParameter(p.name, v)}
                      />
                    )}
                  </div>
                );
              })}
              <Group justify="flex-end">
                <Button type="submit" data-sk-action-parameter-ok>{params.action.label}</Button>
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
