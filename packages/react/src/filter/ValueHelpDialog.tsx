/** Value help dialog: "Search and Select" from the value list and "Define Conditions" (include / exclude) (LR-11). */
import { ActionIcon, Button, Checkbox, Group, Modal, Pill, ScrollArea, SegmentedControl, Select, Stack, Table, Tabs, Text, TextInput } from '@mantine/core';
import {
  arrangeText, filterExpressionRules, getProperty, isComplete, isRelativeDateOperator, OPERATOR_ARITY, OPERATORS, relativeDateValueTypes, resolvePath, restrictConditions, valueListTextArrangement,
  type Condition, type FilterExpressionRules, type Operator, type PropertyModel,
} from '@rhfan2019/smart-kit-core';
import { Plus, Search, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useService, useSmartKit } from '../context/SmartKitProvider';
import { useFilterText } from './filterText';
import { getPath } from '../field/values';
import { optionText } from '../controls/dialogs/dateOptions';
import { conditionText, digitSequenceValue, sameCondition } from './conditionText';
import { useValueList, useValueListSource, useValueLists } from './useValueList';
import { propagateOut, useValueHelpSource } from './valueHelpSource';

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

/** The order of the value operators in the operator list (string fields: equal to, then the text patterns). */
const VALUE_ORDER: Operator[] = ['EQ', 'NE', 'Contains', 'NotContains', 'StartsWith', 'EndsWith', 'BT', 'NB', 'LT', 'LE', 'GT', 'GE', 'Empty', 'NotEmpty'];
const isDate = (p: PropertyModel | undefined) => p?.edmType === 'Edm.Date' || p?.edmType === 'Edm.DateTimeOffset';

/** Rows per page of the dialog's table: FE's value help dialog requests 64. */
const PAGE = 64;

/** Label of an operator in the "Define Conditions" list. */
function operatorLabel(t: ReturnType<typeof useFilterText>, o: Operator): string {
  if ((OPERATORS as readonly string[]).includes(o) || ['TODAY', 'YESTERDAY', 'TOMORROW', 'LASTDAYS', 'NEXTDAYS', 'THISWEEK', 'LASTWEEK', 'NEXTWEEK', 'THISMONTH', 'LASTMONTH', 'NEXTMONTH', 'THISQUARTER', 'LASTQUARTER', 'NEXTQUARTER', 'THISYEAR', 'LASTYEAR', 'NEXTYEAR', 'YEARTODATE'].includes(o)) return t(`op.${o}` as 'op.EQ');
  const unit = /^(LAST|NEXT)(DAYS|WEEKS|MONTHS|QUARTERS|YEARS)(INCLUDED)?$/.exec(o);
  if (unit) return `${t(`ctl.ddr.${unit[1]}${unit[3] ?? ''}` as 'ctl.ddr.LAST')} (${t(`ctl.ddr.unit.${unit[2]}` as 'ctl.ddr.unit.DAYS')})`;
  const ext = /^(FROM|TO)([A-Z]+)$/.exec(o);
  if (ext && !['TODAY', 'TOMORROW', 'TODAYFROMTO'].includes(o)) return t(ext[1] === 'FROM' ? 'ctl.ddr.fromValue' : 'ctl.ddr.toValue', { date: optionText(t, ext[2]!) });
  return optionText(t, o);
}

export function ValueHelpDialog(p: ValueHelpDialogProps) {
  const t = useFilterText();
  const service = useService(p.service);
  const { intlLocale, timeZone } = useSmartKit();
  const typeName = service.model.entitySets[p.entitySet]!.typeName;
  const prop = getProperty(service.model, typeName, p.path);
  // qualified Common.ValueList#Q (limited by Common.ValueListRelevantQualifiers): the dialog switches between them;
  // Common.ValueListReferences: the mappings of the value help services (loaded when the dialog opens)
  const lists = useValueLists(p.entitySet, p.path, p.service, p.opened).valueLists;
  const [which, setWhich] = useState(0);
  const vl = lists[which] ?? lists[0];
  // the model of the value list entity: the value help service's for a referenced value list
  const vlModel = useValueListSource(vl, p.service)?.model;
  // Capabilities.FilterExpressionRestrictions (P2-LR-19): allowed operators, exclusions and number of conditions.
  const expression = service.model.entitySets[p.entitySet]!.capabilities.filterExpressions[p.path];
  const rules = filterExpressionRules(expression, prop?.edmType);
  const canSelect = Boolean(vl) && rules.operators.includes('EQ');
  const [selected, setSelected] = useState<Condition[]>(p.conditions);
  const [draft, setDraft] = useState('');
  const [search, setSearch] = useState('');
  const [top, setTop] = useState(PAGE);
  const [tab, setTab] = useState<string | null>(canSelect ? 'select' : 'conditions');
  // a value list of Common.ValueListReferences becomes known once its value help service is loaded: then the dialog
  // opens on "Search and Select" unless the user already chose a tab
  const tabChosen = useRef(false);
  useEffect(() => {
    if (p.opened && canSelect && !tabChosen.current) setTab('select');
  }, [p.opened, canSelect]);

  useEffect(() => {
    if (p.opened) {
      setSelected(p.conditions);
      setDraft('');
      setSearch('');
      setTop(PAGE);
      setPicked({});
      setWhich(0);
      setTab(canSelect ? 'select' : 'conditions');
      tabChosen.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when (re)opened
  }, [p.opened]);

  // In / InOut / Constant parameters filter the list; Out / InOut write the chosen rows back (P1-5).
  const source = useValueHelpSource();
  const [picked, setPicked] = useState<Record<string, Record<string, unknown>>>({});
  const list = useValueList(vl, { search, top, enabled: p.opened && Boolean(vl), filters: source?.filters, purpose: 'dialog' }, p.service);
  const vlType = vl && vlModel ? vlModel.entitySets[vl.collectionPath]?.typeName : undefined;
  const columns = useMemo(() => {
    if (!vl || !vlModel) return [];
    const propOf = (path: string) => (vlType ? resolvePath(vlModel.entityTypes, vlType, path).property : undefined);
    // the parameters except Constant ones and properties hidden in the value list entity (FE getColumnVisibility);
    // a parameter that is the Common.Text of another shown parameter is not a column of its own when that one shows
    // its text (FE getColumnVisibilityInfo: keyColumnDisplayFormat from Common.Text@UI.TextArrangement, not "Value")
    const shown = vl.parameters.filter((x) => x.kind !== 'Constant' && !propOf(x.valueListProperty)?.hidden);
    const textOf = (path: string) => {
      const pr = propOf(path);
      if (!pr?.text || !pr.textArrangement || pr.textArrangement === 'TextSeparate') return undefined;
      return path.includes('/') ? `${path.slice(0, path.lastIndexOf('/'))}/${pr.text}` : pr.text;
    };
    const texts = new Map(shown.map((x) => [x.valueListProperty, textOf(x.valueListProperty)] as const));
    const folded = new Set([...texts.values()].filter((t) => t !== undefined && shown.some((x) => x.valueListProperty === t)));
    return shown.filter((x) => !folded.has(x.valueListProperty)).map((x) => {
      const pr = propOf(x.valueListProperty);
      const text = texts.get(x.valueListProperty);
      // the key column shows its text as arranged (FE keyColumnDisplayFormat), when the row has it
      return { path: x.valueListProperty, label: pr?.label || x.valueListProperty, text, arrangement: pr?.textArrangement };
    });
  }, [vl, vlType, vlModel]);
  const keyOf = (row: Record<string, unknown>) => String(getPath(row, vl!.keyProperty) ?? '');
  const isSelected = (key: string) => selected.some((c) => c.operator === 'EQ' && !c.exclude && String(c.values[0]) === key);
  const toggle = (row: Record<string, unknown>) => {
    const key = keyOf(row);
    if (isSelected(key)) setSelected(selected.filter((c) => !(c.operator === 'EQ' && !c.exclude && String(c.values[0]) === key)));
    else {
      setPicked({ ...picked, [key]: row });
      const text = vl!.descriptionProperty ? getPath(row, vl!.descriptionProperty) : undefined;
      setSelected(restrictConditions(expression, [...selected, { operator: 'EQ', values: [key], text: text ? String(text) : undefined }]));
    }
  };

  const conditionRows = selected.map((c, i) => ({ c, i })).filter(({ c }) => !(c.operator === 'EQ' && !c.exclude && c.text !== undefined));
  const updateCondition = (i: number, next: Condition) => setSelected(selected.map((c, j) => (j === i ? next : c)));
  // the operators FE offers for the field (type and FilterExpressionRestrictions); DATE / DATERANGE are EQ / BT here
  const ops = [...VALUE_ORDER.filter((o) => rules.operators.includes(o) || rules.excludeOperators.includes(o)), ...rules.operators.filter((o) => isRelativeDateOperator(o) && o !== 'DATE' && o !== 'DATERANGE')];
  const arrangement = valueListTextArrangement(vlModel ?? service.model, prop, vl);
  const count = list.data?.count;

  return (
    <Modal opened={p.opened} onClose={p.onCancel} title={p.title} size="xl" classNames={{ body: 'sk-vh' }}>
      <Tabs value={tab} onChange={(v) => { tabChosen.current = true; setTab(v); }} keepMounted={false}>
        <Tabs.List>
          {canSelect ? <Tabs.Tab value="select">{t('vh.searchAndSelect')}</Tabs.Tab> : null}
          <Tabs.Tab value="conditions">{t('vh.defineConditions')}</Tabs.Tab>
        </Tabs.List>
        {canSelect ? (
          <Tabs.Panel value="select" className="sk-vh__panel">
            {lists.length > 1 ? (
              // several value lists (Common.ValueList#Q): FE's collective search, one at a time, titled by ValueList/Label
              <Select
                size="xs" allowDeselect={false} aria-label={p.title} value={String(which)} className="sk-vh__lists" data-sk-vh-lists
                data={lists.map((x, i) => ({ value: String(i), label: x.label ?? x.qualifier ?? x.collectionPath }))}
                onChange={(v) => { setWhich(Number(v ?? 0)); setTop(PAGE); }}
              />
            ) : null}
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
                    {columns.map((c, i) => <Table.Th key={`${c.path}-${i}`}>{c.label}</Table.Th>)}
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {(list.data?.rows ?? []).map((row) => {
                    const key = keyOf(row);
                    return (
                      <Table.Tr key={key} onClick={() => toggle(row)} className="sk-clickable" aria-selected={isSelected(key)}>
                        <Table.Td><Checkbox checked={isSelected(key)} onChange={() => toggle(row)} onClick={(e) => e.stopPropagation()} aria-label={key} /></Table.Td>
                        {columns.map((c, i) => {
                          const value = String(getPath(row, c.path) ?? '');
                          const text = c.text ? getPath(row, c.text) : undefined;
                          return <Table.Td key={`${c.path}-${i}`}>{c.text ? arrangeText(value, text === undefined || text === null ? undefined : String(text), c.arrangement) : value}</Table.Td>;
                        })}
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
              <ConditionRow key={i} condition={c} prop={prop} ops={ops} rules={rules} onChange={(n) => updateCondition(i, n)} onRemove={() => setSelected(selected.filter((_, j) => j !== i))} />
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
            const label = conditionText(c, prop, intlLocale, timeZone, { t, textArrangement: arrangement });
            return <Pill key={i} withRemoveButton removeButtonProps={{ 'aria-label': t('common.remove', { name: label }) }} onRemove={() => setSelected(selected.filter((_, j) => j !== i))}>{label}</Pill>;
          })}
        </Group>
      </div>
      <Group justify="flex-end" className="sk-dialog-footer">
        <Button
          onClick={() => {
            const chosen = dedupe(selected.filter(isComplete).map((c) => digitSequence(c, prop)));
            p.onOk(chosen);
            if (vl) propagateOut(vl, chosen.filter((c) => c.operator === 'EQ' && !c.exclude && picked[String(c.values[0])]).map((c) => picked[String(c.values[0])]!), source);
          }}
        >
          {t('common.ok')}
        </Button>
        <Button variant="default" onClick={p.onCancel}>{t('common.cancel')}</Button>
      </Group>
    </Modal>
  );
}

/** Common.IsDigitSequence: defined conditions are parsed like typed ones (not the text operators, SelfNoParse). */
function digitSequence(c: Condition, prop: PropertyModel | undefined): Condition {
  if (!prop?.isDigitSequence || TEXT_OPS.has(c.operator)) return c;
  return { ...c, values: c.values.map((v) => (typeof v === 'string' ? digitSequenceValue(v.trim(), prop) : v)) };
}
const TEXT_OPS = new Set<Operator>(['Contains', 'NotContains', 'StartsWith', 'EndsWith']);

function dedupe(cs: Condition[]): Condition[] {
  return cs.filter((c, i) => cs.findIndex((x) => sameCondition(x, c)) === i);
}

function ConditionRow(p: { condition: Condition; prop: PropertyModel | undefined; ops: Operator[]; rules: FilterExpressionRules; onChange(c: Condition): void; onRemove(): void }) {
  const t = useFilterText();
  const c = p.condition;
  const arity = OPERATOR_ARITY[c.operator];
  // the value types of a relative date operator (counts, dates, a month); value operators take values of the property
  const kinds = isRelativeDateOperator(c.operator) ? relativeDateValueTypes(c.operator) : [];
  const kindsKey = (op: Operator) => (isRelativeDateOperator(op) ? relativeDateValueTypes(op).join(',') : 'value');
  const valueInput = (i: number, label: string) => {
    const kind = kinds[i];
    const numeric = kind === 'int' || kind === 'month' || kind === 'year';
    return (
      <TextInput
        type={numeric ? 'number' : kind === 'date' || isDate(p.prop) ? 'date' : 'text'}
        min={kind === 'int' ? (c.operator === 'TODAYFROMTO' ? 0 : 1) : kind === 'month' ? 0 : undefined}
        max={kind === 'month' ? 11 : undefined}
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
  };
  const label0 = kinds[0] === 'int' ? (c.operator === 'TODAYFROMTO' ? t('ctl.ddr.daysBefore') : t('ctl.ddr.value')) : kinds[0] === 'month' ? t('ctl.ddr.SPECIFICMONTH') : arity === 2 ? t('vh.from') : t('vh.value');
  const label1 = c.operator === 'TODAYFROMTO' ? t('ctl.ddr.daysAfter') : kinds[1] === 'year' ? t('ctl.ddr.year') : t('vh.to');
  const canExclude = p.rules.excludeOperators.includes(c.operator);
  return (
    <Group gap="xs" wrap="nowrap" className="sk-vh__condition">
      {p.rules.exclude ? (
        <SegmentedControl
          size="xs"
          value={c.exclude ? 'E' : 'I'}
          disabled={!canExclude && !c.exclude}
          onChange={(v) => p.onChange({ ...c, exclude: v === 'E' || undefined })}
          data={[{ value: 'I', label: t('vh.include') }, { value: 'E', label: t('vh.exclude') }]}
        />
      ) : null}
      <Select
        aria-label={t('p13n.sortBy')}
        value={c.operator}
        allowDeselect={false}
        data={p.ops.map((o) => ({ value: o, label: operatorLabel(t, o) }))}
        onChange={(v) => {
          if (!v) return;
          const op = v as Operator;
          // values carry over only between operators that take the same kind of values
          const keep = kindsKey(op) === kindsKey(c.operator);
          p.onChange({ ...c, operator: op, values: keep ? c.values.slice(0, OPERATOR_ARITY[op]) : [] });
        }}
        className="sk-vh__operator"
      />
      {arity >= 1 ? valueInput(0, label0) : <span className="sk-grow" />}
      {arity === 2 ? valueInput(1, label1) : null}
      <ActionIcon onClick={p.onRemove} aria-label={t('vh.removeCondition')} title={t('vh.removeCondition')}>
        <Trash2 className="sk-icon" />
      </ActionIcon>
    </Group>
  );
}
