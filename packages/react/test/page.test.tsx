/** Page group (ADR-033, stage 2): DynamicPage, FlexibleColumnLayout, ObjectPageLayout, AnchorBar, GenericTag, KPITag, Paginator. */
import { fireEvent, render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import DynamicPage from '../src/f/DynamicPage';
import DynamicPageHeader from '../src/f/DynamicPageHeader';
import DynamicPageTitle from '../src/f/DynamicPageTitle';
import FlexibleColumnLayout from '../src/f/FlexibleColumnLayout';
import type { FlexibleColumnLayout as FclInstance } from '../src/layout/FlexibleColumnLayout';
import GenericTag from '../src/m/GenericTag';
import AnchorBar from '../src/uxap/AnchorBar';
import ObjectPageDynamicHeaderTitle from '../src/uxap/ObjectPageDynamicHeaderTitle';
import ObjectPageLayout from '../src/uxap/ObjectPageLayout';
import type { ObjectPageLayout as OplInstance } from '../src/object/ObjectPageLayout';
import FlexibleColumnLayoutActions from '../src/v4/fe/macros/fcl/FlexibleColumnLayoutActions.block';
import KPITag from '../src/v4/fe/macros/KPITag';
import Paginator from '../src/v4/fe/macros/Paginator';
import { MantineProvider } from '@mantine/core';
import { buildModel, MemoryProvider, MemoryVariantStore } from '@rhfan2019/smart-kit-core';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ReactNode } from 'react';
import { SmartKitProvider } from '../src/context/SmartKitProvider';
import { smartKitMantineTheme } from '../src/theme/mantine';

// The modules are imported by their own paths (ADR-033); the root entry is not needed here.
const model = buildModel(readFileSync(join(import.meta.dirname, '../../core/test/fixtures/shop.xml'), 'utf8'));
const wrap = (children: ReactNode) => (
  <MantineProvider theme={smartKitMantineTheme}>
    <SmartKitProvider services={{ shop: { model, dataProvider: new MemoryProvider({ model, data: {} }), variants: new MemoryVariantStore() } }} locale="en" namespace="test">
      {children}
    </SmartKitProvider>
  </MantineProvider>
);

const page = (props: Partial<Parameters<typeof DynamicPage>[0]> = {}, title: Partial<Parameters<typeof DynamicPageTitle>[0]> = {}) => (
  <DynamicPage
    title={<DynamicPageTitle heading="Orders" {...title} />}
    header={<DynamicPageHeader><p>filters</p></DynamicPageHeader>}
    content={<p>content</p>}
    footer={<p>footer</p>}
    {...props}
  />
);

describe('DynamicPage', () => {
  it('AL-05 DynamicPage: header expanded, footer hidden without showFooter, snaps on scroll (pin offered)', () => {
    const { rerender } = render(wrap(page()));
    expect(screen.getByText('filters')).toBeInTheDocument();
    expect(screen.queryByText('footer')).toBeNull();
    expect(screen.getByRole('button', { name: 'Pin Header' })).toBeInTheDocument();
    rerender(wrap(page({ showFooter: true, preserveHeaderStateOnScroll: true })));
    expect(screen.getByText('footer')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Pin Header' })).toBeNull();
  });

  it('AL-05 DynamicPageHeader: pinnable false hides the pin button', () => {
    render(wrap(<DynamicPage title={<DynamicPageTitle heading="Orders" />} header={<DynamicPageHeader pinnable={false}><p>filters</p></DynamicPageHeader>} />));
    expect(screen.queryByRole('button', { name: 'Pin Header' })).toBeNull();
  });

  it('AL-06 DynamicPageTitle: stateChange has isExpanded; the title click toggles unless toggleHeaderOnTitleClick is false', () => {
    const onStateChange = vi.fn();
    const { rerender } = render(wrap(page({}, { onStateChange, expandedContent: 'expanded only', snappedContent: 'snapped only' })));
    expect(screen.getByText('expanded only')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('heading', { name: 'Orders' }));
    expect(onStateChange).toHaveBeenLastCalledWith({ isExpanded: false });
    expect(screen.getByText('snapped only')).toBeInTheDocument();
    expect(screen.queryByText('expanded only')).toBeNull();
    rerender(wrap(page({ toggleHeaderOnTitleClick: false }, { onStateChange })));
    onStateChange.mockClear();
    fireEvent.click(screen.getByRole('heading', { name: 'Orders' }));
    expect(onStateChange).not.toHaveBeenCalled();
  });

  it('AL-06 DynamicPage: pinnedStateChange has pinned', () => {
    const onPinnedStateChange = vi.fn();
    render(wrap(page({ onPinnedStateChange })));
    fireEvent.click(screen.getByRole('button', { name: 'Pin Header' }));
    expect(onPinnedStateChange).toHaveBeenCalledWith({ pinned: true });
  });

  it('AL-05 DynamicPage: headerExpanded false starts collapsed', () => {
    render(wrap(page({ headerExpanded: false })));
    expect(screen.queryByText('filters')).toBeNull();
  });
});

describe('FlexibleColumnLayout', () => {
  const fcl = (layout: Parameters<typeof FlexibleColumnLayout>[0]['layout'], onStateChange = vi.fn(), ref?: React.Ref<FclInstance>) => wrap(
    <FlexibleColumnLayout
      ref={ref} layout={layout} onStateChange={onStateChange}
      beginColumnPages={<p>list</p>}
      midColumnPages={<DynamicPage title={<DynamicPageTitle heading="Object" navigationActions={<><Paginator /><FlexibleColumnLayoutActions /></>} />} />}
      midPaging={{ onNext: () => undefined }}
    />,
  );

  it('AL-05 FlexibleColumnLayout: layout OneColumn', () => {
    const { container } = render(wrap(<FlexibleColumnLayout beginColumnPages={<p>list</p>} />));
    expect(container.querySelector('[data-sk-fcl]')).toHaveAttribute('data-sk-fcl', 'OneColumn');
  });

  it('AL-06 FlexibleColumnLayout: stateChange from FlexibleColumnLayoutActions and the arrows', () => {
    const onStateChange = vi.fn();
    render(fcl('TwoColumnsMidExpanded', onStateChange));
    fireEvent.click(screen.getByRole('button', { name: 'Enter Full Screen Mode' }));
    expect(onStateChange).toHaveBeenLastCalledWith({ layout: 'MidColumnFullScreen', maxColumnsCount: 3, isNavigationArrow: false, isResize: false });
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onStateChange).toHaveBeenLastCalledWith(expect.objectContaining({ layout: 'OneColumn' }));
    fireEvent.click(screen.getByRole('button', { name: 'Expand the first column' }));
    expect(onStateChange).toHaveBeenLastCalledWith(expect.objectContaining({ layout: 'TwoColumnsBeginExpanded', isNavigationArrow: true }));
  });

  it('AL-07 FlexibleColumnLayout: getMaxColumnsCount', () => {
    const ref = createRef<FclInstance>();
    render(fcl('TwoColumnsMidExpanded', vi.fn(), ref));
    expect(ref.current?.getMaxColumnsCount()).toBe(3);
  });

  it('Paginator uses the column paging; a missing direction is disabled', () => {
    render(fcl('TwoColumnsMidExpanded'));
    expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
  });
});

describe('ObjectPageLayout', () => {
  const sections = [
    { id: 'General', title: 'General', subSections: [{ id: 'a', title: 'A', content: <p>A content</p> }, { id: 'b', title: 'B', content: <p>B content</p> }] },
    { id: 'Items', title: 'Items', subSections: [{ id: 'items', title: 'Items', content: <p>Items content</p> }] },
  ];

  it('AL-06 ObjectPageLayout: beforeNavigate can prevent navigate; navigate and sectionChange have section', () => {
    const onNavigate = vi.fn();
    const onSectionChange = vi.fn();
    const prevent = vi.fn((e: { preventDefault(): void }) => e.preventDefault());
    const { rerender } = render(wrap(<ObjectPageLayout scope="t" sections={sections} useIconTabBar headerTitle={<ObjectPageDynamicHeaderTitle heading="Order" />} onNavigate={onNavigate} onSectionChange={onSectionChange} onBeforeNavigate={prevent} />));
    fireEvent.click(screen.getByRole('tab', { name: 'Items' }));
    expect(prevent).toHaveBeenCalledWith(expect.objectContaining({ section: 'Items' }));
    expect(onNavigate).not.toHaveBeenCalled();
    rerender(wrap(<ObjectPageLayout scope="t" sections={sections} useIconTabBar headerTitle={<ObjectPageDynamicHeaderTitle heading="Order" />} onNavigate={onNavigate} onSectionChange={onSectionChange} />));
    fireEvent.click(screen.getByRole('tab', { name: 'Items' }));
    expect(onNavigate).toHaveBeenCalledWith({ section: 'Items', subSection: undefined });
    expect(onSectionChange).toHaveBeenCalledWith({ section: 'Items' });
    expect(screen.getByText('Items content')).toBeInTheDocument();
  });

  it('AL-05 ObjectPageLayout: anchors in upper case, edit header button only with showEditHeaderButton', () => {
    const onEditHeaderButtonPress = vi.fn();
    // tabs: the anchor scroll spy needs a real layout (not jsdom)
    const { container, rerender } = render(wrap(<ObjectPageLayout scope="t" sections={sections} useIconTabBar headerContent={<p>facets</p>} />));
    expect(container.querySelector('.sk-anchorbar')).toHaveClass('sk-anchorbar--upper');
    expect(container.querySelector('[data-sk-edit-header]')).toBeNull();
    rerender(wrap(<ObjectPageLayout scope="t" sections={sections} useIconTabBar headerContent={<p>facets</p>} upperCaseAnchorBar={false} showEditHeaderButton onEditHeaderButtonPress={onEditHeaderButtonPress} />));
    expect(container.querySelector('.sk-anchorbar')).not.toHaveClass('sk-anchorbar--upper');
    fireEvent.click(container.querySelector('[data-sk-edit-header]')!);
    expect(onEditHeaderButtonPress).toHaveBeenCalled();
  });

  it('AL-07 ObjectPageLayout: getScrollingSectionId', () => {
    const ref = createRef<OplInstance>();
    render(wrap(<ObjectPageLayout ref={ref} scope="t" sections={sections} useIconTabBar selectedSection="Items" />));
    expect(ref.current?.getScrollingSectionId()).toBe('Items');
  });
});

describe('AnchorBar, GenericTag, KPITag', () => {
  it('AL-05 AnchorBar: showPopover offers the subsection menu; upperCase off', () => {
    const items = [{ id: 'a', title: 'General', subSections: [{ id: 'x', title: 'One' }, { id: 'y', title: 'Two' }] }];
    const { container, rerender } = render(wrap(<AnchorBar content={items} selectedButton="a" />));
    expect(container.querySelector('[data-sk-anchor-menu="a"]')).not.toBeNull();
    expect(container.querySelector('.sk-anchorbar')).not.toHaveClass('sk-anchorbar--upper');
    rerender(wrap(<AnchorBar content={items} selectedButton="a" showPopover={false} />));
    expect(container.querySelector('[data-sk-anchor-menu="a"]')).toBeNull();
  });

  it('AL-05 GenericTag: status None without icon, StatusIconHidden, valueState Error', () => {
    const { container, rerender } = render(wrap(<GenericTag text="Status" value="Overdue" />));
    expect(container.querySelector('[data-sk-generic-tag]')).toHaveAttribute('data-sk-generic-tag', 'None');
    expect(container.querySelector('svg')).toBeNull();
    rerender(wrap(<GenericTag text="Status" value="Overdue" status="Error" />));
    expect(container.querySelector('.sk-generic-tag--negative svg')).not.toBeNull();
    rerender(wrap(<GenericTag text="Status" value="Overdue" status="Error" design="StatusIconHidden" />));
    expect(container.querySelector('svg')).toBeNull();
    rerender(wrap(<GenericTag text="Status" value="Overdue" valueState="Error" />));
    expect(screen.queryByText('Overdue')).toBeNull();
    expect(container.querySelector('[data-sk-generic-tag-error]')).not.toBeNull();
  });

  it('AL-05 KPITag: number and unit, no icon unless showIcon', () => {
    const { container, rerender } = render(wrap(<KPITag text="Revenue" number="42" unit="EUR" status="Success" />));
    expect(screen.getByText('42 EUR')).toBeInTheDocument();
    expect(container.querySelector('svg')).toBeNull();
    rerender(wrap(<KPITag text="Revenue" number="42" unit="EUR" status="Success" showIcon />));
    expect(container.querySelector('svg')).not.toBeNull();
  });
});
