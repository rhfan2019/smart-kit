/** "Show All (x)" target (OP Tables · Navigation to Another Page): a dynamic page with the whole table. */
import Table from '@rhfan2019/smart-kit/v4/fe/macros/Table';
import DynamicPage from '@rhfan2019/smart-kit/f/DynamicPage';
import DynamicPageTitle from '@rhfan2019/smart-kit/f/DynamicPageTitle';
import useObjectTitle from '@rhfan2019/smart-kit/kit/useObjectTitle';
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
    <DynamicPage
      fitContent title={<DynamicPageTitle heading={s('orderItems', { id: title ?? '' })} />} data-testid="show-all-page"
      content={<Table service={service} contextPath={`/${parent.replace(/\(.*$/, '')}/${nav}`} bindingContext={parent} rowCountMode="Auto" header={s('allItems')} pageKey={`all:${parent}:${nav}`} />}
    />
  );
}
