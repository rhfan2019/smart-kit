/**
 * Object page route: /:service/object?path=<entity path>[&layout=Tabs|Page|tabs|anchor][&fe=<FE app>] or ?create=<entity set>
 * The settings of an object page come from the object page target of the FE reference app with the same service
 * (apps/fe-reference, `./objectPageSettings`): purchase orders use the tab layout there (an order can have up to 150
 * items; the object page guideline recommends tabs for tables of more than 50–100 and fewer than 200 items), the
 * custom section "Delivery Timeline" with the supplier information as side content, and on the draft service a
 * creation dialog for items. `?fe=purchasing-op` takes the settings of the FE app `purchasing-op` (custom header
 * facet and actions, footer action, header not editable). Other objects use the defaults.
 * `?layout=` overrides the section layout (tests), `?extra=n` adds n sections (anchor overflow), `?letterbox=1`.
 * Demo additions without a manifest setting: a message strip under the title, the status as key information, a message
 * strip and layout blocks in the custom section (docs/13).
 */
import { Alert } from '@mantine/core';
import { getPath } from '@rhfan2019/smart-kit';
import ObjectPage, { type ObjectPageManifestSettings } from '@rhfan2019/smart-kit/v4/fe/templates/ObjectPage';
import GenericTag from '@rhfan2019/smart-kit/m/GenericTag';
import { useMemo, useRef } from 'react';
import { useParams, useSearchParams } from 'react-router';
import { useShell } from '../App';
import { feObjectPageSettings, FE_APPS, resolveSettings, type FeApp } from './objectPageSettings';

/** UI.CriticalityType (0–5) as the ValueState of a GenericTag. */
const CRITICALITY_STATE = ['None', 'Error', 'Warning', 'Success', 'None', 'Information'] as const;

const EXTRA = ['StatusCriticality', 'Status', '_Status/Name'];

/** FE apps whose object page targets the demo uses for a service (the first with a target of the entity set). */
const APPS_OF_SERVICE: Record<string, FeApp[]> = { purchasing: ['purchasing', 'purchasing-display'], 'purchasing-draft': ['purchasing-draft'] };

export function ObjectRoute() {
  const { service = 'purchasing' } = useParams();
  const [params] = useSearchParams();
  const path = params.get('path') ?? '';
  const create = params.get('create');
  const { s, locale } = useShell();
  const page = useRef<ObjectPage>(null);
  const isOrder = service.startsWith('purchasing') && (create === 'PurchaseOrders' || (path.startsWith('PurchaseOrders(') && !path.includes('/')));
  const extra = Number(params.get('extra') ?? 0);
  const fe = params.get('fe');
  // ?layout=Tabs | Page (also the older tabs | anchor)
  const layout = ({ tabs: 'Tabs', anchor: 'Page', Tabs: 'Tabs', Page: 'Page' } as const)[params.get('layout') ?? ''];
  const entitySet = create ?? (path.includes('/') ? undefined : path.split('(')[0]);
  const settings = useMemo((): ObjectPageManifestSettings => {
    const apps = fe && fe in FE_APPS ? [fe as FeApp] : APPS_OF_SERVICE[service] ?? [];
    const json = entitySet ? apps.map((a) => feObjectPageSettings(a, entitySet)).find(Boolean) : undefined;
    const out = json ? resolveSettings(json, { locale, s, page }) : {};
    const sections = { ...out.content?.body?.sections };
    // Demo additions to the custom section: a message strip and layout blocks (OP Blocks: 1, 2 and 3 columns, one behind "Show More").
    const timeline = sections['Custom::Timeline'];
    if (timeline?.subSections?.['Custom::Timeline']) {
      sections['Custom::Timeline'] = {
        ...timeline,
        messageStrip: <Alert variant="light" data-demo-section-message>{s('timelineText')}</Alert>,
        subSections: {
          'Custom::Timeline': {
            ...timeline.subSections['Custom::Timeline'],
            blocks: [
              { id: 'one', columns: 1, content: <div className="demo__card">{s('blockOne')}</div> },
              { id: 'two', columns: 2, content: <div className="demo__card">{s('blockTwo')}</div> },
              { id: 'three', columns: 3, content: <div className="demo__card">{s('blockThree')}</div> },
              { id: 'more', columns: 1, more: true, content: <div className="demo__card">{s('blockMore')}</div> },
            ],
          },
        },
      };
    }
    // ?extra=n adds n more sections at the end (used to test the anchor overflow menu)
    for (let i = 1; i <= extra; i++) {
      sections[`Custom::Extra${i}`] = { title: `${s('timeline')} ${i}`, position: { placement: 'End' }, template: () => <div className="demo__card">{i}</div> };
    }
    return {
      ...out,
      ...(layout ? { sectionLayout: layout } : {}),
      content: { ...out.content, body: { ...out.content?.body, sections } },
    };
  }, [fe, service, entitySet, locale, s, extra, layout]);
  if (!path && !create) return null;
  return (
    <ObjectPage
      key={`${service}:${path}:${create ?? ''}:${fe ?? ''}`}
      ref={page}
      {...settings}
      service={service}
      path={path}
      create={create ? { entitySet: create } : undefined}
      additionalProperties={isOrder ? EXTRA : settings.additionalProperties}
      headerMessage={isOrder ? (row) => (getPath(row, 'StatusCriticality') === 1 ? <Alert color="red" variant="light" data-demo-header-message>{s('overdueMessage')}</Alert> : null) : undefined}
      keyInfo={isOrder && !create ? (row) => (row ? <GenericTag text={s('statusTag')} value={String(getPath(row, '_Status/Name') ?? getPath(row, 'Status') ?? '')} status={CRITICALITY_STATE[Number(getPath(row, 'StatusCriticality') ?? 0)] ?? 'None'} /> : null) : undefined}
      letterboxing={params.get('letterbox') === '1'}
    />
  );
}
