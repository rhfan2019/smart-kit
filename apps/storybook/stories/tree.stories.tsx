/** Tree table (docs/26 §3.10): SmartTable tableType="TreeTable" over an in-memory recursive hierarchy (TopLevels in MemoryProvider). */
import type { Meta, StoryObj } from '@storybook/react-vite';
import { buildModel, MemoryProvider, MemoryVariantStore, type Row } from '@rhfan2019/smart-kit-core';
import { SmartKitProvider, SmartTable, useSmartKit, type SmartTableRef, type ToggleOpenStateEvent } from '@rhfan2019/smart-kit';
import { useMemo, useRef, useState, type ReactNode } from 'react';
import treeXml from '../../../packages/core/test/fixtures/tree.xml?raw';

const model = buildModel(treeXml);
const units: Row[] = [];
for (const [r, region] of ['North', 'South', 'East'].entries()) {
  units.push({ ID: `R${r}`, Name: `${region} Region`, ParentID: null, Headcount: 120 + r * 10 });
  for (let d = 0; d < 3; d++) {
    units.push({ ID: `R${r}D${d}`, Name: `${region} ${['Sales', 'Service', 'Operations'][d]}`, ParentID: `R${r}`, Headcount: 30 + d * 5 });
    for (let tm = 0; tm < 2; tm++) units.push({ ID: `R${r}D${d}T${tm}`, Name: `${region} ${['Sales', 'Service', 'Operations'][d]} Team ${tm + 1}`, ParentID: `R${r}D${d}`, Headcount: 8 + tm });
  }
}

/** The tree service next to the story providers' services (same locale). */
function TreeService({ children }: { children: ReactNode }) {
  const { locale } = useSmartKit();
  const services = useMemo(() => ({ org: { model, dataProvider: new MemoryProvider({ model, data: { Units: units }, latency: 150 }), variants: new MemoryVariantStore() } }), []);
  return <SmartKitProvider services={services} defaultService="org" locale={locale} namespace="storybook-tree">{children}</SmartKitProvider>;
}

function TreeDemo({ mode }: { mode?: 'responsive' }) {
  const ref = useRef<SmartTableRef>(null);
  const [last, setLast] = useState<ToggleOpenStateEvent | null>(null);
  return (
    <div style={{ height: mode ? undefined : '80vh', display: 'flex', flexDirection: 'column', padding: 16 }}>
      <SmartTable
        entitySet="Units"
        tableType="TreeTable"
        mode={mode}
        ref={ref}
        onToggleOpenState={setLast}
        navigable={false}
        toolbarEnd={(
          <>
            <span>{last ? `${last.expanded ? 'expanded' : 'collapsed'}: ${String(last.rowContext.Name)} (row ${last.rowIndex})` : ''}</span>
            <button type="button" onClick={() => ref.current?.expandToLevel(3)}>expandToLevel(3)</button>
            <button type="button" onClick={() => ref.current?.collapseAll()}>collapseAll()</button>
          </>
        )}
      />
    </div>
  );
}

const meta: Meta = { title: 'smart-kit/Tree table', parameters: { layout: 'fullscreen' }, decorators: [(Story) => <TreeService><Story /></TreeService>] };
export default meta;
type Story = StoryObj;

export const Grid: Story = { render: () => <TreeDemo /> };
export const Responsive: Story = { render: () => <TreeDemo mode="responsive" /> };
