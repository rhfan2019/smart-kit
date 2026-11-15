/** "Show All (x)" target (OP Tables · Navigation to Another Page): a dynamic page with the whole table. */
import { DynamicPage, SmartTable, useObjectTitle } from '@rhfan2019/smart-kit';
import { useParams, useSearchParams } from 'react-router';
import { useShell } from '../App';

export function TablePage() {
  const { service = 'purchasing' } = useParams();
  const [params] = useSearchParams();
  const parent = params.get('parent') ?? '';
  const nav = params.get('nav') ?? '';
  const { s } = useShell();
  const { title } = useObjectTitle(parent, service);
  if (!parent || !nav) return null;
  return (
    <DynamicPage layout="fill" heading={s('orderItems', { id: title ?? '' })} data-testid="show-all-page">
      <SmartTable service={service} parent={{ path: parent, navigation: nav }} mode="grid" title={s('allItems')} pageKey={`all:${parent}:${nav}`} />
    </DynamicPage>
  );
}
