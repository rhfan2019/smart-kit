/** Issues found by the first consumer (docs/25): texts, view saving, export, refresh, object page options. */
import { MantineProvider } from '@mantine/core';
import { buildModel, MemoryProvider, MemoryVariantStore, type MetaModel, type Variant, type VariantStore } from '@rhfan2019/smart-kit-core';
import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { createRef, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { createText, SmartKitProvider, smartKitMantineTheme } from '../src';
import { SmartObjectPage } from '@rhfan2019/smart-kit/templates';
import useVariants from '@rhfan2019/smart-kit/kit/useVariants';
import Table from '../src/v4/fe/macros/Table';
import VariantManagement from '../src/v4/fe/macros/VariantManagement';
import { typedText } from '../src/i18n/text';
import { zh } from '../src/i18n/messages.zh';
import { exportRows } from '../src/table/exportRows';
import { shopData, shopModel } from './helpers';

function host(children: ReactNode, o: { variants?: VariantStore; model?: MetaModel; provider?: MemoryProvider } = {}) {
  const model = o.model ?? shopModel;
  const provider = o.provider ?? new MemoryProvider({ model, data: structuredClone(shopData) });
  return (
    <MantineProvider theme={smartKitMantineTheme}>
      <SmartKitProvider services={{ shop: { model, dataProvider: provider, variants: o.variants ?? new MemoryVariantStore() } }} locale="en" namespace="test">
        {children}
      </SmartKitProvider>
    </MantineProvider>
  );
}

describe('texts name the record type, never "object" (S22)', () => {
  it('typed and neutral variants', () => {
    const t = createText('zh');
    expect(typedText(t, 'create.done', '用户')).toBe('用户已创建。');
    expect(typedText(t, 'object.notFound', '用户')).toBe('没有这个用户。');
    expect(typedText(t, 'edit.conflict', '用户')).toBe('这个用户已被别人改过，请重新加载后再试。');
    expect(typedText(t, 'create.done', undefined)).toBe('已创建。');
    expect(typedText(createText('en'), 'object.loadError', 'User', { message: 'x' })).toBe('Could not load the User: x');
  });
  it('no Chinese message says 对象 (except the SAP card type name)', () => {
    const hits = Object.entries(zh).filter(([k, v]) => k !== 'card.typeObject' && JSON.stringify(v).includes('对象')).map(([k]) => k);
    expect(hits).toEqual([]);
  });
});

function Views(p: { content?: Variant['content']; canSave?: boolean }) {
  const v = useVariants('page', { service: 'shop', standard: { filters: {} } });
  return <VariantManagement variants={v} content={p.content ?? { filters: { Status: [{ operator: 'EQ', values: ['A'] }] } }} onSelect={() => undefined} creationAllowed={p.canSave} />;
}

describe('view saving (S15, S18)', () => {
  it('a failed Save As shows the store error in the dialog, which stays open; the menu closes first', async () => {
    const store = new MemoryVariantStore();
    store.save = async () => { throw new Error('Missing permission list.view:save'); };
    render(host(<Views />, { variants: store }));
    fireEvent.click(screen.getByTitle('Select view'));
    fireEvent.click(await screen.findByText('Save As'));
    await waitFor(() => expect(document.querySelector('[data-sk-variant-saveas]')).toBeNull()); // menu closed (S18)
    fireEvent.change(screen.getByLabelText(/^View/), { target: { value: 'Mine' } });
    fireEvent.click(document.querySelector('[data-sk-variant-saveas-ok]')!);
    expect(await screen.findByRole('alert')).toHaveTextContent('The view could not be saved: Missing permission list.view:save');
    expect(document.querySelector('[data-sk-variant-saveas-ok]')).not.toBeNull();
  });

  it('canSave false (store) or creationAllowed false: the menu only selects views', async () => {
    const store = Object.assign(new MemoryVariantStore(), { canSave: false });
    render(host(<Views />, { variants: store }));
    fireEvent.click(screen.getByTitle('Select view'));
    await screen.findByText('My Views');
    expect(document.querySelector('[data-sk-variant-saveas]')).toBeNull();
    expect(document.querySelector('[data-sk-variant-manage]')).toBeNull();
    expect(document.querySelector('[data-sk-variant-modified]')).toBeNull();
  });

  it('useVariants exposes canSave', () => {
    const { result } = renderHook(() => useVariants('p', { service: 'shop', standard: { filters: {} } }), { wrapper: ({ children }) => host(children) });
    expect(result.current.canSave).toBe(true);
  });
});

describe('export (S4)', () => {
  it('before() sees the exported count; false writes no file', async () => {
    const provider = new MemoryProvider({ model: shopModel, data: structuredClone(shopData) });
    const write = vi.fn(async () => undefined);
    const base = { service: { name: 'shop', model: shopModel, dataProvider: provider }, typeName: 'Shop.Product', columns: [{ id: 'Code', label: 'Code' }], title: 'Products', limit: 10, locale: 'en-US', t: createText('en'), write };
    const pageRequest = (skip: number, top: number, count: boolean) => ({ source: { entitySet: 'Products' }, select: ['ID', 'Code'], expand: [], orderBy: [], skip, top, count });
    const before = vi.fn(async () => false);
    const r = await exportRows({ ...base, pageRequest, before } as never);
    expect(before).toHaveBeenCalledWith({ count: 10, truncated: true });
    expect(r.cancelled).toBe(true);
    expect(write).not.toHaveBeenCalled();
    await exportRows({ ...base, pageRequest, before: async () => true } as never);
    expect(write).toHaveBeenCalledTimes(1);
  });

  it('enableExport false removes the button; onBeforeExport gets filters and the row count', async () => {
    const { unmount } = render(host(<Table service="shop" contextPath="/Products" enableExport={false} />));
    await screen.findAllByText('P1');
    expect(document.querySelector('[data-sk-table-export]')).toBeNull();
    unmount();
    const onBeforeExport = vi.fn(() => false);
    const onExported = vi.fn();
    const query = { filters: { CategoryID: [{ operator: 'EQ' as const, values: ['C1'] }] }, search: '' };
    render(host(<Table service="shop" contextPath="/Products" query={query} onBeforeExport={onBeforeExport} onExported={onExported} />));
    await screen.findAllByText('P2');
    fireEvent.click(document.querySelector('[data-sk-table-export]')!);
    await waitFor(() => expect(onBeforeExport).toHaveBeenCalled());
    const e = onBeforeExport.mock.calls[0]![0] as unknown as { rowCount: number; filters: unknown; entitySet: string };
    expect(e.entitySet).toBe('Products');
    expect(e.filters).toEqual(query.filters);
    expect(e.rowCount).toBe(12); // products 2, 4, …, 24 are in C1
    expect(onExported).not.toHaveBeenCalled();
  });
});

describe('refresh (S16)', () => {
  it('ref refresh() reloads rows the host replaced', async () => {
    const provider = new MemoryProvider({ model: shopModel, data: structuredClone(shopData) });
    const ref = createRef<Table>();
    const view = () => host(<Table ref={ref} service="shop" contextPath="/Products" type="ResponsiveTable" />, { provider });
    const { rerender } = render(view());
    await screen.findByText('P1');
    provider.setRows('Products', [{ ...shopData.Products![0]!, Code: 'NEW1' }]);
    rerender(view());
    expect(screen.queryByText('NEW1')).toBeNull();
    act(() => ref.current!.refresh());
    expect(await screen.findByText('NEW1')).toBeInTheDocument();
  });
});

const PERSON = `<?xml version="1.0" encoding="utf-8"?>
<edmx:Edmx Version="4.0" xmlns:edmx="http://docs.oasis-open.org/odata/ns/edmx">
  <edmx:Reference Uri="https://sap.github.io/odata-vocabularies/vocabularies/UI.xml"><edmx:Include Namespace="com.sap.vocabularies.UI.v1" Alias="UI"/></edmx:Reference>
  <edmx:Reference Uri="https://sap.github.io/odata-vocabularies/vocabularies/Communication.xml"><edmx:Include Namespace="com.sap.vocabularies.Communication.v1" Alias="Communication"/></edmx:Reference>
  <edmx:DataServices>
    <Schema Namespace="People" xmlns="http://docs.oasis-open.org/odata/ns/edm">
      <EntityType Name="Person"><Key><PropertyRef Name="ID"/></Key><Property Name="ID" Type="Edm.String" Nullable="false"/><Property Name="Name" Type="Edm.String"/></EntityType>
      <EntityContainer Name="C"><EntitySet Name="People" EntityType="People.Person"/></EntityContainer>
      <Annotations Target="People.Person">
        <Annotation Term="Communication.Contact"><Record><PropertyValue Property="fn" Path="Name"/></Record></Annotation>
        <Annotation Term="UI.HeaderInfo"><Record Type="UI.HeaderInfoType">
          <PropertyValue Property="TypeName" String="User"/><PropertyValue Property="TypeNamePlural" String="Users"/>
          <PropertyValue Property="Title"><Record Type="UI.DataField"><PropertyValue Property="Value" Path="Name"/></Record></PropertyValue>
        </Record></Annotation>
        <Annotation Term="UI.Facets"><Collection/></Annotation>
      </Annotations>
    </Schema>
  </edmx:DataServices>
</edmx:Edmx>`;

describe('object page (S19, S21, S22)', () => {
  const model = buildModel(PERSON);
  const provider = () => new MemoryProvider({ model, data: { People: [{ ID: '1', Name: 'Ada Lovelace' }] } });

  it('a person without an image gets a round initials avatar; share can be hidden', async () => {
    expect(model.ui['People.Person']!.headerInfo).toMatchObject({ person: true });
    render(host(<SmartObjectPage service="shop" path="People('1')" share={false} />, { model, provider: provider() }));
    await waitFor(() => expect(document.querySelector('[data-sk-avatar-initials]')?.getAttribute('data-sk-avatar-initials')).toBe('AL'));
    expect(screen.queryByText('Share')).toBeNull();
  });

  it('not found names the type', async () => {
    render(host(<SmartObjectPage service="shop" path="People('9')" />, { model, provider: provider() }));
    expect(await screen.findByText('This User does not exist.')).toBeInTheDocument();
  });

});

