/** Value display in cells and forms (docs/29 §5, stage 4): sap.fe.macros.Field display styles as Fiori elements 1.154. */
import { MantineProvider } from '@mantine/core';
import { buildModel, MemoryProvider, MemoryVariantStore, type NavigationAdapter, type Row } from '@rhfan2019/smart-kit-core';
import { fireEvent, render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { SmartKitProvider, smartKitMantineTheme } from '../src';
import Field from '../src/v4/fe/macros/Field';

const model = buildModel(readFileSync(join(import.meta.dirname, '../../core/test/fixtures/display4.xml'), 'utf8'));
const ui = model.ui['D.Contact']!;
const col = (id: string) => ui.lineItem.find((c) => c.id === id)!;
const row: Row = {
  UUID: '5c0a0001-0d4e-4f00-8a00-000000001eef', ID: 'C000001', Name: 'Jamie Whitcombe', Title: 'Sales Manager', Email: 'jamie@x.example', Phone: '+14 421 4719',
  Site: 'https://www.x.example/', Iban: 'DE31792494', At: '2026-10-18T14:30:00Z', Zone: 'Europe/Berlin', Score: 2.001, Rate: 6.8, RateCrit: 1, Done: 2, Ref: '0000100001',
  'Doc@odata.mediaContentType': 'application/pdf', 'Doc@odata.mediaReadLink': 'Contacts(1)/Doc', DocName: 'offer.pdf',
};

function wrap(children: ReactNode, navigation?: NavigationAdapter) {
  const provider = new MemoryProvider({ model, data: { Contacts: [row], Statuses: [] } });
  return (
    <MantineProvider theme={smartKitMantineTheme}>
      <SmartKitProvider services={{ d: { model, dataProvider: provider, variants: new MemoryVariantStore() } }} locale="en" namespace="test" navigation={navigation}>
        {children}
      </SmartKitProvider>
    </MantineProvider>
  );
}
let n = 0;
const cell = (id: string, r: Row = row, navigation?: NavigationAdapter) => {
  const testId = `${id}-${++n}`;
  render(wrap(<span data-testid={testId}><Field contextPath="/Contacts" metaPath={col(id)} row={r} cell /></span>, navigation));
  return screen.getByTestId(testId);
};

describe('AL-12 display4: links (FE DisplayStyle getLinkTemplate)', () => {
  it('AL-12 display4 Communication.IsEmailAddress is a mailto: link, IsPhoneNumber a tel: link', () => {
    expect(cell('DataField::Email').querySelector('a')!.getAttribute('href')).toBe('mailto:jamie@x.example');
    expect(cell('DataField::Phone').querySelector('a')!.getAttribute('href')).toBe('tel:+14 421 4719');
  });
  it('AL-12 display4 D41: DataFieldWithUrl opens in the same window ("_top") unless HTML5.LinkTarget says otherwise', () => {
    expect(cell('DataField::Site').querySelector('a')!.getAttribute('target')).toBe('_top');
    expect(cell('Blank').querySelector('a')!.getAttribute('target')).toBe('_blank');
  });
  it('AL-12 display4 D41: Core.IsURL alone is no link', () => {
    render(wrap(<span data-testid="u"><Field contextPath="/Contacts" metaPath="Site" row={row} /></span>));
    expect(screen.getByTestId('u').querySelector('a')).toBeNull();
    expect(screen.getByTestId('u').textContent).toBe('https://www.x.example/');
  });
  it('AL-12 display4 scripts are never a link target', () => {
    expect(cell('DataField::Site', { ...row, Site: 'javascript:alert(1)' }).querySelector('a')).toBeNull();
  });
});

describe('AL-12 display4: values', () => {
  it('AL-12 display4 Common.ExternalID shows the readable ID instead of the GUID', () => {
    expect(cell('DataField::UUID').textContent).toBe('C000001');
  });
  it('AL-12 display4 Common.Masked shows one "*" per character', () => {
    expect(cell('DataField::Iban').textContent).toBe('**********');
  });
  it('AL-12 display4 Common.Timezone / IsTimezone (DateTimeWithTimezone)', () => {
    expect(cell('DataField::At').textContent!.replace(/\u202f/g, ' ')).toBe('Oct 18, 2026, 4:30:00 PM Europe, Berlin');
    expect(cell('DataField::Zone').textContent).toBe('Europe, Berlin');
  });
  it('AL-12 display4 DataPoint ValueFormat/NumberOfFractionalDigits in a cell', () => {
    expect(cell('DataFieldForAnnotation::UI.DataPoint#Score').textContent).toBe('2.0');
  });
  it('AL-12 display4 DV-FE-06 progress: "6.8 %" with a static % unit, "2 of 8" without unit; state from the Criticality', () => {
    const rate = cell('DataFieldForAnnotation::UI.DataPoint#Rate');
    expect(rate.textContent).toBe('6.8 %');
    expect(rate.querySelector('.sk-progress--negative')).not.toBeNull();
    const done = cell('DataFieldForAnnotation::UI.DataPoint#Done');
    expect(done.textContent).toBe('2 of 8');
    expect(done.querySelector('[class*="sk-progress--"]')).toBeNull();
  });
  it('AL-12 display4 D41: VeryPositive has no colour and no icon', () => {
    const c = cell('DataField::Name');
    expect(c.querySelector('.sk-status--positive')).toBeNull();
    expect(c.querySelector('svg')).toBeNull();
  });
  it('AL-12 display4 Edm.Stream: a download link named by Core.ContentDisposition/Filename; nothing without content', () => {
    const a = cell('DataField::Doc').querySelector('a')!;
    expect(a.getAttribute('href')).toBe('Contacts(1)/Doc');
    expect(a.textContent).toBe('offer.pdf');
    expect(cell('DataField::Doc', { ...row, UUID: 'x', 'Doc@odata.mediaContentType': null }).textContent).toBe('');
  });
});

describe('AL-12 display4: contact and smart links', () => {
  it('AL-12 display4 Communication.Contact: the name opens a popover with job title and e-mail', async () => {
    const c = cell('DataFieldForAnnotation::Contact');
    expect(c.textContent).toBe('Jamie Whitcombe');
    fireEvent.click(c.querySelector('[data-sk-contact-link]')!);
    const pop = await screen.findByRole('dialog');
    expect(pop.textContent).toContain('Sales Manager');
    expect(pop.querySelector('a[href="mailto:jamie@x.example"]')).not.toBeNull();
  });
  it('AL-12 display4 D42 Common.SemanticObject: plain text without targets (as FE without a launchpad target)', () => {
    expect(cell('DataField::Ref').querySelector('a, button')).toBeNull();
  });
  it('AL-12 display4 D42 Common.SemanticObject: one target from NavigationAdapter.semanticTargets is a direct link, several a popover', async () => {
    const one: NavigationAdapter = { toObject() {}, toList() {}, semanticTargets: (r) => (r.semanticObject === 'Supplier' ? [{ text: 'Display Supplier', href: `/suppliers/${String(r.row.Ref)}` }] : []) };
    expect(cell('DataField::Ref', row, one).querySelector('a')!.getAttribute('href')).toBe('/suppliers/0000100001');
  });
  it('AL-12 display4 D42 Common.SemanticObject: several targets are listed in a popover', async () => {
    const two: NavigationAdapter = { toObject() {}, toList() {}, semanticTargets: () => [{ text: 'Display Supplier', href: '/a' }, { text: 'Supplier Orders', href: '/b' }] };
    const c = cell('DataField::Ref', row, two);
    fireEvent.click(c.querySelector('[data-sk-semantic-link]')!);
    const pop = await screen.findByRole('dialog');
    expect([...pop.querySelectorAll('a')].map((a) => a.textContent)).toEqual(['Display Supplier', 'Supplier Orders']);
  });
  it('AL-12 display4 D42 DataFieldWithIntentBasedNavigation: the target of the intent\'s action is a direct link; without it plain text', () => {
    const f = { ...col('DataField::Name'), criticality: undefined, intent: { semanticObject: 'Contact', action: 'display' } };
    const nav: NavigationAdapter = { toObject() {}, toList() {}, semanticTargets: () => [{ text: 'Edit', href: '/edit', action: 'edit' }, { text: 'Display', href: '/display', action: 'display' }] };
    render(wrap(<span data-testid="ibn"><Field contextPath="/Contacts" metaPath={f} row={row} /></span>, nav));
    expect(screen.getByTestId('ibn').querySelector('a')!.getAttribute('href')).toBe('/display');
    render(wrap(<span data-testid="ibn2"><Field contextPath="/Contacts" metaPath={f} row={row} /></span>));
    expect(screen.getByTestId('ibn2').querySelector('a')).toBeNull();
  });
});
