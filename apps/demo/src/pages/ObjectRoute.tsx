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
  const sectionExtend = useMemo(
    () => (isOrder ? [{
      id: 'Custom::Timeline', position: 'after' as const, anchor: 'GeneralInformation',
      item: { id: 'Custom::Timeline', title: s('timeline'), subSections: [{ id: 'Custom::Timeline', title: s('timeline'), content: <div className="demo__card" data-demo-timeline>{s('timelineText')}</div> }] } satisfies SectionItem,
    }] : undefined),
    [isOrder, s],
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
