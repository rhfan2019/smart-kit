/** Value help dialog: "Search and Select" from the value list and "Define Conditions" (include / exclude) (LR-11). */
import { ActionIcon, Button, Checkbox, Group, Modal, Pill, ScrollArea, SegmentedControl, Select, Stack, Table, Tabs, Text, TextInput } from '@mantine/core';
import {
  filterExpressionRules, getProperty, isComplete, OPERATOR_ARITY, OPERATORS, RELATIVE_DATE_OPERATORS, restrictConditions, valueListTextArrangement,
  type Condition, type Operator, type PropertyModel,
} from '@rhfan2019/smart-kit-core';
import { Plus, Search, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useService, useSmartKit, useText } from '../context/SmartKitProvider';
import { getPath } from '../field/values';
import { conditionText, sameCondition } from './conditionText';
import { useValueList } from './useValueList';

export interface ValueHelpDialogProps {
  /** Whether the dialog is open (controlled). */
  opened: boolean;
  /** Entity set of the filtered (or edited) property. */
  entitySet: string;
  /** Property with a `Common.ValueList` annotation, e.g. "Owner". */
  path: string;
  /** Name of the service in `SmartKitProvider` `services`; default: the provider's `defaultService`. */
  service?: string;
  /** Dialog title, usually the property label. */
  title: string;
  /** Current conditions (pre-selected in the dialog). */
  conditions: Condition[];
  /** Called with the chosen conditions (selected values as "EQ" conditions, plus the defined conditions). */
  onOk(conditions: Condition[]): void;
  /** Called when the user cancels or closes the dialog. */
  onCancel(): void;
}

const STRING_OPS: Operator[] = ['EQ', 'NE', 'Contains', 'NotContains', 'StartsWith', 'EndsWith', 'BT', 'NB', 'LT', 'LE', 'GT', 'GE', 'Empty', 'NotEmpty'];
const OTHER_OPS: Operator[] = OPERATORS.filter((o) => !['Contains', 'NotContains', 'StartsWith', 'EndsWith'].includes(o));
/** Date and date-time properties also get the relative dates (today, this month, last X days …). */
const DATE_OPS: Operator[] = [...OTHER_OPS, ...RELATIVE_DATE_OPERATORS];
const isDate = (p: PropertyModel | undefined) => p?.edmType === 'Edm.Date' || p?.edmType === 'Edm.DateTimeOffset';

const PAGE = 50;

export function ValueHelpDialog(p: ValueHelpDialogProps) {
  const t = useText();
  const service = useService(p.service);
  const { intlLocale, timeZone } = useSmartKit();
  const typeName = service.model.entitySets[p.entitySet]!.typeName;
  const prop = getProperty(service.model, typeName, p.path);
  const vl = prop?.valueList;
  // Capabilities.FilterExpressionRestrictions (P2-LR-19): allowed operators, exclusions and number of conditions.
  const expression = service.model.entitySets[p.entitySet]!.capabilities.filterExpressions[p.path];
  const rules = filterExpressionRules(expression);
  const canSelect = Boolean(vl) && rules.operators.includes('EQ');
  const [selected, setSelected] = useState<Condition[]>(p.conditions);
  const [draft, setDraft] = useState('');
  const [search, setSearch] = useState('');
  const [top, setTop] = useState(PAGE);
  const [tab, setTab] = useState<string | null>(canSelect ? 'select' : 'conditions');

  useEffect(() => {
    if (p.opened) {
      setSelected(p.conditions);
      setDraft('');
      setSearch('');
      setTop(PAGE);
      setTab(canSelect ? 'select' : 'conditions');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when (re)opened
  }, [p.opened]);

  const list = useValueList(vl, { search, top, enabled: p.opened && Boolean(vl) }, p.service);
  const vlType = vl ? service.model.entitySets[vl.collectionPath]?.typeName : undefined;
  const columns = useMemo(
    () => (vl ? vl.parameters.filter((x) => x.kind !== 'Constant').map((x) => ({ path: x.valueListProperty, label: (vlType && getProperty(service.model, vlType, x.valueListProperty)?.label) || x.valueListProperty })) : []),
    [vl, vlType, service.model],
  );
  const keyOf = (row: Record<string, unknown>) => String(getPath(row, vl!.keyProperty) ?? '');
  const isSelected = (key: string) => selected.some((c) => c.operator === 'EQ' && !c.exclude && String(c.values[0]) === key);
  const toggle = (row: Record<string, unknown>) => {
    const key = keyOf(row);
    if (isSelected(key)) setSelected(selected.filter((c) => !(c.operator === 'EQ' && !c.exclude && String(c.values[0]) === key)));
    else {
      const text = vl!.descriptionProperty ? getPath(row, vl!.descriptionProperty) : undefined;
      setSelected(restrictConditions(expression, [...selected, { operator: 'EQ', values: [key], text: text ? String(text) : undefined }]));
    }
  };

  const conditionRows = selected.map((c, i) => ({ c, i })).filter(({ c }) => !(c.operator === 'EQ' && !c.exclude && c.text !== undefined));
  const updateCondition = (i: number, next: Condition) => setSelected(selected.map((c, j) => (j === i ? next : c)));
  const ops = (prop?.edmType === 'Edm.String' ? STRING_OPS : isDate(prop) ? DATE_OPS : OTHER_OPS).filter((o) => rules.operators.includes(o));
  const arrangement = valueListTextArrangement(service.model, prop);
  const count = list.data?.count;

  return (
    <Modal opened={p.opened} onClose={p.onCancel} title={p.title} size="xl" classNames={{ body: 'sk-vh' }}>
      <Tabs value={tab} onChange={setTab} keepMounted={false}>
        <Tabs.List>
          {canSelect ? <Tabs.Tab value="select">{t('vh.searchAndSelect')}</Tabs.Tab> : null}
          <Tabs.Tab value="conditions">{t('vh.defineConditions')}</Tabs.Tab>
        </Tabs.List>
        {canSelect ? (
          <Tabs.Panel value="select" className="sk-vh__panel">
            <form onSubmit={(e) => { e.preventDefault(); setSearch(draft); setTop(PAGE); }}>
              <Group gap="xs" className="sk-vh__search">
                <TextInput value={draft} onChange={(e) => setDraft(e.currentTarget.value)} placeholder={t('filterBar.search')} aria-label={t('filterBar.search')} leftSection={<Search className="sk-icon" />} className="sk-grow" data-autofocus />
                <Button type="submit" variant="default">{t('filterBar.go')}</Button>
              </Group>
            </form>
            <Text size="sm" fw={600} className="sk-vh__count">{t('vh.items', { count: count ?? list.data?.rows.length ?? 0 })}</Text>
            <ScrollArea.Autosize mah="var(--sk-size-dialog-list)">
              <Table striped={false} highlightOnHover stickyHeader className="sk-vh__table">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th className="sk-vh__check" />
                    {columns.map((c) => <Table.Th key={c.path}>{c.label}</Table.Th>)}
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {(list.data?.rows ?? []).map((row) => {
                    const key = keyOf(row);
                    return (
                      <Table.Tr key={key} onClick={() => toggle(row)} className="sk-clickable" aria-selected={isSelected(key)}>
                        <Table.Td><Checkbox checked={isSelected(key)} onChange={() => toggle(row)} onClick={(e) => e.stopPropagation()} aria-label={key} /></Table.Td>
                        {columns.map((c) => <Table.Td key={c.path}>{String(getPath(row, c.path) ?? '')}</Table.Td>)}
                      </Table.Tr>
                    );
                  })}
                </Table.Tbody>
              </Table>
            </ScrollArea.Autosize>
            {count !== undefined && (list.data?.rows.length ?? 0) < count ? (
              <Button variant="subtle" fullWidth onClick={() => setTop(top + PAGE)}>{t('table.moreCount', { loaded: list.data?.rows.length ?? 0, count })}</Button>
            ) : null}
          </Tabs.Panel>
        ) : null}
        <Tabs.Panel value="conditions" className="sk-vh__panel">
          <Stack gap="xs">
            {conditionRows.map(({ c, i }) => (
              <ConditionRow key={i} condition={c} prop={prop} ops={ops} exclude={rules.exclude} onChange={(n) => updateCondition(i, n)} onRemove={() => setSelected(selected.filter((_, j) => j !== i))} />
            ))}
            <Button variant="subtle" leftSection={<Plus className="sk-icon" />} disabled={rules.max !== undefined && selected.length >= rules.max} onClick={() => setSelected([...selected, { operator: ops[0] ?? 'EQ', values: [''] }])} className="sk-self-start" data-sk-vh-add-condition>
              {t('vh.addCondition')}
            </Button>
          </Stack>
        </Tabs.Panel>
      </Tabs>
      <div className="sk-vh__selected">
        <Text size="sm" fw={600}>{t('vh.selected')}</Text>
        <Group gap="xs" className="sk-vh__pills">
          {selected.length === 0 ? <Text size="sm" c="dimmed">{t('vh.noneSelected')}</Text> : null}
          {selected.map((c, i) => {
            const label = conditionText(c, prop, intlLocale, timeZone, { t, textArrangement: arrangement === 'TextSeparate' ? 'TextFirst' : arrangement });
            return <Pill key={i} withRemoveButton removeButtonProps={{ 'aria-label': t('common.remove', { name: label }) }} onRemove={() => setSelected(selected.filter((_, j) => j !== i))}>{label}</Pill>;
          })}
        </Group>
      </div>
      <Group justify="flex-end" className="sk-dialog-footer">
        <Button onClick={() => p.onOk(dedupe(selected.filter(isComplete)))}>{t('common.ok')}</Button>
        <Button variant="default" onClick={p.onCancel}>{t('common.cancel')}</Button>
      </Group>
    </Modal>
  );
}

function dedupe(cs: Condition[]): Condition[] {
  return cs.filter((c, i) => cs.findIndex((x) => sameCondition(x, c)) === i);
}

function ConditionRow(p: { condition: Condition; prop: PropertyModel | undefined; ops: Operator[]; exclude: boolean; onChange(c: Condition): void; onRemove(): void }) {
  const t = useText();
  const c = p.condition;
  const arity = OPERATOR_ARITY[c.operator];
  const counted = c.operator === 'LASTDAYS' || c.operator === 'NEXTDAYS';
  const inputType = counted ? 'number' : isDate(p.prop) ? 'date' : 'text';
  const valueInput = (i: number, label: string) => (
    <TextInput
      type={inputType}
      min={counted ? 1 : undefined}
      aria-label={label}
      placeholder={label}
      value={String(c.values[i] ?? '')}
      onChange={(e) => {
        const values = [...c.values];
        values[i] = e.currentTarget.value;
        p.onChange({ ...c, values, text: undefined });
      }}
      className="sk-grow"
    />
  );
  return (
    <Group gap="xs" wrap="nowrap" className="sk-vh__condition">
      {p.exclude ? (
        <SegmentedControl
          size="xs"
          value={c.exclude ? 'E' : 'I'}
          onChange={(v) => p.onChange({ ...c, exclude: v === 'E' || undefined })}
          data={[{ value: 'I', label: t('vh.include') }, { value: 'E', label: t('vh.exclude') }]}
        />
      ) : null}
      <Select
        aria-label={t('p13n.sortBy')}
        value={c.operator}
        allowDeselect={false}
        data={p.ops.map((o) => ({ value: o, label: t(`op.${o}`) }))}
        onChange={(v) => {
          if (!v) return;
          const op = v as Operator;
          // A number of days and a date do not carry over into each other.
          const keep = (op === 'LASTDAYS' || op === 'NEXTDAYS') === counted;
          p.onChange({ ...c, operator: op, values: keep ? c.values.slice(0, OPERATOR_ARITY[op]) : [] });
        }}
        className="sk-vh__operator"
      />
      {arity >= 1 ? valueInput(0, arity === 2 ? t('vh.from') : counted ? t('dateRange.dayCount') : t('vh.value')) : <span className="sk-grow" />}
      {arity === 2 ? valueInput(1, t('vh.to')) : null}
      <ActionIcon onClick={p.onRemove} aria-label={t('vh.removeCondition')} title={t('vh.removeCondition')}>
        <Trash2 className="sk-icon" />
      </ActionIcon>
    </Group>
  );
}
