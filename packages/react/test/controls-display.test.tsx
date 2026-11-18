/** Display controls (docs/26 §3.2–3.5, ADR-032): SAPUI5 names, properties, events and methods. */
import { MantineProvider } from '@mantine/core';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { Star } from 'lucide-react';
import { createRef, type ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SmartKitProvider, smartKitMantineTheme } from '../src';
import BusyDialog from '@rhfan2019/smart-kit/m/BusyDialog';
import BusyIndicator from '@rhfan2019/smart-kit/m/BusyIndicator';
import Currency from '@rhfan2019/smart-kit/ui/unified/Currency';
import ExpandableText from '@rhfan2019/smart-kit/m/ExpandableText';
import IllustratedMessage from '@rhfan2019/smart-kit/m/IllustratedMessage';
import IllustratedMessageType from '@rhfan2019/smart-kit/m/IllustratedMessageType';
import { IndicationColor } from '@rhfan2019/smart-kit/ui/core/library';
import ObjectIdentifier from '@rhfan2019/smart-kit/m/ObjectIdentifier';
import ObjectMarker from '@rhfan2019/smart-kit/m/ObjectMarker';
import ObjectNumber from '@rhfan2019/smart-kit/m/ObjectNumber';
import ObjectStatus from '@rhfan2019/smart-kit/m/ObjectStatus';
import OverflowToolbar from '@rhfan2019/smart-kit/m/OverflowToolbar';
import OverflowToolbarButton from '@rhfan2019/smart-kit/m/OverflowToolbarButton';
import ToggleButton from '@rhfan2019/smart-kit/m/ToggleButton';
import ToolbarSpacer from '@rhfan2019/smart-kit/m/ToolbarSpacer';
import { overflowIndices } from '../src/controls/display/OverflowToolbar';
import type { BusyDialog$CloseEvent } from '@rhfan2019/smart-kit/m/BusyDialog';
import type { ObjectIdentifier$TitlePressEvent } from '@rhfan2019/smart-kit/m/ObjectIdentifier';
import type { ObjectMarker$PressEvent } from '@rhfan2019/smart-kit/m/ObjectMarker';
import type { OverflowToolbar$PressEvent } from '@rhfan2019/smart-kit/m/OverflowToolbar';
import type { ToggleButton$PressEvent } from '@rhfan2019/smart-kit/m/ToggleButton';
import { displayEn as en } from '../src/i18n/controls/display.en';
import { displayZh as zh } from '../src/i18n/controls/display.zh';

const FS = ' ';
const PS = ' ';

function view(ui: ReactNode, locale?: 'en' | 'zh') {
  return render(
    <MantineProvider theme={smartKitMantineTheme} env="test">
      {locale ? <SmartKitProvider services={{}} locale={locale} namespace={`d${Math.random()}`}>{ui}</SmartKitProvider> : ui}
    </MantineProvider>,
  );
}

describe('ObjectStatus, ObjectIdentifier, ObjectNumber, ObjectMarker', () => {
  it('UE-20 ObjectStatus shows "title:" and the text in the state colour, and announces the state (stateAnnouncementText overrides it)', () => {
    const { container, rerender } = view(<ObjectStatus title="Status" text="Rejected" state="Error" />);
    const el = container.querySelector('[data-sk-object-status]')!;
    expect(el).toHaveClass('sk-object-status--negative');
    expect(el).toHaveTextContent('Status:Rejected');
    expect(within(el as HTMLElement).getByText('Error')).toHaveClass('sk-visually-hidden');
    rerender(<MantineProvider env="test"><ObjectStatus text="Rejected" state="Error" stateAnnouncementText="Blocked" /></MantineProvider>);
    expect(screen.getByText('Blocked')).toHaveClass('sk-visually-hidden');
  });

  it('UE-21 ObjectStatus inverted fills the background; IndicationColor Indication01–20 map to their own colour classes', () => {
    expect(Object.keys(IndicationColor)).toHaveLength(20);
    const { container } = view(<><ObjectStatus text="A" state="Indication05" inverted /><ObjectStatus text="B" state="Indication20" /></>);
    const [a, b] = container.querySelectorAll('[data-sk-object-status]');
    expect(a).toHaveClass('sk-object-status--indication-05', 'sk-object-status--inverted');
    expect(b).toHaveClass('sk-object-status--indication-20');
  });

  it('UE-22 ObjectStatus active is a button firing onPress; emptyIndicatorMode On shows "–" for an empty text', () => {
    const onPress = vi.fn();
    const { container } = view(<><ObjectStatus text="Open" active onPress={onPress} icon={<Star />} /><ObjectStatus emptyIndicatorMode="On" /><ObjectStatus /></>);
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(container.querySelectorAll('.sk-empty-indicator--on')).toHaveLength(1);
    expect(container.querySelector('.sk-empty-indicator--on')).toHaveTextContent('–');
  });

  it('UE-23 ObjectIdentifier: bold title and text; titleActive makes the title a link firing titlePress({ domRef })', () => {
    const onTitlePress = vi.fn();
    view(<ObjectIdentifier title="4500000001" text="Acme Corp" titleActive onTitlePress={onTitlePress} />);
    const title = screen.getByRole('button', { name: '4500000001' });
    fireEvent.click(title);
    expect(onTitlePress).toHaveBeenCalledWith({ domRef: title });
    expect(screen.getByText('Acme Corp')).toHaveClass('sk-object-identifier__text');
  });

  it('UE-24 ObjectNumber: number and unit, bold by default, state colour, inverted, textAlign, active press', () => {
    const onPress = vi.fn();
    const { container } = view(<ObjectNumber number="1,250.00" unit="EUR" state="Success" inverted textAlign="End" active onPress={onPress} />);
    const el = container.querySelector('[data-sk-object-number]') as HTMLElement;
    expect(el).toHaveClass('sk-object-number--emphasized', 'sk-object-number--positive', 'sk-object-number--inverted');
    expect(el.style.textAlign).toBe('end');
    expect(el).toHaveTextContent('1,250.00EUR');
    fireEvent.click(within(el).getByRole('button'));
    expect(onPress).toHaveBeenCalled();
  });

  it('UE-25 ObjectNumber displayMode Currency formats like Currency (unit is the currency, maxPrecision pads, useSymbol)', () => {
    const { container } = view(<><ObjectNumber number={1234.5} unit="EUR" displayMode="Currency" maxPrecision={3} /><ObjectNumber number={1234.5} unit="EUR" displayMode="Currency" useSymbol={false} /><ObjectNumber number="7" displayMode="Unit" maxPrecision={1} unit="kg" /></>);
    const [a, b, c] = [...container.querySelectorAll('[data-sk-object-number]')].map((n) => n.textContent);
    expect(a).toBe(`1,234.50${FS}€`);
    expect(b).toBe('1,234.50EUR');
    expect(c).toBe('7.0kg');
  });

  it('UE-26 ObjectMarker default visibility by type: Flagged / Favorite icon only, Draft text only, Locked etc. responsive (icon only on small screens)', () => {
    const { container } = view(<>{(['Flagged', 'Favorite', 'Draft', 'Locked', 'Unsaved'] as const).map((t) => <ObjectMarker key={t} type={t} />)}</>);
    const vis = [...container.querySelectorAll('[data-sk-object-marker]')].map((n) => n.getAttribute('data-visibility'));
    expect(vis).toEqual(['IconOnly', 'IconOnly', 'TextOnly', 'Responsive', 'Responsive']);
    expect(screen.getByRole('img', { name: 'Flagged' })).toBeInTheDocument();
    expect(container.querySelector('[data-sk-object-marker="Draft"] svg')).toBeNull();
    expect(container.querySelector('[data-sk-object-marker="Locked"]')).toHaveClass('sk-object-marker--responsive');
  });

  it('UE-27 ObjectMarker LockedBy / UnsavedBy name the user (additionalInfo), press({ type }); no type renders nothing', () => {
    const onPress = vi.fn();
    const { container } = view(<><ObjectMarker type="LockedBy" additionalInfo="Anna" visibility="TextOnly" onPress={onPress} /><ObjectMarker type="UnsavedBy" visibility="TextOnly" /><ObjectMarker /></>, 'zh');
    fireEvent.click(screen.getByRole('button', { name: '已被 Anna 锁定' }));
    expect(onPress).toHaveBeenCalledWith({ type: 'LockedBy' });
    expect(screen.getByText('其他用户有未保存的更改')).toBeInTheDocument();
    expect(container.querySelectorAll('[data-sk-object-marker]')).toHaveLength(2);
  });
});

describe('ToggleButton', () => {
  it('UE-28 ToggleButton toggles aria-pressed and fires press({ pressed }); activeIcon while pressed; enabled false disables it', () => {
    const onPress = vi.fn();
    view(<><ToggleButton text="Flag" icon={<span>off</span>} activeIcon={<span>on</span>} onPress={onPress} /><ToggleButton text="Off" enabled={false} /></>);
    const btn = screen.getByRole('button', { name: /Flag/ });
    expect(btn).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(btn);
    expect(btn).toHaveAttribute('aria-pressed', 'true');
    expect(onPress).toHaveBeenLastCalledWith({ pressed: true });
    expect(btn).toHaveTextContent('on');
    fireEvent.click(btn);
    expect(onPress).toHaveBeenLastCalledWith({ pressed: false });
    expect(screen.getByRole('button', { name: 'Off' })).toBeDisabled();
  });

  it('UE-29 ToggleButton has the sap.m.Button properties: type, iconFirst, ariaHasPopup, accessibleRole, badge; pressed prop wins', () => {
    const { rerender } = view(<ToggleButton text="Menu" type="Reject" ariaHasPopup="Menu" iconFirst={false} icon={<span>i</span>} badge={3} badgeStyle="Attention" />);
    const btn = screen.getByRole('button', { name: /Menu/ });
    expect(btn).toHaveClass('sk-toggle-button--reject');
    expect(btn).toHaveAttribute('aria-haspopup', 'menu');
    expect(btn.querySelector('[data-sk-badge]')).toHaveClass('sk-button-badge--attention');
    rerender(<MantineProvider env="test"><ToggleButton text="Link" accessibleRole="Link" pressed /></MantineProvider>);
    expect(screen.getByRole('link', { name: 'Link' })).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('IllustratedMessage, BusyIndicator, BusyDialog', () => {
  it('UE-30 IllustratedMessage defaults to NoSearchResults with the default title and description (en, zh)', () => {
    const { unmount } = view(<IllustratedMessage />);
    expect(screen.getByRole('heading', { level: 2, name: 'No results found' })).toBeInTheDocument();
    expect(screen.getByText('Try a different search term.')).toBeInTheDocument();
    unmount();
    view(<IllustratedMessage illustrationType="NoData" />, 'zh');
    expect(screen.getByRole('heading', { name: '暂无数据' })).toBeInTheDocument();
  });

  it('UE-31 IllustratedMessage draws every non-deprecated type with zh and en texts; sizes Base (no illustration) to Large', () => {
    const types = Object.values(IllustratedMessageType);
    expect(types).toHaveLength(33);
    expect(types).not.toContain('EmptyList');
    for (const type of types) {
      for (const part of ['title', 'description']) {
        const key = `ctl.illustratedMessage.${type}.${part}` as keyof typeof en;
        expect(en[key], key).toBeTruthy();
        expect(zh[key], key).toBeTruthy();
      }
    }
    const { container } = view(<>{types.map((t) => <IllustratedMessage key={t} illustrationType={t} illustrationSize="Small" />)}<IllustratedMessage illustrationSize="Base" /></>);
    const drawn = new Set([...container.querySelectorAll('svg[data-sk-illustration]')].map((s) => s.getAttribute('data-sk-illustration')));
    expect(drawn.size).toBe(33);
    const base = container.querySelector('[data-size="Base"]')!;
    expect(base.querySelector('svg')).toBeNull();
    expect(container.querySelector('[data-size="Small"]')).toHaveClass('sk-illustrated-message--small');
  });

  it('UE-32 IllustratedMessage: title / description override, enableDefaultTitleAndDescription false, ariaTitleLevel, decorative, additionalContent', () => {
    const { container } = view(
      <>
        <IllustratedMessage illustrationType="NoMail" title="Inbox" ariaTitleLevel="H4" additionalContent={<button type="button">Refresh</button>} />
        <IllustratedMessage illustrationType="NoTasks" enableDefaultTitleAndDescription={false} decorative />
      </>,
    );
    expect(screen.getByRole('heading', { level: 4, name: 'Inbox' })).toBeInTheDocument();
    expect(screen.getByText('Your inbox is empty.')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Inbox' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeInTheDocument();
    const second = container.querySelectorAll('[data-sk-illustrated-message]')[1]!;
    expect(second.querySelector('h2, p')).toBeNull();
    expect(second.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('UE-33 BusyIndicator: progressbar with aria-busy, shown at once (no delay), text, size, rotating customIcon', () => {
    const { container } = view(<><BusyIndicator text="Loading orders" size="2rem" /><BusyIndicator customIcon={<Star />} customIconRotationSpeed={500} customIconWidth="3rem" /></>);
    const [a, b] = screen.getAllByRole('progressbar');
    expect(a).toHaveAttribute('aria-busy', 'true');
    expect(a).toHaveAccessibleName('Loading orders');
    expect(a!.style.getPropertyValue('--sk-busy-size')).toBe('2rem');
    expect(container.querySelectorAll('.sk-busy-indicator__dots > span')).toHaveLength(3);
    expect(b).toHaveAccessibleName('Please wait');
    expect(b!.querySelector('.sk-busy-indicator__icon--spin')).toBeInTheDocument();
    expect(b!.style.getPropertyValue('--sk-busy-speed')).toBe('500ms');
    expect(b!.style.getPropertyValue('--sk-busy-icon-width')).toBe('3rem');
  });

  it('UE-34 BusyDialog: open() / close() through the ref; Cancel closes with cancelPressed true; close(true) likewise', async () => {
    const ref = createRef<BusyDialog>();
    const onClose = vi.fn();
    view(<BusyDialog ref={ref} title="Posting" text="Posting the invoice" showCancelButton onClose={onClose} />);
    expect(screen.queryByText('Posting the invoice')).toBeNull();
    act(() => ref.current!.open());
    expect(await screen.findByText('Posting the invoice')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenLastCalledWith({ cancelPressed: true });
    act(() => ref.current!.open());
    act(() => ref.current!.close());
    expect(onClose).toHaveBeenLastCalledWith({ cancelPressed: false });
    act(() => ref.current!.open());
    act(() => ref.current!.close(true));
    expect(onClose).toHaveBeenLastCalledWith({ cancelPressed: true });
    expect(onClose).toHaveBeenCalledTimes(3);
  });
});

describe('Currency, ExpandableText', () => {
  it('UE-35 Currency aligns decimals: figure spaces to maxPrecision, a punctuation space for currencies without decimals, symbol or code', () => {
    const { container } = view(
      <>
        <Currency value={1234.5} currency="EUR" maxPrecision={3} />
        <Currency value={1000} currency="JPY" maxPrecision={2} useSymbol={false} />
        <Currency stringValue="12345678901234.56" currency="USD" />
        <Currency />
        <Currency value={null} emptyIndicatorMode="On" />
      </>,
    );
    const values = [...container.querySelectorAll('.sk-currency__value')].map((n) => n.textContent);
    const codes = [...container.querySelectorAll('.sk-currency__code')].map((n) => n.textContent);
    expect(values).toEqual([`1,234.50${FS}`, `1,000${PS}${FS}${FS}`, '12,345,678,901,234.56', '0.00']);
    expect(codes).toEqual(['€', 'JPY', '$', '']);
    expect(container.querySelectorAll('[data-sk-currency]')[4]).toHaveTextContent('–');
  });

  it('UE-36 ExpandableText cuts after maxCharacters with More / Less (InPlace), honours expanded, and shows the full text in a popover', async () => {
    const text = 'a'.repeat(30);
    const { container } = view(
      <>
        <ExpandableText text={text} maxCharacters={10} data-testid="inplace" />
        <ExpandableText text={text} maxCharacters={10} expanded data-testid="expanded" />
        <ExpandableText text={text} maxCharacters={10} overflowMode="Popover" data-testid="popover" />
        <ExpandableText text="short" />
      </>,
    );
    const inplace = screen.getByTestId('inplace');
    expect(inplace).toHaveTextContent(`${'a'.repeat(10)}… More`);
    fireEvent.click(within(inplace).getByRole('button', { name: 'More' }));
    expect(inplace).toHaveTextContent(`${text} Less`);
    expect(within(screen.getByTestId('expanded')).getByRole('button', { name: 'Less' })).toBeInTheDocument();
    fireEvent.click(within(screen.getByTestId('popover')).getByRole('button', { name: 'More' }));
    expect((await screen.findByText(text, { selector: '[data-sk-expandable-popover]' }))).toBeInTheDocument();
    expect(container.querySelectorAll('[data-sk-expandable-toggle]')).toHaveLength(3);
  });
});

describe('OverflowToolbar, OverflowToolbarLayoutData, ToolbarSpacer', () => {
  const restore: Array<() => void> = [];
  afterEach(() => restore.splice(0).forEach((f) => f()));
  /** Items 100 wide, the "More" button 30, the toolbar `width` wide. */
  function mockWidths(width: number) {
    const ow = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth')!;
    const cw = Object.getOwnPropertyDescriptor(Element.prototype, 'clientWidth')!;
    Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, get(this: HTMLElement) { return this.dataset.skToolbarItem ? 100 : 'skToolbarMore' in this.dataset || 'skToolbarProbe' in this.dataset ? 30 : 0; } });
    Object.defineProperty(Element.prototype, 'clientWidth', { configurable: true, get(this: HTMLElement) { return this.classList.contains('sk-overflow-toolbar') ? width : 0; } });
    restore.push(() => { Object.defineProperty(HTMLElement.prototype, 'offsetWidth', ow); Object.defineProperty(Element.prototype, 'clientWidth', cw); });
  }

  it('UE-37 overflow order: AlwaysOverflow always, then Low / Disappear, then High, right to left; NeverOverflow stays; groups move together', () => {
    const w = [100, 100, 100, 100];
    expect([...overflowIndices(w, [{}, {}, {}, {}], 1000, 0, 30)]).toEqual([]);
    expect([...overflowIndices(w, [{}, {}, {}, {}], 330, 0, 30)].sort()).toEqual([3]);
    expect([...overflowIndices(w, [{}, { priority: 'Low' }, {}, {}], 330, 0, 30)].sort()).toEqual([1]);
    expect([...overflowIndices(w, [{ priority: 'NeverOverflow' }, {}, {}, {}], 130, 0, 30)].sort()).toEqual([1, 2, 3]);
    expect([...overflowIndices(w, [{}, {}, {}, { priority: 'AlwaysOverflow' }], 1000, 0, 30)]).toEqual([3]);
    expect([...overflowIndices(w, [{}, { group: 1 }, {}, { group: 1 }], 330, 0, 30)].sort()).toEqual([1, 3]);
    // Disappear needs no "More" button: hiding it alone makes the rest fit
    expect([...overflowIndices([100, 100, 100], [{}, {}, { priority: 'Disappear' }], 200, 0, 30)]).toEqual([2]);
  });

  it('UE-38 OverflowToolbar moves children that do not fit into "More"; OverflowToolbarButton shows its text there; closeOverflow()', async () => {
    mockWidths(250);
    const ref = createRef<OverflowToolbar>();
    const onCopy = vi.fn();
    view(
      <OverflowToolbar ref={ref} aria-label="Actions">
        <ToggleButton text="Edit" />
        <ToolbarSpacer />
        <OverflowToolbarButton text="Copy" icon={<Star />} onPress={onCopy} />
        <ToggleButton text="Keep" layoutData={{ closeOverflowOnInteraction: false }} />
        <ToggleButton text="Pin" layoutData={{ priority: 'NeverOverflow' }} />
      </OverflowToolbar>,
    );
    const bar = screen.getByRole('toolbar', { name: 'Actions' });
    expect(within(bar).getByRole('button', { name: 'Edit' })).toBeInTheDocument();
    expect(within(bar).getByRole('button', { name: 'Pin' })).toBeInTheDocument();
    expect(within(bar).queryByRole('button', { name: 'Copy' })).toBeNull();
    fireEvent.click(within(bar).getByRole('button', { name: 'More' }));
    const overflow = await screen.findByText('Keep', { selector: 'button *' }).then((n) => n.closest('[data-sk-toolbar-overflow]') as HTMLElement);
    expect(within(overflow).getByRole('button', { name: 'Copy' })).toHaveAttribute('data-sk-overflow-toolbar-button', 'overflow');
    fireEvent.click(within(overflow).getByRole('button', { name: /Keep/ }));
    expect(screen.getByRole('button', { name: 'More' })).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(within(overflow).getByRole('button', { name: 'Copy' }));
    expect(onCopy).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'More' })).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(screen.getByRole('button', { name: 'More' }));
    expect(screen.getByRole('button', { name: 'More' })).toHaveAttribute('aria-expanded', 'true');
    act(() => ref.current!.closeOverflow());
    expect(screen.getByRole('button', { name: 'More' })).toHaveAttribute('aria-expanded', 'false');
  });

  it('UE-39 OverflowToolbar active fires press({ srcControl }) outside its content; enabled false makes it inert; works without a provider', () => {
    const onPress = vi.fn();
    const inner = vi.fn();
    const { container } = view(
      <>
        <OverflowToolbar active onPress={onPress} design="Info" style="Clear" height="3rem">
          <span>3 items selected</span>
          <ToggleButton text="Inner" onPress={inner} />
        </OverflowToolbar>
        <OverflowToolbar enabled={false}><ToolbarSpacer width="2rem" /><ToggleButton text="Off" /></OverflowToolbar>
      </>,
    );
    const [active, disabled] = screen.getAllByRole('toolbar');
    expect(active).toHaveClass('sk-overflow-toolbar--info', 'sk-overflow-toolbar--clear', 'sk-overflow-toolbar--active');
    expect(active!.style.height).toBe('3rem');
    const label = screen.getByText('3 items selected');
    fireEvent.click(label);
    expect(onPress).toHaveBeenCalledWith({ srcControl: label });
    fireEvent.click(screen.getByRole('button', { name: 'Inner' }));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(inner).toHaveBeenCalled();
    expect(disabled).toHaveAttribute('inert');
    expect(disabled).toHaveAttribute('aria-disabled', 'true');
    expect((container.querySelector('[data-sk-toolbar-spacer]') as HTMLElement).style.width).toBe('2rem');
  });
});

describe('UI5 1.154 alignment (defaults, new members, event types)', () => {
  it('AL-05 display controls: defaults when the props are omitted (state None, emphasized true, Currency value 0, BusyIndicator 1rem / 44px)', () => {
    const { container } = view(
      <>
        <ObjectStatus text="Plain" />
        <ObjectNumber number="12" />
        <Currency currency="EUR" />
        <BusyIndicator customIcon={<Star />} />
        <ExpandableText text={'x'.repeat(120)} />
      </>,
    );
    expect(container.querySelector('[data-sk-object-status]')).toHaveAttribute('data-sk-object-status', 'None');
    expect(container.querySelector('[data-sk-object-number]')).toHaveClass('sk-object-number--emphasized');
    expect(container.querySelector('.sk-currency__value')!.textContent).toBe('0.00');
    const busy = container.querySelector('[data-sk-busy-indicator]') as HTMLElement;
    expect(busy.style.getPropertyValue('--sk-busy-size')).toBe('1rem');
    expect(busy.style.getPropertyValue('--sk-busy-icon-width')).toBe('44px');
    expect(busy.style.getPropertyValue('--sk-busy-icon-height')).toBe('44px');
    expect(busy.style.getPropertyValue('--sk-busy-speed')).toBe('1000ms');
    expect(container.querySelector('.sk-expandable-text__text')!.textContent).toBe(`${'x'.repeat(100)}…`);
  });

  it('AL-05 ObjectIdentifier: visible defaults to true, visible false renders nothing', () => {
    const { container, rerender } = view(<ObjectIdentifier title="Order 1" />);
    expect(container.querySelector('[data-sk-object-identifier]')).not.toBeNull();
    rerender(<MantineProvider theme={smartKitMantineTheme} env="test"><ObjectIdentifier title="Order 1" visible={false} /></MantineProvider>);
    expect(container.querySelector('[data-sk-object-identifier]')).toBeNull();
  });

  it('AL-05 IllustratedMessage: src sap-illustration://<type> takes precedence over illustrationType; other sets fall back', () => {
    const { container } = view(
      <>
        <IllustratedMessage src="sap-illustration://NoMail" illustrationType="NoData" />
        <IllustratedMessage src="sap-illustration://sapIllus/NoTasks" />
        <IllustratedMessage src="sap-illustration://tnt/Teams" illustrationType="NoData" />
      </>,
      'en',
    );
    const shown = [...container.querySelectorAll('[data-sk-illustrated-message]')].map((n) => n.getAttribute('data-sk-illustrated-message'));
    expect(shown).toEqual(['NoMail', 'NoTasks', 'NoData']);
    expect(screen.getByText(en['ctl.illustratedMessage.NoMail.title'])).toBeInTheDocument();
  });

  it('AL-05 IllustratedMessage: illustrationAriaLabelledBy / illustrationAriaDescribedBy label the illustration unless decorative', () => {
    const { container } = view(
      <>
        <IllustratedMessage illustrationAriaLabelledBy={['a', 'b']} illustrationAriaDescribedBy="c" />
        <IllustratedMessage decorative illustrationAriaLabelledBy="a" />
      </>,
      'en',
    );
    const [labelled, decorative] = [...container.querySelectorAll('svg[data-sk-illustration]')];
    expect(labelled).toHaveAttribute('aria-labelledby', 'a b');
    expect(labelled).toHaveAttribute('aria-describedby', 'c');
    expect(labelled).not.toHaveAttribute('aria-label');
    expect(decorative).toHaveAttribute('aria-hidden', 'true');
  });

  it('AL-05 OverflowToolbarButton: type defaults to Default (transparent in the toolbar), iconFirst, activeIcon, ariaHasPopup, accessibleRole, badgeStyle', () => {
    view(
      <OverflowToolbar>
        <OverflowToolbarButton text="Plain" icon={<Star />} />
        <OverflowToolbarButton
          text="Menu" icon={<Star data-testid="icon" />} activeIcon={<Star data-testid="active" />} ariaHasPopup="Menu" accessibleRole="Link"
          badge={3} badgeStyle="Attention"
        />
        <OverflowToolbarButton text="After" iconFirst={false} />
      </OverflowToolbar>,
    );
    const plain = screen.getByRole('button', { name: 'Plain' });
    expect(plain).toHaveAttribute('data-variant', 'subtle');
    const menu = screen.getByRole('link', { name: 'Menu' });
    expect(menu).toHaveAttribute('aria-haspopup', 'menu');
    expect(menu.querySelector('[data-sk-badge]')).toHaveClass('sk-button-badge--attention');
    expect(screen.getByTestId('icon')).toBeInTheDocument();
    fireEvent.pointerDown(menu);
    expect(screen.getByTestId('active')).toBeInTheDocument();
    fireEvent.pointerUp(menu);
    expect(screen.getByTestId('icon')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'After' })).toBeInTheDocument();
  });

  it('AL-06 event objects carry exactly the UI5 parameters (press { type } / { pressed } / { srcControl }, titlePress { domRef }, close { cancelPressed })', () => {
    const marker = vi.fn<(e: ObjectMarker$PressEvent) => void>();
    const toggle = vi.fn<(e: ToggleButton$PressEvent) => void>();
    const title = vi.fn<(e: ObjectIdentifier$TitlePressEvent) => void>();
    const bar = vi.fn<(e: OverflowToolbar$PressEvent) => void>();
    view(
      <>
        <ObjectMarker type="Flagged" onPress={marker} />
        <ToggleButton text="T" onPress={toggle} />
        <ObjectIdentifier title="Order" titleActive onTitlePress={title} />
        <OverflowToolbar active onPress={bar}><span>Bar</span></OverflowToolbar>
      </>,
      'en',
    );
    fireEvent.click(screen.getByRole('button', { name: en['ctl.objectMarker.Flagged'] }));
    fireEvent.click(screen.getByRole('button', { name: 'T' }));
    fireEvent.click(screen.getByRole('button', { name: 'Order' }));
    fireEvent.click(screen.getByText('Bar'));
    expect(Object.keys(marker.mock.calls[0]![0])).toEqual(['type']);
    expect(Object.keys(toggle.mock.calls[0]![0])).toEqual(['pressed']);
    expect(Object.keys(title.mock.calls[0]![0])).toEqual(['domRef']);
    expect(Object.keys(bar.mock.calls[0]![0])).toEqual(['srcControl']);
    const close: BusyDialog$CloseEvent = { cancelPressed: true };
    expect(Object.keys(close)).toEqual(['cancelPressed']);
  });

  it('AL-07 OverflowToolbar ref: getDomRef() returns the toolbar element (replaces element)', () => {
    const ref = createRef<OverflowToolbar>();
    view(<OverflowToolbar ref={ref} aria-label="Bar"><span>x</span></OverflowToolbar>);
    expect(ref.current!.getDomRef()).toBe(screen.getByRole('toolbar', { name: 'Bar' }));
    expect('element' in ref.current!).toBe(false);
  });
});
