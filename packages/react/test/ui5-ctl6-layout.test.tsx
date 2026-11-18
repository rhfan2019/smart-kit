/** Stage 6 (ctl6 layout): landmarkInfo of DynamicPage / ObjectPageLayout / FlexibleColumnLayout, FCL autoFocus and separator resizing. */
import { MantineProvider } from '@mantine/core';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import DynamicPage from '../src/f/DynamicPage';
import DynamicPageAccessibleLandmarkInfo from '../src/f/DynamicPageAccessibleLandmarkInfo';
import DynamicPageHeader from '../src/f/DynamicPageHeader';
import DynamicPageTitle from '../src/f/DynamicPageTitle';
import FlexibleColumnLayout from '../src/f/FlexibleColumnLayout';
import FlexibleColumnLayoutAccessibleLandmarkInfo from '../src/f/FlexibleColumnLayoutAccessibleLandmarkInfo';
import type { LayoutType } from '../src/layout/FlexibleColumnLayout';
import ObjectPageAccessibleLandmarkInfo from '../src/uxap/ObjectPageAccessibleLandmarkInfo';
import ObjectPageDynamicHeaderTitle from '../src/uxap/ObjectPageDynamicHeaderTitle';
import ObjectPageLayout from '../src/uxap/ObjectPageLayout';
import { SmartKitProvider } from '../src/context/SmartKitProvider';
import { smartKitMantineTheme } from '../src/theme/mantine';

const wrap = (children: ReactNode) => (
  <MantineProvider theme={smartKitMantineTheme}>
    <SmartKitProvider services={{}} locale="en" namespace="test">{children}</SmartKitProvider>
  </MantineProvider>
);

const page = (landmarkInfo?: ReactNode) => wrap(
  <DynamicPage
    title={<DynamicPageTitle heading="Orders" />}
    header={<DynamicPageHeader><p>filters</p></DynamicPageHeader>}
    content={<p>content</p>}
    footer={<p>footer</p>}
    showFooter
    preserveHeaderStateOnScroll
    landmarkInfo={landmarkInfo}
  />,
);

const sections = [
  { id: 'General', title: 'General', subSections: [{ id: 'a', title: 'A', content: <p>A content</p> }] },
  { id: 'Items', title: 'Items', subSections: [{ id: 'items', title: 'Items', content: <p>Items content</p> }] },
];
const object = (landmarkInfo?: ReactNode, content?: ReactNode) => wrap(
  <ObjectPageLayout
    scope="t" sections={content ? [{ id: 'X', title: 'X', subSections: [{ id: 'x', title: 'X', content }] }] : sections} useIconTabBar
    headerTitle={<ObjectPageDynamicHeaderTitle heading="Order" />} headerContent={<p>facets</p>} footer={<p>footer</p>} showFooter
    landmarkInfo={landmarkInfo}
  />,
);

describe('landmarkInfo (sap.f.DynamicPageAccessibleLandmarkInfo, sap.uxap.ObjectPageAccessibleLandmarkInfo)', () => {
  it('AL-05 DynamicPage: without landmarkInfo an article with the role description, a header labelled with the title, no roles', () => {
    const { container } = render(page());
    const root = container.querySelector('.sk-dynamic-page')!;
    expect(root.tagName).toBe('ARTICLE');
    expect(root).toHaveAttribute('aria-roledescription', 'Dynamic Page');
    expect(root).not.toHaveAttribute('role');
    const header = container.querySelector('.sk-dynamic-page__sticky')!;
    expect(header.tagName).toBe('HEADER');
    expect(header).toHaveAttribute('aria-label', 'Orders');
    expect(screen.getByRole('region', { name: 'Expanded header' })).toHaveTextContent('filters');
    expect(container.querySelector('.sk-dynamic-page__content')).not.toHaveAttribute('role');
    expect(container.querySelector('.sk-dynamic-page__footer')!.tagName).toBe('FOOTER');
  });

  it('AL-05 DynamicPageAccessibleLandmarkInfo: all roles None by default (no landmarks, no header label)', () => {
    const { container } = render(page(<DynamicPageAccessibleLandmarkInfo />));
    const header = container.querySelector('.sk-dynamic-page__sticky')!;
    expect(header.tagName).toBe('HEADER');
    expect(header).not.toHaveAttribute('aria-label');
    expect(container.querySelector('.sk-dynamic-page')).not.toHaveAttribute('role');
  });

  it('AL-05 DynamicPageAccessibleLandmarkInfo: roles and labels on root, header, header content, content and footer', () => {
    const { container } = render(page(
      <DynamicPageAccessibleLandmarkInfo rootRole="Region" rootLabel="Page" headerRole="Banner" contentRole="Main" contentLabel="Body" footerRole="Region" footerLabel="Actions" headerContentLabel="Filters" />,
    ));
    expect(screen.getByRole('region', { name: 'Page' })).toHaveClass('sk-dynamic-page');
    const header = screen.getByRole('banner');
    expect(header.tagName).toBe('DIV');
    expect(header).toHaveAttribute('aria-label', 'Orders'); // no headerLabel: the title text
    expect(screen.getByRole('region', { name: 'Filters' })).toHaveTextContent('filters');
    expect(screen.getByRole('main', { name: 'Body' })).toHaveTextContent('content');
    expect(screen.getByRole('region', { name: 'Actions' }).tagName).toBe('DIV');
    expect(container.querySelector('footer')).toBeNull();
  });

  it('AL-05 ObjectPageLayout: without landmarkInfo main, banner and region with the default labels', () => {
    const { container } = render(object());
    expect(screen.getByRole('main', { name: 'Object details Object Page' })).toHaveClass('sk-dynamic-page');
    const header = screen.getByRole('banner', { name: 'Order Header area Object Page Header' });
    expect(header.tagName).toBe('HEADER');
    expect(container.querySelector('.sk-anchorbar')!.tagName).toBe('NAV');
    expect(container.querySelector('.sk-anchorbar')).toHaveAttribute('aria-label', 'Sections');
    expect(screen.getByRole('region', { name: 'General Actions for Object Page' }).tagName).toBe('FOOTER');
    expect(container.querySelector('.sk-dynamic-page')).not.toHaveAttribute('aria-roledescription');
  });

  it('AL-05 ObjectPageAccessibleLandmarkInfo: defaults Main, Banner, Navigation, Region; None removes the landmark', () => {
    const { container, rerender } = render(object(<ObjectPageAccessibleLandmarkInfo />));
    expect(screen.getByRole('main', { name: 'Object details Object Page' })).toBeInTheDocument();
    expect(screen.getByRole('banner', { name: 'Order Header area Object Page Header' }).tagName).toBe('DIV');
    expect(screen.getByRole('navigation', { name: 'Sections' })).toHaveClass('sk-anchorbar');
    expect(screen.getByRole('region', { name: 'General Actions for Object Page' }).tagName).toBe('DIV');
    rerender(object(<ObjectPageAccessibleLandmarkInfo rootRole="None" navigationRole="None" headerLabel="Head" contentRole="Region" contentLabel="Sections area" footerRole="None" />));
    expect(container.querySelector('.sk-dynamic-page')).not.toHaveAttribute('role');
    expect(container.querySelector('.sk-dynamic-page')).not.toHaveAttribute('aria-label');
    expect(screen.getByRole('banner', { name: 'Head' })).toBeInTheDocument();
    const bar = container.querySelector('.sk-anchorbar')!;
    expect(bar.tagName).toBe('DIV');
    expect(bar).not.toHaveAttribute('role');
    expect(bar).not.toHaveAttribute('aria-label');
    expect(screen.getByRole('region', { name: 'Sections area' })).toHaveClass('sk-dynamic-page__content');
    expect(container.querySelector('.sk-dynamic-page__footer')!.tagName).toBe('FOOTER');
  });

  it('AL-05 ObjectPageLayout: a DynamicPage inside a section keeps its own landmarks', () => {
    const { container } = render(object(undefined, <DynamicPage title={<DynamicPageTitle heading="Inner" />} content={<p>inner</p>} />));
    const pages = container.querySelectorAll('.sk-dynamic-page');
    expect(pages[0]!.tagName).toBe('DIV');
    expect(pages[1]!.tagName).toBe('ARTICLE');
  });
});

const fcl = (props: Partial<Parameters<typeof FlexibleColumnLayout>[0]> = {}) => wrap(
  <FlexibleColumnLayout
    layout="TwoColumnsMidExpanded"
    beginColumnPages={<button type="button">first</button>}
    midColumnPages={<div key="1"><button type="button">mid one</button></div>}
    {...props}
  />,
);

describe('FlexibleColumnLayout landmarkInfo, autoFocus, separators', () => {
  it('AL-05 FlexibleColumnLayout: columns are regions with the default labels or the landmark info labels', () => {
    const { rerender } = render(fcl({ autoFocus: false }));
    expect(screen.getByRole('region', { name: 'First column' })).toHaveTextContent('first');
    expect(screen.getByRole('region', { name: 'Middle column' })).toHaveTextContent('mid one');
    rerender(fcl({ autoFocus: false, landmarkInfo: <FlexibleColumnLayoutAccessibleLandmarkInfo firstColumnLabel="List" middleColumnLabel="Details" /> }));
    expect(screen.getByRole('region', { name: 'List' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Details' })).toBeInTheDocument();
  });

  it('AL-05 FlexibleColumnLayout: the arrow labels come from the landmark info (separatorArrows)', () => {
    render(fcl({ autoFocus: false, separatorArrows: true, landmarkInfo: <FlexibleColumnLayoutAccessibleLandmarkInfo middleColumnForwardArrowLabel="Wider list" /> }));
    expect(screen.getByRole('button', { name: 'Wider list' })).toBeInTheDocument();
  });

  it('AL-05 FlexibleColumnLayout: separators are draggable separators; no arrows by default', () => {
    render(fcl({ autoFocus: false }));
    const sep = screen.getByRole('separator', { name: 'Press ARROW keys to move' });
    expect(sep).toHaveAttribute('aria-orientation', 'vertical');
    expect(sep).toHaveAttribute('tabindex', '0');
    expect(screen.queryByRole('button', { name: 'Expand the first column' })).toBeNull();
  });

  it('AL-05 FlexibleColumnLayout: autoFocus (default true) focuses the first page of a column', () => {
    render(fcl({ layout: 'OneColumn' }));
    expect(screen.getByRole('button', { name: 'first' })).toHaveFocus();
  });

  it('AL-05 FlexibleColumnLayout: autoFocus false leaves the focus', () => {
    render(fcl({ layout: 'OneColumn', autoFocus: false }));
    expect(screen.getByRole('button', { name: 'first' })).not.toHaveFocus();
  });

  it('AL-05 FlexibleColumnLayout: a newly shown column and a new page in the focused column take the focus', () => {
    const { rerender } = render(fcl({ layout: 'OneColumn' }));
    rerender(fcl({ layout: 'TwoColumnsMidExpanded' }));
    expect(screen.getByRole('button', { name: 'mid one' })).toHaveFocus();
    // another page (key) in the mid column while the focus is there
    rerender(fcl({ midColumnPages: <div key="2"><button type="button">mid two</button></div> }));
    expect(screen.getByRole('button', { name: 'mid two' })).toHaveFocus();
    // focus in the begin column: a new mid page does not take it
    screen.getByRole('button', { name: 'first' }).focus();
    rerender(fcl({ midColumnPages: <div key="3"><button type="button">mid three</button></div> }));
    expect(screen.getByRole('button', { name: 'first' })).toHaveFocus();
  });

  it('AL-06 FlexibleColumnLayout: dragging a separator fires columnsDistributionChange (media, layout, columnsSizes) and columnResize', () => {
    const onColumnsDistributionChange = vi.fn();
    const onColumnResize = vi.fn();
    const onStateChange = vi.fn();
    const { container } = render(fcl({ autoFocus: false, onColumnsDistributionChange, onColumnResize, onStateChange }));
    const sep = container.querySelector('[data-sk-fcl-separator="1"]')!;
    // 1440px: the begin column is 33% = 475.2px
    fireEvent.mouseDown(sep, { clientX: 475 });
    fireEvent.mouseMove(document, { clientX: 575 });
    fireEvent.mouseUp(document, { clientX: 575 });
    expect(onColumnsDistributionChange).toHaveBeenCalledTimes(1);
    const e = onColumnsDistributionChange.mock.calls[0]![0];
    expect(e.media).toBe('desktop');
    expect(e.layout).toBe('TwoColumnsMidExpanded');
    const [b, m, end] = (e.columnsSizes as string).split('/').map(Number);
    expect(b).toBeCloseTo((575.2 / 1440) * 100, 5);
    expect(m).toBeCloseTo((864.8 / 1440) * 100, 5);
    expect(end).toBe(0);
    expect(Number(container.querySelector('[data-sk-fcl-column="0"]')!.getAttribute('data-width'))).toBeCloseTo(b!, 5);
    expect(onColumnResize).toHaveBeenLastCalledWith({ beginColumn: true, midColumn: true, endColumn: false });
    expect(onStateChange).not.toHaveBeenCalled();
  });

  it('AL-06 FlexibleColumnLayout: dragging past the mid column asks for TwoColumnsBeginExpanded (stateChange)', () => {
    const onColumnsDistributionChange = vi.fn();
    const onStateChange = vi.fn();
    const { container } = render(fcl({ autoFocus: false, onColumnsDistributionChange, onStateChange }));
    const sep = container.querySelector('[data-sk-fcl-separator="1"]')!;
    fireEvent.mouseDown(sep, { clientX: 475 });
    fireEvent.mouseMove(document, { clientX: 800 });
    fireEvent.mouseUp(document, { clientX: 800 });
    expect(onStateChange).toHaveBeenCalledWith({ layout: 'TwoColumnsBeginExpanded', maxColumnsCount: 3, isNavigationArrow: true, isResize: false });
    expect(onColumnsDistributionChange).toHaveBeenCalledWith(expect.objectContaining({ media: 'desktop', layout: 'TwoColumnsBeginExpanded' }));
  });

  it('AL-06 FlexibleColumnLayout: keyboard on the separator (arrow 20px, Home to the minimum width 312px)', () => {
    const onColumnsDistributionChange = vi.fn();
    render(fcl({ autoFocus: false, onColumnsDistributionChange }));
    const sep = screen.getByRole('separator');
    fireEvent.keyDown(sep, { key: 'ArrowRight' });
    expect(Number(onColumnsDistributionChange.mock.lastCall![0].columnsSizes.split('/')[0])).toBeCloseTo((495.2 / 1440) * 100, 5);
    fireEvent.keyDown(sep, { key: 'Home' });
    expect(Number(onColumnsDistributionChange.mock.lastCall![0].columnsSizes.split('/')[0])).toBeCloseTo((312 / 1440) * 100, 5);
  });

  it('AL-06 FlexibleColumnLayout: the dragged begin width is kept in the other layouts of the media', () => {
    const ui = (layout: LayoutType) => fcl({ autoFocus: false, layout, endColumnPages: <p>end</p> });
    const { container, rerender } = render(ui('TwoColumnsMidExpanded'));
    fireEvent.keyDown(screen.getAllByRole('separator')[0]!, { key: 'ArrowRight' });
    const begin = Number(container.querySelector('[data-sk-fcl-column="0"]')!.getAttribute('data-width'));
    rerender(ui('ThreeColumnsMidExpandedEndHidden'));
    expect(Number(container.querySelector('[data-sk-fcl-column="0"]')!.getAttribute('data-width'))).toBeCloseTo(begin, 5);
    // with three visible columns the begin column stays below 33%
    rerender(ui('ThreeColumnsMidExpanded'));
    expect(container.querySelector('[data-sk-fcl-column="0"]')).toHaveAttribute('data-width', '32');
  });
});
