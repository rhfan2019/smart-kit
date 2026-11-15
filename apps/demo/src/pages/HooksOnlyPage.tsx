/** No default UI at all: only headless hooks and plain HTML (AC-EXT-04). */
import { getPath, useFilterState, useListQuery, useMetaModel, useObject } from '@rhfan2019/smart-kit';
import { useState } from 'react';
import { useShell } from '../App';

function Detail({ path }: { path: string }) {
  const obj = useObject(path);
  const { s } = useShell();
  if (!obj.data) return null;
  const fields = obj.ui.sections[0]?.subSections[0]?.content;
  return (
    <div className="demo__card" data-demo-detail>
      <h2>{s('detail')}: {String(getPath(obj.data, obj.ui.headerInfo.title ?? '') ?? '')}</h2>
      <dl>
        {fields?.kind === 'form' ? fields.groups.flatMap((g) => g.fields).map((f) => (
          <div key={f.id}><dt>{f.label}</dt><dd>{f.path ? String(getPath(obj.data, f.path) ?? '') : ''}</dd></div>
        )) : null}
      </dl>
    </div>
  );
}

export function HooksOnlyPage() {
  const { s } = useShell();
  const { ui } = useMetaModel('PurchaseOrders');
  const filter = useFilterState('PurchaseOrders', { pageKey: 'hooks' });
  const columns = ui.lineItem.filter((c) => c.kind === 'field').slice(0, 4);
  const list = useListQuery({ source: { entitySet: 'PurchaseOrders' }, columns, filters: filter.applied?.filters, search: filter.applied?.search, enabled: filter.applied !== null, pageSize: 15 });
  const [selected, setSelected] = useState<string | null>(null);
  return (
    <div className="demo__split" data-demo-hooks>
      <div>
        <form onSubmit={(e) => { e.preventDefault(); filter.go(); }}>
          <input aria-label={s('search')} value={filter.search} onChange={(e) => filter.setSearch(e.target.value)} placeholder={s('search')} />
          <button type="submit">{s('go')}</button>
          <span> {s('rows', { count: list.count ?? 0 })}</span>
        </form>
        <table className="demo__table">
          <thead><tr>{columns.map((c) => <th key={c.id}>{c.label}</th>)}</tr></thead>
          <tbody>
            {list.rows.map((r) => {
              const path = `PurchaseOrders('${String(r.PurchaseOrder)}')`;
              return (
                <tr key={path} aria-selected={selected === path} onClick={() => setSelected(path)} data-demo-row>
                  {columns.map((c) => <td key={c.id}>{String(getPath(r, c.path!) ?? '')}</td>)}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {selected ? <Detail path={selected} /> : <p>{s('noSelection')}</p>}
    </div>
  );
}
