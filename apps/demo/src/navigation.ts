/**
 * Example NavigationAdapter for React Router (docs/06 §5). Copy and adapt it in your application;
 * it is not part of the library.
 */
import type { NavigationAdapter } from '@rhfan2019/smart-kit-core';
import type { NavigateFunction } from 'react-router';

/** Entity sets that have a list page route, per service. */
export const LIST_ROUTES: Record<string, Record<string, string>> = {
  purchasing: { PurchaseOrders: '/po' },
  'purchasing-draft': { PurchaseOrders: '/po-draft' },
  northwind: { Products: '/nw/products', Orders: '/nw/orders' },
};

/** Entity sets that have an object page, per service. */
export const OBJECT_PAGES: Record<string, string[]> = {
  purchasing: ['PurchaseOrders', 'PurchaseOrderItems'],
  'purchasing-draft': ['PurchaseOrders', 'PurchaseOrderItems'],
  northwind: ['Products', 'Orders', 'Categories', 'Suppliers', 'Customers'],
};

export const objectHref = (service: string, path: string) => `/${service}/object?path=${encodeURIComponent(path)}`;

export function createNavigationAdapter(navigate: NavigateFunction): NavigationAdapter {
  return {
    toObject: (path, service = 'purchasing') => navigate(objectHref(service, path)),
    toList: (entitySet, service = 'purchasing') => navigate(LIST_ROUTES[service]?.[entitySet] ?? '/'),
    href: (target) => {
      const service = target.service ?? 'purchasing';
      return target.kind === 'object' ? objectHref(service, target.path) : LIST_ROUTES[service]?.[target.entitySet];
    },
    hasObjectPage: (entitySet, service = 'purchasing') => OBJECT_PAGES[service]?.includes(entitySet) ?? false,
    toTable: (parent, nav, service = 'purchasing') => navigate(`/${service}/table?parent=${encodeURIComponent(parent)}&nav=${encodeURIComponent(nav)}`),
  };
}
