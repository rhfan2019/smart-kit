/** Root provider: services, language, navigation, state stores, renderers. See docs/03-component-inventory.md §1. */
import {
  capabilitiesFor, getEntitySet, MemoryPageStateStore, type CapabilityModel, type DataProvider, type EntitySetModel, type EntityTypeModel,
  type EntityUi, type MetaModel, type NavigationAdapter, type PageStateStore, type VariantStore,
} from '@rhfan2019/smart-kit-core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { createText, INTL_LOCALE, type Locale, type TextFn } from '../i18n/text';
import type { Messages } from '../i18n/messages.en';
import type { RendererRegistry } from '../field/renderers';

export interface ServiceConfig {
  model: MetaModel;
  dataProvider: DataProvider;
  variants?: VariantStore;
}

export interface SmartKitProviderProps {
  services: Record<string, ServiceConfig>;
  /** Service used when a building block does not name one. Defaults to the first service. */
  defaultService?: string;
  locale: Locale;
  /** Overrides of library texts. */
  messages?: Partial<Messages>;
  /** IANA time zone for Edm.DateTimeOffset display and filtering. Defaults to the browser's zone. */
  timeZone?: string;
  navigation?: NavigationAdapter;
  pageState?: PageStateStore;
  /** Prefix of every page state key and query key, e.g. "my-app". */
  namespace: string;
  renderers?: RendererRegistry;
  queryClient?: QueryClient;
  children?: ReactNode;
}

export interface SmartKitContextValue {
  services: Record<string, ServiceConfig>;
  defaultService: string;
  locale: Locale;
  intlLocale: string;
  t: TextFn;
  timeZone?: string;
  navigation?: NavigationAdapter;
  pageState: PageStateStore;
  namespace: string;
  renderers: RendererRegistry;
}

const SmartKitContext = createContext<SmartKitContextValue | null>(null);

export class MissingProviderError extends Error {
  override name = 'MissingProviderError';
}

export function SmartKitProvider(p: SmartKitProviderProps) {
  const [ownClient] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false, staleTime: 30_000 } } }));
  const [ownState] = useState(() => new MemoryPageStateStore());
  const value = useMemo<SmartKitContextValue>(
    () => ({
      services: p.services,
      defaultService: p.defaultService ?? Object.keys(p.services)[0] ?? '',
      locale: p.locale,
      intlLocale: INTL_LOCALE[p.locale],
      t: createText(p.locale, p.messages),
      timeZone: p.timeZone,
      navigation: p.navigation,
      pageState: p.pageState ?? ownState,
      namespace: p.namespace,
      renderers: p.renderers ?? {},
    }),
    [p.services, p.defaultService, p.locale, p.messages, p.timeZone, p.navigation, p.pageState, ownState, p.namespace, p.renderers],
  );
  return (
    <QueryClientProvider client={p.queryClient ?? ownClient}>
      <SmartKitContext.Provider value={value}>{p.children}</SmartKitContext.Provider>
    </QueryClientProvider>
  );
}

export function useSmartKit(): SmartKitContextValue {
  const ctx = useContext(SmartKitContext);
  if (!ctx) throw new MissingProviderError('smart-kit building blocks must be rendered inside <SmartKitProvider>');
  return ctx;
}

export function useText(): TextFn {
  return useSmartKit().t;
}

export interface ServiceHandle extends ServiceConfig {
  name: string;
}

export function useService(name?: string): ServiceHandle {
  const ctx = useSmartKit();
  const n = name ?? ctx.defaultService;
  const s = ctx.services[n];
  const handle = useMemo(() => (s ? { name: n, ...s } : undefined), [n, s]);
  if (!handle) throw new Error(`Unknown service "${n}"`);
  return handle;
}

export interface EntitySetHandle {
  service: ServiceHandle;
  set: EntitySetModel;
  type: EntityTypeModel;
  ui: EntityUi;
  capabilities: CapabilityModel;
}

/** Metadata of an entity set (and the navigation-specific capabilities when `navigation` is given). */
export function useMetaModel(entitySet: string, opts: { service?: string } = {}): EntitySetHandle {
  const service = useService(opts.service);
  return useMemo(() => {
    const set = getEntitySet(service.model, entitySet);
    const type = service.model.entityTypes[set.typeName]!;
    return { service, set, type, ui: service.model.ui[set.typeName]!, capabilities: capabilitiesFor(service.model, entitySet) };
  }, [service, entitySet]);
}
