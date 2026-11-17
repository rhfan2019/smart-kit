/** Cards (docs/20-research-cards.md, ADR-028): Card, headers and the annotation-driven contents. */
import { MantineProvider } from '@mantine/core';
import { buildModel, MemoryProvider, type NavigationAdapter, type Row } from '@rhfan2019/smart-kit-core';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import {
  AnalyticalContent, CalendarContent, Card, Header, ListContent, NumericHeader, ObjectContent, SmartKitProvider, smartKitMantineTheme, TableContent, TimelineContent,
} from '../src';
import { firstDayOf, monthGrid, weekNumber } from '../src/cards/CalendarContent';
import { compactParts, counterText, durationText, relativeDateTime, withUnit } from '../src/cards/format';
import { createText } from '../src/i18n/text';

const model = buildModel(readFileSync(join(import.meta.dirname, '../../core/test/samples/purchasing.en.xml'), 'utf8'));

const suppliers: Row[] = [
  { Supplier: 'S1', SupplierName: 'Acme Corp', Country: 'DE', City: 'Berlin', Rating: 4.5, LogoUrl: '', IsBlocked: false, RatingCount: 12 },
  { Supplier: 'S2', SupplierName: 'Bolt Ltd', Country: 'GB', City: 'London', Rating: 2.1, LogoUrl: '', IsBlocked: false, RatingCount: 3 },
];
const order = (n: number, net: number, status = 'NEW', currency = 'EUR'): Row => ({
  PurchaseOrder: `45000000${String(n).padStart(2, '0')}`, PurchaseOrderType: n % 2 ? 'NB' : 'FO', Supplier: n % 2 ? 'S1' : 'S2', CompanyCode: '1000', PurchasingGroup: '001',
  OrderDate: `2026-10-${String(n).padStart(2, '0')}`, CreatedAt: '2026-10-01T08:00:00Z', Status: status, StatusCriticality: status === 'NEW' ? 0 : 3, NetAmount: net, Currency: currency,
  DeliveredPercent: 0, Description: `Order ${n}`, Notes: null, Version: 1, BudgetAmount: net * 1.2, InvoicedAmount: 0, ApproveEnabled: status === 'NEW', CloseEnabled: true,
});
const orders = [order(1, 12500), order(2, 48900), order(3, 23100, 'APPR'), order(4, 11050), order(5, 15720), order(6, 900), order(7, 300)];
const meeting = (id: string, start: string, end: string, subject: string, cat = 'NEGO'): Row => ({
  Meeting: id, Supplier: 'S1', Subject: subject, StartAt: start, EndAt: end, Location: 'Room A', Category: cat, CategoryName: cat === 'NEGO' ? 'Negotiation' : 'Quality Review',
});
const meetings = [
  meeting('M1', '2026-11-16T07:30:00Z', '2026-11-16T08:30:00Z', 'Framework contract'),
  meeting('M2', '2026-11-16T10:00:00Z', '2026-11-16T10:30:00Z', 'Quality review', 'REVW'),
  meeting('M3', '2026-11-16T12:30:00Z', '2026-11-16T14:00:00Z', 'Site audit'),
  meeting('M4', '2026-11-16T15:00:00Z', '2026-11-16T16:30:00Z', 'Defect analysis', 'REVW'),
  meeting('M5', '2026-11-18T09:00:00Z', '2026-11-18T10:00:00Z', 'Volume discount'),
];
const statuses: Row[] = [{ Code: 'NEW', Name: 'New', Criticality: 0 }, { Code: 'APPR', Name: 'Approved', Criticality: 3 }];
const types: Row[] = [{ Code: 'NB', Name: 'Standard Order' }, { Code: 'FO', Name: 'Framework Order' }];

function setup(children: ReactNode, o: { navigation?: NavigationAdapter; actions?: Record<string, (row: Row | undefined) => Row | undefined> } = {}) {
  const provider = new MemoryProvider({
    model,
    data: { PurchaseOrders: orders.map((r) => ({ ...r })), Suppliers: suppliers, SupplierMeetings: meetings, OrderStatuses: statuses, PurchaseOrderTypes: types },
    actions: o.actions,
  });
  return render(
    <MantineProvider theme={smartKitMantineTheme}>
      <SmartKitProvider services={{ purchasing: { model, dataProvider: provider } }} locale="en" namespace={`t${Math.random()}`} timeZone="Europe/Berlin" navigation={o.navigation}>
        {children}
      </SmartKitProvider>
    </MantineProvider>,
  );
}
const nav = (): NavigationAdapter => ({ toObject: vi.fn(), toList: vi.fn(), hasObjectPage: () => true });
const t = createText('en');
const NOW = new Date('2026-11-16T08:00:00Z');

describe('docs/20 format helpers', () => {
  it('CD-03 counter: "5 of 40"; none when everything is visible; totals above 1000 get a scaling factor', () => {
    expect(counterText(t, 'en-US', 5, 40)).toBe('5 of 40');
    expect(counterText(t, 'en-US', 5, 5)).toBeUndefined();
    expect(counterText(t, 'en-US', 5, undefined)).toBeUndefined();
    expect(counterText(t, 'en-US', 5, 12000)).toBe('5 of 12K');
  });
  it('CD-04 numeric header splits the number and the scale; CD-07 short format', () => {
    expect(compactParts(125600, 'en-US')).toEqual({ number: '125.6', scale: 'K' });
    expect(compactParts(587000000, 'en-US')).toEqual({ number: '587', scale: 'M' });
    expect(compactParts(42, 'en-US')).toEqual({ number: '42', scale: '' });
  });
  it('CD-33 timeline dates are relative to today; durations "1 hr 30 min"', () => {
    expect(relativeDateTime(t, 'en-US', new Date('2026-11-16T12:30:00Z'), NOW, 'Europe/Berlin')).toBe('Today at 1:30 PM');
    expect(relativeDateTime(t, 'en-US', new Date('2026-11-17T08:00:00Z'), NOW, 'Europe/Berlin')).toBe('Tomorrow at 9:00 AM');
    expect(relativeDateTime(t, 'en-US', new Date('2026-11-19T10:00:00Z'), NOW, 'Europe/Berlin')).toBe('11/19/26 at 11:00 AM');
    expect(durationText(t, 90)).toBe('1 hr 30 min');
    expect(durationText(t, 30)).toBe('30 min');
    expect(durationText(t, 60)).toBe('1 hr');
    expect(withUnit({ display: '12,500.00', unit: 'EUR' })).toBe('12,500.00 EUR');
  });
  it('CD-35 calendar grid: 6 weeks from the first day of the week, week numbers per locale', () => {
    expect(firstDayOf('en-US')).toBe(0);
    expect(firstDayOf('zh-CN')).toBe(1);
    const grid = monthGrid(2026, 10, 0);
    expect(grid).toHaveLength(42);
    expect(grid[0]).toBe('2026-11-01');
    expect(weekNumber(grid[0]!, 0)).toBe(45); // US numbering, as SAPUI5 en-US
    expect(monthGrid(2026, 10, 1)[0]).toBe('2026-10-26');
    expect(weekNumber('2026-11-16', 1)).toBe(47); // ISO 8601
    expect(weekNumber('2025-12-29', 1)).toBe(1);
  });
});

describe('docs/20 Card and headers', () => {
  it('CD-01 / CD-02 a card is a region named by its header title; the header has title, subtitle, avatar and counter', () => {
    setup(<Card header={<Header title="Large Orders" subtitle="Above 10K" statusText="5 of 40" iconInitials="LO" />}><p>content</p></Card>);
    const card = screen.getByRole('region', { name: 'Large Orders' });
    expect(within(card).getByText('Above 10K')).toBeInTheDocument();
    expect(within(card).getByText('5 of 40')).toHaveClass('sk-card__status');
    expect(within(card).getByText('LO')).toHaveClass('sk-card__avatar--circle');
    expect(within(card).getByText('content')).toBeInTheDocument();
  });
  it('CD-05 the whole header is the navigation area (press, Enter, Space)', () => {
    const onPress = vi.fn();
    setup(<Card header={<Header title="T" onPress={onPress} />} />);
    const header = screen.getByRole('button', { name: 'T' });
    fireEvent.click(header);
    fireEvent.keyDown(header, { key: 'Enter' });
    fireEvent.keyDown(header, { key: ' ' });
    expect(onPress).toHaveBeenCalledTimes(3);
  });
  it('CD-04 numeric header: "<subtitle> | <unit>", number with scale, trend and state, side indicators, details', () => {
    const { container } = setup(
      <Card header={<NumericHeader title="Spend" subtitle="By supplier" unitOfMeasurement="EUR" number="125.6" scale="K" trend="Up" state="Good" details="Current year" sideIndicators={[{ title: 'Target', number: '150', unit: 'K' }, { title: 'Deviation', number: '16.3', unit: '%' }]} />} />,
    );
    expect(container.querySelector('.sk-card__subtitle')).toHaveTextContent('By supplierEUR');
    expect(container.querySelector('.sk-card__unit-separator')).toBeInTheDocument();
    expect(container.querySelector('.sk-card__main')).toHaveClass('sk-card--state-good');
    expect(container.querySelector('.sk-card__trend--up')).toBeInTheDocument();
    expect(screen.getByText('150K')).toBeInTheDocument();
    expect(screen.getByText('16.3%')).toBeInTheDocument();
    expect(screen.getByText('Current year')).toHaveClass('sk-card__details');
  });
  it('CD-04 annotation-driven KPI: sum of the data point, unit, CriticalityCalculation, TrendCalculation, target and deviation', async () => {
    const { container } = setup(<Card header={<NumericHeader title="Spend" entitySet="PurchaseOrders" dataPointAnnotationPath="com.sap.vocabularies.UI.v1.DataPoint#CardSpend" selectionAnnotationPath="@UI.SelectionVariant#CardEur" />} />);
    // 112,470 EUR in total: far below the reference 550M → trend down; below the tolerance → good.
    await waitFor(() => expect(container.querySelector('.sk-card__number')).toHaveTextContent('112.5'));
    expect(container.querySelector('.sk-card__scale')).toHaveTextContent('K');
    expect(container.querySelector('.sk-card__unit')).toHaveTextContent('EUR');
    expect(container.querySelector('.sk-card__main')).toHaveClass('sk-card--state-good');
    expect(container.querySelector('.sk-card__trend--down')).toBeInTheDocument();
    expect(screen.getByText('Target')).toBeInTheDocument();
    expect(screen.getByText('600M')).toBeInTheDocument();
    expect(screen.getByText('Deviation')).toBeInTheDocument();
  });
});

describe('docs/20 list and table contents', () => {
  it('CD-10 / CD-03 list: title, description and info with currency from the line item; counter in the header', async () => {
    setup(
      <Card header={<Header title="Large Orders" />}>
        <ListContent entitySet="PurchaseOrders" presentationAnnotationPath="com.sap.vocabularies.UI.v1.PresentationVariant#CardLarge" selectionAnnotationPath="@UI.SelectionVariant#CardNew" maxItems={3} />
      </Card>,
    );
    const items = await screen.findAllByRole('listitem');
    expect(items).toHaveLength(3);
    // sorted by net amount descending (PresentationVariant#CardLarge), only status NEW (SelectionVariant#CardNew)
    expect(within(items[0]!).getByText('Order 2')).toHaveClass('sk-card__item-title');
    expect(within(items[0]!).getByText('Bolt Ltd')).toHaveClass('sk-card__item-description');
    expect(within(items[0]!).getByText('48,900.00 EUR')).toHaveClass('sk-card__item-info');
    await waitFor(() => expect(screen.getByText('3 of 6')).toBeInTheDocument());
  });
  it('CD-11 list: the header title defaults to UI.HeaderInfo/TypeNamePlural; header and rows navigate', async () => {
    const n = nav();
    setup(<Card header={<Header />}><ListContent entitySet="PurchaseOrders" maxItems={2} /></Card>, { navigation: n });
    const header = await screen.findByRole('button', { name: 'Purchase Orders' });
    fireEvent.click(header);
    expect(n.toList).toHaveBeenCalledWith('PurchaseOrders', 'purchasing');
    const items = await screen.findAllByRole('listitem');
    fireEvent.click(items[0]!);
    expect(n.toObject).toHaveBeenCalledWith(expect.stringMatching(/^PurchaseOrders\('45000000\d\d'\)$/), 'purchasing');
  });
  it('CD-12 extended list items show further attributes; the bar flavor shows a bar scaled to the largest value', async () => {
    const { container, unmount } = setup(<Card><ListContent entitySet="PurchaseOrders" listType="extended" presentationAnnotationPath="@UI.PresentationVariant#CardLarge" /></Card>);
    // OVP shows at most 3 extended items by default; UI.PresentationVariant/MaxItems (5) takes precedence
    await waitFor(() => expect(container.querySelectorAll('.sk-card__item')).toHaveLength(5));
    expect(container.querySelector('.sk-card__item-attributes')).toBeInTheDocument();
    unmount();
    const bar = setup(<Card><ListContent entitySet="PurchaseOrders" listFlavor="bar" presentationAnnotationPath="@UI.PresentationVariant#CardLarge" maxItems={2} /></Card>);
    await waitFor(() => expect(bar.container.querySelectorAll('.sk-card__item-bar')).toHaveLength(2));
    const fills = bar.container.querySelectorAll<HTMLElement>('.sk-card__item-bar-fill');
    expect(Number.parseFloat(fills[0]!.style.inlineSize)).toBe(100);
    expect(Number.parseFloat(fills[1]!.style.inlineSize)).toBeCloseTo((23100 / 48900) * 100, 0);
  });
  it('CD-13 table: at most 3 columns and 3 rows, the semantic key in bold, amounts right-aligned, states coloured', async () => {
    const { container } = setup(<Card><TableContent entitySet="PurchaseOrders" annotationPath="@UI.LineItem#CardTable" presentationAnnotationPath="@UI.PresentationVariant#CardLarge" maxItems={3} /></Card>);
    // 3 rows; the 4th line item field (net amount) is dropped (3 columns)
    await waitFor(() => expect(container.querySelectorAll('tbody tr')).toHaveLength(3));
    expect([...container.querySelectorAll('th')].map((th) => th.textContent)).toEqual(['Purchase Order', 'Net Amount', 'Status']);
    expect(container.querySelector('tbody td:nth-child(2)')).toHaveClass('sk-card__cell--end');
    expect(container.querySelector('tbody td')).toHaveClass('sk-card__cell--identifier');
    const approved = [...container.querySelectorAll('tbody tr')].find((tr) => tr.textContent?.includes('Approved'));
    expect(within(approved as HTMLElement).getByText(/Approved/)).toHaveClass('sk-card--state-good');
  });
  it('CD-14 no items and errors are shown inside the card', async () => {
    setup(<Card><ListContent entitySet="PurchaseOrders" filters={{ Status: [{ operator: 'EQ', values: ['NONE'] }] }} /></Card>);
    expect(await screen.findByRole('status')).toHaveTextContent('There are no items.');
  });
});

describe('docs/20 card details from the SAPUI5 samples (highlight, state icons, groups, bullet, identifier, progress)', () => {
  it('CD-15 list items: a 6 px highlight line and a state icon from the criticality', async () => {
    const { container } = setup(<Card><ListContent entitySet="PurchaseOrders" highlight showStateIcon presentationAnnotationPath="@UI.PresentationVariant#CardLarge" /></Card>);
    await waitFor(() => expect(container.querySelectorAll('.sk-card__item')).toHaveLength(5));
    // order 3 is approved (criticality 3): success highlight and check icon; the new ones are neutral: no line, no icon
    const approved = [...container.querySelectorAll('.sk-card__item')].find((li) => li.textContent?.includes('Order 3'))!;
    expect(approved).toHaveClass('sk-card__item--highlight', 'sk-card__item--hl-success');
    const neutral = [...container.querySelectorAll('.sk-card__item')].find((li) => li.textContent?.includes('Order 2'))!;
    expect(neutral).not.toHaveClass('sk-card__item--highlight');
  });
  it('CD-16 UI.PresentationVariant/GroupBy puts a group header before each group, in the list and in the table', async () => {
    const list = setup(<Card><ListContent entitySet="PurchaseOrders" annotationPath="@UI.LineItem#CardList" presentationAnnotationPath="@UI.PresentationVariant#CardTable" /></Card>);
    await waitFor(() => expect(list.container.querySelectorAll('.sk-card__group')).toHaveLength(2));
    expect([...list.container.querySelectorAll('.sk-card__group')].map((g) => g.textContent)).toEqual(['Approved', 'New']);
    list.unmount();
    const table = setup(<Card><TableContent entitySet="PurchaseOrders" maxColumns={4} presentationAnnotationPath="@UI.PresentationVariant#CardTable" /></Card>);
    await waitFor(() => expect(table.container.querySelectorAll('.sk-card__group-row')).toHaveLength(2));
  });
  it('CD-17 bar flavor: a data point with a target value is a bullet micro chart', async () => {
    const { container } = setup(<Card><ListContent entitySet="PurchaseOrders" listFlavor="bar" annotationPath="@UI.LineItem#CardBudget" maxItems={2} /></Card>);
    await waitFor(() => expect(container.querySelectorAll('.sk-card__item-bullet [data-sk-microchart="bullet"]')).toHaveLength(2));
    expect(container.querySelector('.sk-card__item-bar')).toBeNull();
  });
  it('CD-18 table: the identifier is a link with the UI.HeaderInfo description below; Progress data points are progress bars', async () => {
    const { container } = setup(<Card><TableContent entitySet="PurchaseOrders" maxColumns={4} presentationAnnotationPath="@UI.PresentationVariant#CardTable" /></Card>, { navigation: nav() });
    await waitFor(() => expect(container.querySelectorAll('.sk-card__progress')).not.toHaveLength(0));
    expect(container.querySelector('.sk-card__identifier--link')).toHaveTextContent(/^45000000\d\d$/);
    expect(container.querySelector('.sk-card__identifier-text')).toHaveTextContent(/^Order \d$/);
    expect(container.querySelector('.sk-card__progress')).toHaveAttribute('aria-valuenow', '0');
  });
});

describe('docs/20 sky theme', () => {
  it('CD-19 the sky theme redefines the semantic colours with the measured Horizon values (contrast: tests/unit/arch.test.ts)', () => {
    const css = readFileSync(join(import.meta.dirname, '../src/theme/tokens.css'), 'utf8');
    const block = css.slice(css.indexOf("[data-sk-theme='sky'],"), css.indexOf('}', css.indexOf("[data-sk-theme='sky'],")));
    for (const token of ['--sk-color-page', '--sk-color-surface', '--sk-color-text', '--sk-color-link', '--sk-color-positive', '--sk-color-critical', '--sk-color-negative', '--sk-color-icon-negative']) expect(block).toContain(`${token}:`);
    expect(css).toContain('--sk-sky-link: #0064d9;');
    expect(css).toContain('--sk-sky-chart-1: #168eff;');
  });
});

describe('docs/20 object, analytical, timeline and calendar contents', () => {
  it('CD-20 object: header from UI.HeaderInfo, groups from UI.QuickViewFacets as "label:" and value', async () => {
    setup(<Card header={<Header />}><ObjectContent entitySet="Suppliers" keys={{ Supplier: 'S1' }} /></Card>);
    expect(await screen.findByRole('region', { name: 'Acme Corp' })).toBeInTheDocument();
    expect(screen.getByText('AC')).toHaveClass('sk-card__avatar');
    expect(screen.getByRole('heading', { name: 'Supplier Details' })).toBeInTheDocument();
    expect(screen.getByText('City:')).toHaveClass('sk-card__object-label');
    expect(screen.getByText('Berlin')).toHaveClass('sk-card__object-value');
  });
  it('CD-21 object: UI.Identification actions in the footer run the bound action and reload', async () => {
    const approve = vi.fn((row: Row | undefined) => ({ ...row, Status: 'APPR' }));
    setup(<Card header={<Header />}><ObjectContent entitySet="PurchaseOrders" keys={{ PurchaseOrder: '4500000001' }} annotationPath="UI.Facets" /></Card>, { actions: { 'Purchasing.approve': approve } });
    const button = await screen.findByRole('button', { name: /Approve/ });
    expect(button).toHaveClass('sk-card__button--emphasized');
    fireEvent.click(button);
    await waitFor(() => expect(approve).toHaveBeenCalled());
  });
  it('CD-30 analytical: UI.Chart aggregated on the server, at most 4 points; unsupported chart types say so', async () => {
    const { container, unmount } = setup(<Card><AnalyticalContent entitySet="PurchaseOrders" chartAnnotationPath="@UI.Chart#ByStatus" /></Card>);
    await waitFor(() => expect(container.querySelectorAll('[data-sk-chart-bar]')).toHaveLength(2));
    expect(container.querySelector('[data-sk-chart="column"]')).toBeInTheDocument();
    unmount();
    const donut = setup(<Card><AnalyticalContent entitySet="PurchaseOrders" chartAnnotationPath="@UI.Chart#CardTypeShare" /></Card>);
    await waitFor(() => expect(donut.container.querySelectorAll('.sk-chart__segment')).toHaveLength(2));
    expect(donut.container.querySelector('.sk-chart__legend')).toHaveTextContent('Standard Order');
  });
  it('CD-33 timeline: Communication.Event items, newest first, relative dates', async () => {
    setup(<Card header={<Header title="Meetings" />}><TimelineContent entitySet="SupplierMeetings" maxItems={3} now={NOW} /></Card>);
    const items = await screen.findAllByRole('listitem');
    expect(items.map((li) => li.querySelector('.sk-card__timeline-title')!.textContent)).toEqual(['Site audit', 'Quality review', 'Framework contract']);
    expect(within(items[0]!).getByText('Today at 1:30 PM')).toBeInTheDocument();
    expect(within(items[0]!).getByText('Acme Corp')).toBeInTheDocument();
    expect(screen.getByText('3 of 5')).toBeInTheDocument();
  });
  it('CD-35 / CD-36 calendar: the selected day lists its appointments (on today only those not ended), with counter and "More"', async () => {
    const { container } = setup(
      <Card header={<Header title="My Meetings" />}>
        <CalendarContent entitySet="SupplierMeetings" date="2026-11-16" now={NOW} specialDates={[{ startDate: '2026-11-20', type: 'holiday' }]} legendItems={[{ category: 'calendar', type: 'holiday', text: 'Holiday' }]} />
      </Card>,
      { navigation: { ...nav(), href: () => '/meetings' } },
    );
    // 08:00Z: "Framework contract" (07:30–08:30) is running, so 4 of 4 are current; 2 are shown
    await waitFor(() => expect(container.querySelectorAll('.sk-card__appointment')).toHaveLength(2));
    expect(screen.getByText('2 of 4')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'More' })).toBeInTheDocument();
    expect(container.querySelector('.sk-card__appointment-time')).toHaveTextContent('08:301 hr');
    expect(container.querySelector('[data-date="2026-11-20"] .sk-card__day-special')).toBeInTheDocument();
    expect(container.querySelector('[data-date="2026-11-16"]')).toHaveClass('sk-card__day--today', 'sk-card__day--selected');
    expect([...container.querySelectorAll('.sk-card__legend-item')].map((l) => l.textContent)).toEqual(['Holiday', 'Negotiation', 'More (1)']);
    // another day: all its appointments, no "More"
    fireEvent.click(container.querySelector('[data-date="2026-11-18"]')!);
    await waitFor(() => expect(container.querySelectorAll('.sk-card__appointment')).toHaveLength(1));
    expect(screen.queryByRole('button', { name: 'More' })).toBeNull();
    // keyboard: arrows move the selection
    fireEvent.keyDown(container.querySelector('[data-date="2026-11-18"]')!, { key: 'ArrowRight' });
    expect(container.querySelector('[data-date="2026-11-19"]')).toHaveClass('sk-card__day--selected');
  });
  it('CD-37 calendar picker drills down in place: days → months → years → year ranges, previous / next per level', async () => {
    const { container } = setup(<Card><CalendarContent entitySet="SupplierMeetings" date="2026-11-16" now={NOW} /></Card>);
    fireEvent.click(screen.getByRole('button', { name: 'November 2026' }));
    expect(container.querySelectorAll('.sk-card__calendar-cells--months .sk-card__cell')).toHaveLength(12);
    fireEvent.click(screen.getByRole('button', { name: '2026' }));
    expect(container.querySelectorAll('.sk-card__calendar-cells--years .sk-card__cell')).toHaveLength(20);
    fireEvent.click(screen.getByRole('button', { name: '2020 – 2039' }));
    expect(container.querySelectorAll('.sk-card__calendar-cells--ranges .sk-card__cell')).toHaveLength(12);
    fireEvent.click(screen.getByRole('button', { name: '2040 – 2059' }));
    fireEvent.click(screen.getByRole('button', { name: '2046' }));
    fireEvent.click(screen.getByRole('button', { name: 'March' }));
    expect(screen.getByRole('button', { name: 'March 2046' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByRole('button', { name: 'April 2046' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Today' }));
    expect(screen.getByRole('button', { name: 'November 2026' })).toBeInTheDocument();
  });
});
