/**
 * Flexible column layout (NAV-07, ADR-022): list in the first column, object page in the second, sub-object page in
 * the third. The layout lives in the URL: /fcl?object=<path>&sub=<path>&layout=<LayoutType>.
 */
import ListReport from '@rhfan2019/smart-kit/v4/fe/templates/ListReport';
import ObjectPage from '@rhfan2019/smart-kit/v4/fe/templates/ObjectPage';
import FlexibleColumnLayout, { type $FlexibleColumnLayoutSettings, type FlexibleColumnLayout$StateChangeEvent } from '@rhfan2019/smart-kit/f/FlexibleColumnLayout';
import type { Row } from '@rhfan2019/smart-kit-core';
import { useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router';

type LayoutType = NonNullable<$FlexibleColumnLayoutSettings['layout']>;

const LAYOUTS: LayoutType[] = [
  'OneColumn', 'TwoColumnsBeginExpanded', 'TwoColumnsMidExpanded', 'ThreeColumnsMidExpanded', 'ThreeColumnsEndExpanded',
  'ThreeColumnsMidExpandedEndHidden', 'ThreeColumnsBeginExpandedEndHidden', 'MidColumnFullScreen', 'EndColumnFullScreen',
];

export function FclPage() {
  const [params, setParams] = useSearchParams();
  const object = params.get('object') ?? undefined;
  const sub = params.get('sub') ?? undefined;
  const requested = params.get('layout') as LayoutType | null;
  const layout: LayoutType = requested && LAYOUTS.includes(requested) ? requested : sub ? 'ThreeColumnsMidExpanded' : object ? 'TwoColumnsMidExpanded' : 'OneColumn';
  const update = (next: Record<string, string | undefined>) => {
    const p = new URLSearchParams(params);
    for (const [k, v] of Object.entries(next)) if (v === undefined) p.delete(k); else p.set(k, v);
    setParams(p);
  };
  // Rows of the list for the paging buttons of the object column.
  const rows = useRef<Row[]>([]);
  const index = useMemo(() => () => rows.current.findIndex((r) => `PurchaseOrders('${String(r.PurchaseOrder)}')` === object), [object]);
  const page = (d: -1 | 1) => {
    const r = rows.current[index() + d];
    if (r) update({ object: `PurchaseOrders('${String(r.PurchaseOrder)}')`, sub: undefined, layout: undefined });
  };
  // The layout decides the columns (as Fiori elements does): closing a column drops its object from the URL.
  const onStateChange = (e: FlexibleColumnLayout$StateChangeEvent) => {
    if (e.isResize) return;
    if (e.layout === 'OneColumn') update({ object: undefined, sub: undefined, layout: undefined });
    else if (sub && e.layout.startsWith('TwoColumns')) update({ sub: undefined, layout: undefined });
    else update({ layout: e.layout });
  };
  return (
    <FlexibleColumnLayout
      layout={layout}
      onStateChange={onStateChange}
      beginColumnPages={(
        <ListReport
          contextPath="/PurchaseOrders" pageKey="fcl:po" onRowsChange={(r) => { rows.current = r; }}
          controlConfiguration={{ '@com.sap.vocabularies.UI.v1.LineItem': { tableSettings: { type: 'GridTable', rowPress: (e) => update({ object: e.bindingContext.getPath().slice(1), sub: undefined, layout: undefined }) } } }}
        />
      )}
      midColumnPages={object ? (
        <ObjectPage
          key={object} path={object}
          onRowNavigate={(_row, path) => update({ sub: path, layout: undefined })}
        />
      ) : undefined}
      endColumnPages={sub ? <ObjectPage key={sub} path={sub} paging={false} /> : undefined}
      midPaging={{ onPrevious: () => page(-1), onNext: () => page(1) }}
    />
  );
}
