/** Object page route: /:service/object?path=<entity path>[&layout=tabs] */
import { Alert } from '@mantine/core';
import { getPath, SmartObjectPage, type SectionItem } from '@rhfan2019/smart-kit';
import { useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router';
import { useShell } from '../App';

const EXTRA = ['StatusCriticality'];

export function ObjectRoute() {
  const { service = 'purchasing' } = useParams();
  const [params] = useSearchParams();
  const path = params.get('path') ?? '';
  const { s } = useShell();
  const isOrder = service === 'purchasing' && path.startsWith('PurchaseOrders(') && !path.includes('/');
  const extra = Number(params.get('extra') ?? 0);
  const sectionExtend = useMemo(
    () => (isOrder ? [
      {
        id: 'Custom::Timeline', position: 'after' as const, anchor: 'GeneralInformation',
        item: {
          id: 'Custom::Timeline', title: s('timeline'),
          messageStrip: <Alert variant="light" data-demo-section-message>{s('timelineText')}</Alert>,
          subSections: [{ id: 'Custom::Timeline', title: s('timeline'), content: <div className="demo__card" data-demo-timeline>{s('timelineText')}</div> }],
        } satisfies SectionItem,
      },
      // ?extra=n adds n more sections (used to test the anchor overflow menu)
      ...Array.from({ length: extra }, (_, i) => ({
        id: `Custom::Extra${i + 1}`, position: 'end' as const,
        item: { id: `Custom::Extra${i + 1}`, title: `${s('timeline')} ${i + 1}`, subSections: [{ id: `Custom::Extra${i + 1}`, title: `${s('timeline')} ${i + 1}`, content: <div className="demo__card">{i + 1}</div> }] } satisfies SectionItem,
      })),
    ] : undefined),
    [isOrder, s, extra],
  );
  if (!path) return null;
  return (
    <SmartObjectPage
      key={`${service}:${path}`}
      service={service}
      path={path}
      navigation={params.get('layout') === 'tabs' ? 'tabs' : 'anchor'}
      sectionExtend={sectionExtend}
      extraSelect={isOrder ? EXTRA : undefined}
      headerMessage={isOrder ? (row) => (getPath(row, 'StatusCriticality') === 1 ? <Alert color="red" variant="light" data-demo-header-message>{s('overdueMessage')}</Alert> : null) : undefined}
    />
  );
}
