/** Display controls (docs/26 §3.2–3.5, ADR-032): SAPUI5 names, properties and events. */
import { MantineProvider } from '@mantine/core';
import { smartKitCssVariablesResolver, smartKitMantineTheme, SmartKitProvider } from '@rhfan2019/smart-kit';
import {
  BusyDialog, BusyIndicator, Currency, ExpandableText, IllustratedMessage, IllustratedMessageType, IndicationColor, ObjectIdentifier, ObjectMarker, ObjectNumber,
  ObjectStatus, OverflowToolbar, OverflowToolbarButton, ToggleButton, ToolbarSpacer, type BusyDialogRef, type IllustratedMessageSize,
} from '@rhfan2019/smart-kit/controls';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Copy, Flag, Share2, Star, Trash2 } from 'lucide-react';
import { useRef, type ReactNode } from 'react';

function Providers({ children }: { children: ReactNode }) {
  return (
    <MantineProvider theme={smartKitMantineTheme} cssVariablesResolver={smartKitCssVariablesResolver} forceColorScheme="light">
      <SmartKitProvider services={{}} locale="en" namespace="storybook-controls-display">
        <div style={{ display: 'grid', gap: 24, padding: 16 }}>{children}</div>
      </SmartKitProvider>
    </MantineProvider>
  );
}

const meta: Meta = { title: 'smart-kit/Controls/Display', parameters: { layout: 'fullscreen' }, decorators: [(Story) => <Providers><Story /></Providers>] };
export default meta;
type Story = StoryObj;

const row = { display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' } as const;

export const ObjectDisplay: Story = {
  render: () => (
    <>
      <div style={row}>
        <ObjectIdentifier title="4500000017" text="Acme Corp" titleActive onTitlePress={() => console.info('titlePress')} />
        <ObjectNumber number="12,500.00" unit="EUR" state="Success" />
        <ObjectNumber number={48900} unit="EUR" displayMode="Currency" state="Error" inverted />
      </div>
      <div style={row}>
        <ObjectStatus title="Status" text="Approved" state="Success" />
        <ObjectStatus text="Overdue" state="Error" inverted />
        <ObjectStatus text="In review" state="Warning" active onPress={() => console.info('press')} />
        <ObjectStatus emptyIndicatorMode="On" />
      </div>
      <div style={row}>
        {(Object.values(IndicationColor) as IndicationColor[]).map((s) => <ObjectStatus key={s} text={s.slice(10)} state={s} inverted />)}
      </div>
      <div style={row}>
        {(['Flagged', 'Favorite', 'Draft', 'Locked', 'Unsaved'] as const).map((t) => <ObjectMarker key={t} type={t} />)}
        <ObjectMarker type="LockedBy" additionalInfo="Anna Weber" />
        <ObjectMarker type="UnsavedBy" />
      </div>
      <div style={row}>
        <ToggleButton text="Flag" icon={<Flag size={16} />} />
        <ToggleButton icon={<Star size={16} />} aria-label="Favorite" type="Transparent" pressed />
        <ToggleButton text="Accept" type="Accept" />
        <ToggleButton text="Reject" type="Reject" />
        <ToggleButton text="Notifications" type="Emphasized" badge={4} badgeStyle="Attention" />
      </div>
    </>
  ),
};

export const IllustratedMessages: Story = {
  args: { illustrationSize: 'Small' satisfies IllustratedMessageSize },
  argTypes: { illustrationSize: { control: 'select', options: ['Auto', 'Base', 'ExtraSmall', 'Small', 'Medium', 'Large'] } },
  render: (args) => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
      {Object.values(IllustratedMessageType).map((t) => <IllustratedMessage key={t} illustrationType={t} illustrationSize={(args as { illustrationSize: IllustratedMessageSize }).illustrationSize} />)}
    </div>
  ),
};

function BusyDemo() {
  const ref = useRef<BusyDialogRef>(null);
  return (
    <div style={row}>
      <BusyIndicator text="Loading…" />
      <BusyIndicator customIcon={<Star />} customIconRotationSpeed={1500} />
      <button type="button" onClick={() => { ref.current?.open(); setTimeout(() => ref.current?.close(), 3000); }}>Open BusyDialog</button>
      <BusyDialog ref={ref} title="Posting" text="Posting the goods receipt…" showCancelButton onClose={(e) => console.info('close', e)} />
    </div>
  );
}
export const Busy: Story = { render: () => <BusyDemo /> };

export const TextAndAmounts: Story = {
  render: () => (
    <>
      <div style={{ display: 'grid', justifyItems: 'end', width: 'fit-content' }}>
        <Currency value={1234.5} currency="EUR" maxPrecision={3} />
        <Currency value={98000} currency="JPY" maxPrecision={3} />
        <Currency value={7.125} currency="BHD" maxPrecision={3} />
        <Currency stringValue="12345678901234.56" currency="USD" maxPrecision={3} />
      </div>
      <ExpandableText maxCharacters={60} text="The supplier confirmed the delivery for the second week of December. Partial deliveries are possible for items 20 and 30." />
      <ExpandableText maxCharacters={60} overflowMode="Popover" text="The supplier confirmed the delivery for the second week of December. Partial deliveries are possible for items 20 and 30." />
    </>
  ),
};

export const Toolbar: Story = {
  render: () => (
    <div style={{ resize: 'horizontal', overflow: 'hidden', width: 640, minWidth: 200, border: '1px dashed' }}>
      <OverflowToolbar design="Solid">
        <strong>Items (24)</strong>
        <ToolbarSpacer />
        <ToggleButton text="Flag" icon={<Flag size={16} />} />
        <ToggleButton text="Favorite" icon={<Star size={16} />} layoutData={{ priority: 'Low' }} />
        <OverflowToolbarButton text="Copy" icon={<Copy size={16} />} layoutData={{ group: 1 }} />
        <OverflowToolbarButton text="Share" icon={<Share2 size={16} />} layoutData={{ group: 1 }} />
        <OverflowToolbarButton text="Delete" icon={<Trash2 size={16} />} layoutData={{ priority: 'AlwaysOverflow' }} />
        <ToggleButton text="Edit mode" type="Emphasized" layoutData={{ priority: 'NeverOverflow' }} />
      </OverflowToolbar>
    </div>
  ),
};
