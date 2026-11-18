/** Northwind-like service without UI annotations: everything is derived (AC-BOOT-02). */
import ListReport from '@rhfan2019/smart-kit/v4/fe/templates/ListReport';

const GRID = { '@com.sap.vocabularies.UI.v1.LineItem': { tableSettings: { type: 'GridTable' as const } } };

export function NorthwindListPage({ entitySet }: { entitySet: string }) {
  // the grid table, as an app sets it in its manifest (FE's default would be the responsive table)
  return <ListReport key={entitySet} service="northwind" contextPath={`/${entitySet}`} pageKey={`nw:${entitySet}`} initialLoad="Enabled" controlConfiguration={GRID} />;
}
