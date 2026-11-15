/**
 * Flexible column layout (NAV-07, ADR-022): list in the first column, object page in the second, sub-object page in
 * the third. The layout lives in the URL: /fcl?object=<path>&sub=<path>&layout=<FclLayout>.
 */
import { FlexibleColumnLayout, SmartListReport, SmartObjectPage, type FclLayout } from '@rhfan2019/smart-kit';
import type { Row } from '@rhfan2019/smart-kit-core';
import { useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router';

const LAYOUTS: FclLayout[] = ['OneColumn', 'TwoColumnsMidExpanded', 'ThreeColumnsMidExpanded', 'MidColumnFullScreen', 'EndColumnFullScreen'];

export function FclPage() {
  const [params, setParams] = useSearchParams();
  const object = params.get('object') ?? undefined;
  const sub = params.get('sub') ?? undefined;
  const requested = params.get('layout') as FclLayout | null;
  const layout: FclLayout = requested && LAYOUTS.includes(requested) ? requested : sub ? 'ThreeColumnsMidExpanded' : object ? 'TwoColumnsMidExpanded' : 'OneColumn';
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
  return (
    <FlexibleColumnLayout
      layout={layout}
      onLayoutChange={(l) => update({ layout: l })}
      begin={(
        <SmartListReport
          entitySet="PurchaseOrders" pageKey="fcl:po" onRowsChange={(r) => { rows.current = r; }}
          onRowNavigate={(_row, path) => update({ object: path, sub: undefined, layout: undefined })}
        />
      )}
      mid={object ? (
        <SmartObjectPage
          key={object} path={object} navigation="anchor"
          onRowNavigate={(_row, path) => update({ sub: path, layout: undefined })}
        />
      ) : undefined}
      end={sub ? <SmartObjectPage key={sub} path={sub} navigation="anchor" paging={false} /> : undefined}
      onCloseMid={() => update({ object: undefined, sub: undefined, layout: undefined })}
      onCloseEnd={() => update({ sub: undefined, layout: undefined })}
      midPaging={{ onPrevious: () => page(-1), onNext: () => page(1) }}
    />
  );
}
