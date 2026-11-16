/**
 * Object page route: /:service/object?path=<entity path>[&layout=tabs|anchor] or ?create=<entity set>
 * Purchase orders use tab navigation by default: an order can have up to 150 items, and the object page guideline
 * recommends tabs for tables of more than 50–100 and fewer than 200 items. Other objects use anchor navigation.
 * Phase 2: create mode, a generic tag in the key information, side content and layout blocks (docs/13).
 */
import { Alert } from '@mantine/core';
import { GenericTag, getPath, SmartObjectPage, type SectionItem } from '@rhfan2019/smart-kit';
import { useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router';
import { useShell } from '../App';

const EXTRA = ['StatusCriticality', 'Status', '_Status/Name'];

export function ObjectRoute() {
  const { service = 'purchasing' } = useParams();
  const [params] = useSearchParams();
  const path = params.get('path') ?? '';
  const create = params.get('create');
  const { s } = useShell();
  const isOrder = service.startsWith('purchasing') && (create === 'PurchaseOrders' || (path.startsWith('PurchaseOrders(') && !path.includes('/')));
  const extra = Number(params.get('extra') ?? 0);
  const sectionExtend = useMemo(
    () => (isOrder && !create ? [
      {
        id: 'Custom::Timeline', position: 'after' as const, anchor: 'GeneralInformation',
        item: {
          id: 'Custom::Timeline', title: s('timeline'),
          messageStrip: <Alert variant="light" data-demo-section-message>{s('timelineText')}</Alert>,
          subSections: [{
            id: 'Custom::Timeline', title: s('timeline'), content: <div className="demo__card" data-demo-timeline>{s('timelineText')}</div>,
            // Layout blocks (OP Blocks): 1, 2 and 3 columns, one more behind "Show More".
            blocks: [
              { id: 'one', columns: 1 as const, content: <div className="demo__card">{s('blockOne')}</div> },
              { id: 'two', columns: 2 as const, content: <div className="demo__card">{s('blockTwo')}</div> },
              { id: 'three', columns: 3 as const, content: <div className="demo__card">{s('blockThree')}</div> },
              { id: 'more', columns: 1 as const, more: true, content: <div className="demo__card">{s('blockMore')}</div> },
            ],
          }],
        } satisfies SectionItem,
      },
      // ?extra=n adds n more sections (used to test the anchor overflow menu)
      ...Array.from({ length: extra }, (_, i) => ({
        id: `Custom::Extra${i + 1}`, position: 'end' as const,
        item: { id: `Custom::Extra${i + 1}`, title: `${s('timeline')} ${i + 1}`, subSections: [{ id: `Custom::Extra${i + 1}`, title: `${s('timeline')} ${i + 1}`, content: <div className="demo__card">{i + 1}</div> }] } satisfies SectionItem,
      })),
    ] : undefined),
    [isOrder, s, extra, create],
  );
  if (!path && !create) return null;
  return (
    <SmartObjectPage
      key={`${service}:${path}:${create ?? ''}`}
      service={service}
      path={path}
      create={create ? { entitySet: create } : undefined}
      navigation={(params.get('layout') ?? (isOrder ? 'tabs' : 'anchor')) === 'tabs' ? 'tabs' : 'anchor'}
      sectionExtend={sectionExtend}
      extraSelect={isOrder ? EXTRA : undefined}
      headerMessage={isOrder ? (row) => (getPath(row, 'StatusCriticality') === 1 ? <Alert color="red" variant="light" data-demo-header-message>{s('overdueMessage')}</Alert> : null) : undefined}
      keyInfo={isOrder && !create ? (row) => (row ? <GenericTag text={s('statusTag')} value={String(getPath(row, '_Status/Name') ?? getPath(row, 'Status') ?? '')} status={Number(getPath(row, 'StatusCriticality') ?? 0)} /> : null) : undefined}
      sideContent={isOrder && !create ? (row) => <div className="demo__card" data-demo-side-content>{s('supplierInfoText', { id: String(getPath(row, 'Supplier') ?? '') })}</div> : undefined}
      sideContentTitle={s('supplierInfo')}
      subObjectCreate={service === 'purchasing-draft' ? { _Item: 'dialog' } : { _Item: 'inline' }}
      letterboxing={params.get('letterbox') === '1'}
    />
  );
}
