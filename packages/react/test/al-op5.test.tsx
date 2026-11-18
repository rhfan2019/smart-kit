/**
 * Stage 5, object page template (docs/31 stage 5, docs/26c §3.3): `v4/fe/templates/ObjectPage` takes the manifest
 * settings of sap.fe.templates.ObjectPage with FE's names, nesting and defaults (AL-05, AL-13).
 */
import { MantineProvider } from '@mantine/core';
import { MemoryProvider, MemoryVariantStore } from '@rhfan2019/smart-kit-core';
import { act, fireEvent, render, waitFor } from '@testing-library/react';
import { createRef, type ReactNode } from 'react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { SmartKitProvider, smartKitMantineTheme } from '../src';
import ObjectPage, { type $ObjectPageSettings } from '@rhfan2019/smart-kit/v4/fe/templates/ObjectPage';
import { creationModeOf, insertByPosition, personalizationOf, tableAggregationsOf, tableConfigurationOf } from '../src/templates/ObjectPage';
import { shopData, shopModel } from './helpers';

// The page layout's scroll spy measures the window; in jsdom `window instanceof Window` fails across realms.
// Mantine's autosize textarea (edit mode) listens to document.fonts, which jsdom does not have.
beforeAll(() => {
  (window as unknown as { getBoundingClientRect(): Partial<DOMRect> }).getBoundingClientRect = () => ({ top: 0, bottom: 0, height: 0 });
  if (!('fonts' in document)) Object.defineProperty(document, 'fonts', { configurable: true, value: { addEventListener() {}, removeEventListener() {}, ready: Promise.resolve() } });
});

function host(children: ReactNode) {
  const provider = new MemoryProvider({ model: shopModel, data: structuredClone(shopData) });
  return (
    <MantineProvider theme={smartKitMantineTheme}>
      <SmartKitProvider services={{ shop: { model: shopModel, dataProvider: provider, variants: new MemoryVariantStore() } }} locale="en" namespace="test">
        {children}
      </SmartKitProvider>
    </MantineProvider>
  );
}

const page = (p: Partial<$ObjectPageSettings> = {}) => render(host(<ObjectPage service="shop" path="Products(1)" {...p} />));
const loaded = () => waitFor(() => expect(document.querySelector('[data-sk-heading]')?.textContent).toBe('Item 1'));
const anchors = () => [...document.querySelectorAll('[data-sk-anchor]')].map((a) => a.getAttribute('data-sk-anchor'));
const layout = () => document.querySelector('[data-sk-section-layout]')?.getAttribute('data-sk-section-layout');

describe('AL-05 object page defaults equal FE 1.154 (templates/ObjectPage/Component, ManifestWrapper)', () => {
  it('AL-05 sectionLayout Page, anchor bar shown, header shown, editable header content: the "Header" section while editing', async () => {
    page();
    await loaded();
    expect(layout()).toBe('Page');
    expect(anchors()).toContain('GeneralInfo');
    expect(document.querySelector('[data-sk-facet="HeaderGeneral"]')).not.toBeNull();
    fireEvent.click(document.querySelector('[data-sk-action="Edit"]')!);
    await waitFor(() => expect(anchors()[0]).toBe('$Header'));
    // FE getShowHeaderContent: the header content is hidden while the header is edited in its section
    expect(document.querySelector('[data-sk-facet="HeaderGeneral"]')).toBeNull();
  });

  it('AL-05 sub-object tables: creation mode NewPage, Inline without a route; no data shows an illustrated message', async () => {
    expect(creationModeOf(undefined, true)).toBe('NewPage');
    expect(creationModeOf(undefined, false)).toBe('Inline');
    expect(creationModeOf({ creationMode: { name: 'CreationDialog' } }, false)).toBe('CreationDialog');
    page({ sectionLayout: 'Tabs' });
    await loaded();
    fireEvent.click(document.querySelector('[data-sk-anchor="Reviews"]')!);
    await waitFor(() => expect(document.querySelector('[data-sk-table="Reviews"] [data-sk-nodata]')).not.toBeNull());
    expect(document.querySelector('[data-sk-table="Reviews"] [data-sk-nodata] [data-sk-illustrated-message], [data-sk-table="Reviews"] [data-sk-nodata] .sk-illustrated-message')).not.toBeNull();
  });
});

describe('AL-13 object page manifest settings', () => {
  it('AL-13 sectionLayout Tabs uses the tab bar; anchorBarVisible false turns it into one page without the bar', async () => {
    const { unmount } = page({ sectionLayout: 'Tabs' });
    await loaded();
    expect(layout()).toBe('Tabs');
    unmount();
    page({ sectionLayout: 'Tabs', content: { header: { anchorBarVisible: false } } });
    await loaded();
    expect(layout()).toBe('Page');
    expect(anchors()).toEqual([]);
  });

  it('AL-13 content.header.visible false: no title and no header content', async () => {
    page({ content: { header: { visible: false } } });
    await waitFor(() => expect(document.querySelector('[data-sk-section="GeneralInfo"]')).not.toBeNull());
    expect(document.querySelector('[data-sk-heading]')).toBeNull();
    expect(document.querySelector('[data-sk-facet]')).toBeNull();
  });

  it('AL-13 editableHeaderContent false: no "Header" section while editing, the header content stays', async () => {
    page({ editableHeaderContent: false });
    await loaded();
    fireEvent.click(document.querySelector('[data-sk-action="Edit"]')!);
    await waitFor(() => expect(document.querySelector('[data-sk-save]')).not.toBeNull());
    expect(anchors()).not.toContain('$Header');
    expect(document.querySelector('[data-sk-facet="HeaderGeneral"]')).not.toBeNull();
    // V4 has no partial header edit: no "Edit Header" button
    expect(document.querySelector('[data-sk-edit-header]')).toBeNull();
  });

  it('AL-13 openInEditMode opens the page editing', async () => {
    page({ openInEditMode: true });
    await waitFor(() => expect(document.querySelector('[data-sk-save]')).not.toBeNull());
  });

  it('AL-13 content.header.facets and actions, content.footer.actions: placed by position, press gets the page context', async () => {
    const remind = vi.fn();
    const check = vi.fn();
    page({
      content: {
        header: {
          facets: { 'Custom::Contact': { title: 'Contact', template: (row) => <span>{String(row?.Code ?? '')}</span>, position: { anchor: 'HeaderGeneral', placement: 'After' } } },
          actions: { 'Custom::Remind': { text: 'Remind', press: remind, position: { anchor: 'EditAction', placement: 'Before' } } },
        },
        footer: { actions: { 'Custom::Check': { text: 'Check', press: check } } },
      },
    });
    await loaded();
    const facets = [...document.querySelectorAll('[data-sk-facet]')].map((f) => f.getAttribute('data-sk-facet'));
    expect(facets.slice(0, 2)).toEqual(['HeaderGeneral', 'Custom::Contact']);
    await waitFor(() => expect(document.querySelector('[data-sk-facet="Custom::Contact"]')).toHaveTextContent('ContactP1'));
    const titleActions = [...document.querySelectorAll('[data-sk-action]')].map((b) => b.getAttribute('data-sk-action'));
    expect(titleActions.indexOf('Custom::Remind')).toBeLessThan(titleActions.indexOf('Edit'));
    fireEvent.click(document.querySelector('[data-sk-action="Custom::Remind"]')!);
    expect(remind.mock.calls[0]![0].bindingContext.getPath()).toBe('/Products(1)');
    fireEvent.click(document.querySelector('[data-sk-footer] [data-sk-action="Custom::Check"]')!);
    expect(check).toHaveBeenCalledOnce();
  });

  it('AL-13 content.body.sections: a custom section after an anchor, an override of an annotation section, side content via showSideContent', async () => {
    const ref = createRef<ObjectPage>();
    render(host(
      <ObjectPage
        ref={ref}
        service="shop"
        path="Products(1)"
        content={{
          body: {
            sections: {
              More: { title: 'Further' },
              'Custom::Timeline': {
                title: 'Timeline',
                position: { anchor: 'GeneralInfo', placement: 'After' },
                subSections: { 'Custom::Timeline': { title: 'Timeline', template: () => <p data-test-main>main</p>, sideContent: { template: () => <p data-test-side>side</p> } } },
              },
            },
          },
        }}
      />,
    ));
    await loaded();
    expect(anchors().slice(0, 3)).toEqual(['GeneralInfo', 'Custom::Timeline', 'Reviews']);
    expect(document.querySelector('[data-sk-anchor="More"]')).toHaveTextContent('Further');
    expect(document.querySelector('[data-test-side]')).toBeNull();
    act(() => ref.current!.showSideContent('Custom::Timeline'));
    await waitFor(() => expect(document.querySelector('[data-sk-side-content="Custom::Timeline"] [data-test-side]')).not.toBeNull());
    act(() => ref.current!.showSideContent('Custom::Timeline', false));
    await waitFor(() => expect(document.querySelector('[data-test-side]')).toBeNull());
  });

  it('AL-13 controlConfiguration of a sub-object table: key with the navigation, tableSettings, columns and actions', () => {
    const settings = { controlConfiguration: { '_Review/@com.sap.vocabularies.UI.v1.LineItem#Q': { tableSettings: { creationMode: { name: 'CreationDialog' as const } } } } };
    expect(tableConfigurationOf(settings, '_Review')?.tableSettings?.creationMode?.name).toBe('CreationDialog');
    expect(tableConfigurationOf({ controlConfiguration: { '_Review/@UI.LineItem': { tableSettings: { type: 'GridTable' } } } }, '_Review')?.tableSettings?.type).toBe('GridTable');
    expect(personalizationOf(false)).toBe('false');
    expect(personalizationOf({ sort: true, column: true })).toBe('Column,Sort');
    const press = vi.fn();
    const agg = tableAggregationsOf({
      columns: { 'Custom::X': { header: 'X', position: { anchor: 'DataField::Rating', placement: 'Before' }, template: () => 'x' } },
      actions: { 'Custom::A': { text: 'A', press, requiresSelection: true }, menu: { text: 'More', menu: ['Custom::A'] } },
    });
    expect(agg.columns?.[0]).toMatchObject({ key: 'Custom::X', anchor: 'DataField::Rating', placement: 'Before' });
    expect(agg.actions?.[0]).toMatchObject({ key: 'Custom::A', requiresSelection: true });
    expect(agg.actionGroups).toEqual([{ id: 'menu', label: 'More', actions: ['Custom::A'] }]);
  });

  it('AL-13 positions as FE insertCustomElements: no anchor = after the last ("Before": first); overrides by key; chained anchors', () => {
    const items = ['a', 'b'].map((key) => ({ key }));
    const out = insertByPosition(items, {
      c: { position: { anchor: 'd', placement: 'After' } },
      d: { position: { anchor: 'a', placement: 'After' } },
      e: { position: { placement: 'Before' } },
      f: {},
      b: {},
    }, (key) => ({ key }), (item) => ({ ...item, key: item.key }));
    expect(out.map((x) => x.key)).toEqual(['e', 'a', 'd', 'c', 'b', 'f']);
  });
});
