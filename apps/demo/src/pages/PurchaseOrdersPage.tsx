/**
 * Purchase order list: the list report template with the settings of the FE reference app (apps/fe-reference
 * `purchasing` / `purchasing-draft` manifest, AL-13 F) and their React extensions (AC-EXT-01, AC-EXT-02).
 * Query parameters (docs/13) switch to the other FE manifests or change single settings:
 * views=tabs (`purchasing-views`), chart=1 (`purchasing-chart`: a table view and a chart view), table=analytical
 * (`purchasing-analytical`); mode=manual (`liveMode: false`), table=responsive (`tableSettings.type`; table=auto: responsive
 * below 600 px, chosen by the app), table=annotation (no
 * `type`: chosen from the annotations as FE), views=switch|select|type-switch (`tableSettings.quickVariantSelection`),
 * views=type (views by order type from the demo's local annotations, src/annotations.ts), contents=1 (a view per
 * entity set), kpi=1 (`keyPerformanceIndicators`: the KPI tag UI.KPI#OpenAmount); initialLoad=Auto|Disabled|Enabled,
 * vm=None, selection=None|Single|Multi|Auto, export=0, creation=CreationDialog, threshold=<n> (tests/e2e-fe/lr5.spec.ts).
 */
import ListReport, { type $ListReportSettings } from '@rhfan2019/smart-kit/v4/fe/templates/ListReport';
import MessageToast from '@rhfan2019/smart-kit/m/MessageToast';
import type { Row } from '@rhfan2019/smart-kit-core';
import { useMemo } from 'react';
import { useSearchParams } from 'react-router';
import purchasing from '../../../fe-reference/webapp/purchasing/manifest.json';
import purchasingDraft from '../../../fe-reference/webapp/purchasing-draft/manifest.json';
import purchasingViews from '../../../fe-reference/webapp/purchasing-views/manifest.json';
import purchasingChart from '../../../fe-reference/webapp/purchasing-chart/manifest.json';
import purchasingAnalytical from '../../../fe-reference/webapp/purchasing-analytical/manifest.json';
import { useShell } from '../App';
import { ORDER_TYPE_VIEWS } from '../annotations';
import { listReportSettings, withTableSettings } from '../feListReport';
import type { ShellKey } from '../shellText';

const SPV = 'com.sap.vocabularies.UI.v1.SelectionPresentationVariant';
const spv = (q: string) => ({ annotationPath: `${SPV}#${q}` });

export function PurchaseOrdersPage({ service = 'purchasing' }: { service?: string }) {
  const { s } = useShell();
  const [params] = useSearchParams();
  const settings = useMemo<$ListReportSettings>(() => {
    const viewsParam = params.get('views');
    const table = params.get('table');
    const manifest = table === 'analytical' ? purchasingAnalytical : params.get('chart') ? purchasingChart : viewsParam === 'tabs' ? purchasingViews : service === 'purchasing-draft' ? purchasingDraft : purchasing;
    let out = listReportSettings(manifest, {
      text: (key) => s(key as ShellKey),
      templates: {
        // apps/fe-reference/webapp/ext/Overdue.fragment.xml
        'fe.ref.ext.Overdue': (row: Row) => (row.StatusCriticality === 1 ? <span className="demo__overdue" data-demo-overdue>{s('overdue')}</span> : null),
      },
      handlers: {
        // apps/fe-reference/webapp/ext/CustomActions.js copy
        'fe.ref.ext.CustomActions.copy': (e: { selectedContexts: { getObject(): Row }[] }) => MessageToast.show(s('copied', { ids: e.selectedContexts.map((c) => String(c.getObject().PurchaseOrder)).join(', ') })),
      },
    });
    if (params.get('mode') === 'manual') out = { ...out, liveMode: false };
    if (table === 'responsive') out = withTableSettings(out, { type: 'ResponsiveTable' });
    // the app chooses the responsive table on phones (FE has no automatic switch; LR Responsiveness)
    if (table === 'auto') out = withTableSettings(out, { type: window.innerWidth < 600 ? 'ResponsiveTable' : 'GridTable' });
    if (table === 'annotation') out = withTableSettings(out, { type: undefined });
    if (viewsParam === 'switch') out = withTableSettings(out, { quickVariantSelection: { paths: ['Open', 'InDelivery', 'Closed'].map(spv) } });
    if (viewsParam === 'select') out = withTableSettings(out, { quickVariantSelection: { paths: ['All', 'Open', 'InDelivery', 'Closed'].map(spv) } });
    if (viewsParam === 'type-switch') out = withTableSettings(out, { quickVariantSelection: { paths: ORDER_TYPE_VIEWS.map(spv) } });
    if (viewsParam === 'type') out = { ...out, views: { paths: ORDER_TYPE_VIEWS.map((q) => ({ key: q, ...spv(q) })), showCounts: true } };
    if (params.get('contents')) {
      out = { ...out, views: { paths: [{ key: 'orders', annotationPath: 'com.sap.vocabularies.UI.v1.LineItem' }, { key: 'items', entitySet: 'PurchaseOrderItems', annotationPath: 'com.sap.vocabularies.UI.v1.LineItem' }] } };
    }
    if (params.get('kpi')) out = { ...out, keyPerformanceIndicators: { openAmount: { qualifier: 'OpenAmount' } } };
    // single settings of the FE comparison tests/e2e-fe/lr5.spec.ts (the FE side lays the same values over the manifest)
    const initialLoad = params.get('initialLoad');
    if (initialLoad === 'Auto' || initialLoad === 'Disabled' || initialLoad === 'Enabled') out = { ...out, initialLoad };
    if (params.get('vm') === 'None') out = { ...out, variantManagement: 'None' };
    const selection = params.get('selection');
    if (selection === 'None' || selection === 'Single' || selection === 'Multi' || selection === 'Auto') out = withTableSettings(out, { selectionMode: selection });
    if (params.get('export') === '0') out = withTableSettings(out, { enableExport: false });
    if (params.get('creation') === 'CreationDialog') out = withTableSettings(out, { creationMode: { name: 'CreationDialog' } });
    const threshold = Number(params.get('threshold'));
    if (threshold > 0) out = withTableSettings(out, { threshold });
    return out;
  }, [params, service, s]);
  return (
    <ListReport
      key={`${service}:${params.toString()}`}
      service={service}
      pageKey={service === 'purchasing' ? 'po' : `po:${service}`}
      {...settings}
    />
  );
}
