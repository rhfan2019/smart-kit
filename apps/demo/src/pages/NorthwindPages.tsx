/** Northwind-like service without UI annotations: everything is derived (AC-BOOT-02). */
import { SmartListReport } from '@rhfan2019/smart-kit/templates';

export function NorthwindListPage({ entitySet }: { entitySet: string }) {
  return <SmartListReport key={entitySet} service="northwind" entitySet={entitySet} pageKey={`nw:${entitySet}`} />;
}
