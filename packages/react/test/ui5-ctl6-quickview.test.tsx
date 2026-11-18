/** Stage 6 (ctl6): sap.m.QuickView with its pages, groups and elements follows SAPUI5 1.154 (docs/31 stage 6). */
import { act, fireEvent, render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import QuickView from '@rhfan2019/smart-kit/m/QuickView';
import QuickViewGroup from '@rhfan2019/smart-kit/m/QuickViewGroup';
import QuickViewGroupElement from '@rhfan2019/smart-kit/m/QuickViewGroupElement';
import QuickViewPage from '@rhfan2019/smart-kit/m/QuickViewPage';
import { wrap } from './helpers';

function setup(props: Partial<Parameters<typeof QuickView>[0]> = {}) {
  const ref = createRef<QuickView>();
  render(wrap(
    <>
      <button type="button" id="src">Open</button>
      <QuickView ref={ref} {...props}>
        <QuickViewPage pageId="main" header="Company" title="ACME" titleUrl="#/acme" description="Supplier">
          <QuickViewGroup heading="Contact">
            <QuickViewGroupElement label="Mail" value="info@acme.test" type="email" emailSubject="Hello" />
            <QuickViewGroupElement label="Phone" value="+1 555 0100" type="phone" />
            <QuickViewGroupElement label="Site" value="acme.test" type="link" url="https://acme.test" />
            <QuickViewGroupElement label="Hidden" value="x" visible={false} />
            <QuickViewGroupElement label="Manager" value="Jane" type="pageLink" pageLinkId="jane" />
          </QuickViewGroup>
        </QuickViewPage>
        <QuickViewPage pageId="jane" header="Person" title="Jane Doe" />
      </QuickView>
    </>,
  ));
  return ref;
}

describe('sap.m.QuickView', () => {
  it('AL-05 QuickViewGroupElement: type text, target _blank; email / phone / link render links; invisible elements are left out', () => {
    const ref = setup();
    act(() => ref.current!.openBy(document.getElementById('src')));
    const dialog = screen.getByRole('dialog');
    expect(dialog.querySelector('[data-sk-quickview-header]')!.textContent).toBe('Company');
    expect(screen.getByRole('link', { name: 'ACME' }).getAttribute('href')).toBe('#/acme');
    expect(screen.getByRole('link', { name: 'info@acme.test' }).getAttribute('href')).toBe('mailto:info@acme.test?subject=Hello');
    expect(screen.getByRole('link', { name: '+1 555 0100' }).getAttribute('href')).toBe('tel:+15550100');
    const site = screen.getByRole('link', { name: 'acme.test' });
    expect([site.getAttribute('href'), site.getAttribute('target')]).toEqual(['https://acme.test', '_blank']);
    expect(screen.queryByText('Hidden:')).toBeNull();
    expect(dialog.style.width).toBe('320px');
  });

  it('AL-06 AL-07 QuickView: openBy / close fire beforeOpen, afterOpen, beforeClose, afterClose; Escape closes', () => {
    const calls: string[] = [];
    const ref = setup({
      onBeforeOpen: (e) => calls.push(`beforeOpen:${(e.openBy as HTMLElement).id}`), onAfterOpen: () => calls.push('afterOpen'),
      onBeforeClose: (e) => calls.push(`beforeClose:${String(e.origin)}`), onAfterClose: () => calls.push('afterClose'),
    });
    act(() => ref.current!.openBy(document.getElementById('src')));
    act(() => ref.current!.close());
    expect(screen.queryByRole('dialog')).toBeNull();
    act(() => ref.current!.openBy(document.getElementById('src')));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(calls).toEqual(['beforeOpen:src', 'afterOpen', 'beforeClose:null', 'afterClose', 'beforeOpen:src', 'afterOpen', 'beforeClose:null', 'afterClose']);
  });

  it('AL-06 AL-07 QuickView: a pageLink navigates (navigate / afterNavigate, preventable); navigateBack returns', () => {
    const onNavigate = vi.fn();
    const onAfterNavigate = vi.fn();
    const ref = setup({ onNavigate, onAfterNavigate });
    act(() => ref.current!.openBy(null));
    fireEvent.click(screen.getByRole('button', { name: 'Jane' }));
    expect(screen.getByText('Jane Doe')).toBeTruthy();
    expect(onNavigate.mock.lastCall![0]).toMatchObject({ fromId: 'main', toId: 'jane', isTo: true, isBack: false, firstTime: true, direction: 'to' });
    expect(onAfterNavigate.mock.lastCall![0]).toMatchObject({ toId: 'jane', isTopPage: false });
    act(() => ref.current!.navigateBack());
    expect(screen.getByText('ACME')).toBeTruthy();
    expect(onAfterNavigate.mock.lastCall![0]).toMatchObject({ toId: 'main', isBack: true, isTopPage: true });
    onNavigate.mockImplementation((e) => e.preventDefault());
    fireEvent.click(screen.getByRole('button', { name: 'Jane' }));
    expect(screen.getByText('ACME')).toBeTruthy();
  });
});
