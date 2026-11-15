/** One header facet: form, key value, rating, progress, plain text (OP-04). */
import type { FieldModel, HeaderFacetModel, Row } from '@rhfan2019/smart-kit-core';
import type { ReactNode } from 'react';
import { useService, useSmartKit } from '../context/SmartKitProvider';
import { CriticalityIcon, SmartField } from '../field/SmartField';
import { fieldValue } from '../field/values';

export interface HeaderFacetProps {
  facet?: HeaderFacetModel;
  typeName: string;
  row: Row | undefined;
  service?: string;
  /** Plain text facet or custom content. */
  title?: ReactNode;
  children?: ReactNode;
}

const STATUS = ['neutral', 'negative', 'critical', 'positive', 'neutral', 'info'];

export function HeaderFacet(p: HeaderFacetProps) {
  const service = useService(p.service);
  const { intlLocale, timeZone } = useSmartKit();
  if (!p.facet) {
    return (
      <div className="sk-facet sk-facet--text">
        {p.title ? <div className="sk-facet__title">{p.title}</div> : null}
        <div className="sk-facet__text">{p.children}</div>
      </div>
    );
  }
  const f = p.facet;
  if (f.kind === 'form') {
    return (
      <div className="sk-facet sk-facet--form" data-sk-facet={f.id}>
        {f.label ? <div className="sk-facet__title">{f.label}</div> : null}
        <dl className="sk-facet__pairs">
          {f.fields.slice(0, 5).map((fd) => (
            <div key={fd.id} className="sk-facet__pair">
              <dt>{fd.label}:</dt>
              <dd><SmartField typeName={p.typeName} service={p.service} field={fd} row={p.row} /></dd>
            </div>
          ))}
        </dl>
      </div>
    );
  }
  const dp = f.dataPoint;
  const field: FieldModel = { id: f.id, kind: 'dataPoint', dataPoint: dp, label: f.label ?? dp.title, criticalityIcon: true, isSemanticKey: false };
  if (dp.visualization !== 'Number') {
    return (
      <div className={`sk-facet sk-facet--${dp.visualization.toLowerCase()}`} data-sk-facet={f.id}>
        <div className="sk-facet__title">{f.label ?? dp.title}</div>
        <div className="sk-facet__chart"><SmartField typeName={p.typeName} service={p.service} field={field} row={p.row} /></div>
      </div>
    );
  }
  const v = fieldValue({ model: service.model, typeName: p.typeName, locale: intlLocale, timeZone }, field, p.row);
  const crit = v.criticality;
  return (
    <div className="sk-facet sk-facet--kpi" data-sk-facet={f.id}>
      <div className="sk-facet__title">{f.label ?? dp.title}</div>
      <div className={['sk-facet__kpi', crit !== undefined ? `sk-status sk-status--${STATUS[crit] ?? 'neutral'}` : ''].join(' ')}>
        <span className="sk-facet__kpi-value">{v.display}</span>
        {v.unit ? <span className="sk-facet__kpi-unit">{v.unit}</span> : null}
        {crit !== undefined ? <CriticalityIcon criticality={crit} /> : null}
      </div>
    </div>
  );
}
