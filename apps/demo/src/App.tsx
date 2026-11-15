import { Alert, Loader, MantineProvider, SegmentedControl, Select } from '@mantine/core';
import { DatesProvider } from '@mantine/dates';
import { createSessionPageStateStore, loadService, ODataVariantStore, type FetchLike } from '@rhfan2019/smart-kit-core';
import { smartKitCssVariablesResolver, smartKitMantineTheme, SmartKitProvider, type Locale, type ServiceConfig } from '@rhfan2019/smart-kit';
import 'dayjs/locale/zh-cn';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { NavLink, Route, Routes, useLocation, useNavigate } from 'react-router';
import { createNavigationAdapter } from './navigation';
import { AboutPage, HomePage } from './pages/HostPages';
import { FreestylePage } from './pages/FreestylePage';
import { HooksOnlyPage } from './pages/HooksOnlyPage';
import { NorthwindListPage } from './pages/NorthwindPages';
import { ObjectRoute } from './pages/ObjectRoute';
import { PurchaseOrdersPage } from './pages/PurchaseOrdersPage';
import { shellText, type ShellKey } from './shellText';

const fetchJson: FetchLike = (url, init) => fetch(url, init);

const SERVICES = { purchasing: '/odata/purchasing/', northwind: '/odata/northwind/' } as const;

const ShellCtx = createContext<{ locale: Locale; s(key: ShellKey, params?: Record<string, string | number>): string }>({ locale: 'zh', s: (k) => k });
export const useShell = () => useContext(ShellCtx);

const read = <T extends string>(key: string, fallback: T, allowed: readonly T[]): T => {
  try {
    const v = new URLSearchParams(window.location.search).get(key) ?? localStorage.getItem(`demo:${key}`);
    return v && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
  } catch {
    return fallback;
  }
};
const remember = (key: string, v: string) => { try { localStorage.setItem(`demo:${key}`, v); } catch { /* ignore */ } };

export function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const [locale, setLocale] = useState<Locale>(() => read('lang', 'zh', ['zh', 'en'] as const));
  const [theme, setTheme] = useState(() => read('theme', 'yellow', ['yellow', 'navy', 'dark'] as const));
  const [density, setDensity] = useState(() => read('density', 'comfortable', ['comfortable', 'compact'] as const));
  const [services, setServices] = useState<Record<string, ServiceConfig> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.density = density;
    document.documentElement.lang = locale;
  }, [theme, density, locale]);

  useEffect(() => {
    let cancelled = false;
    setServices(null);
    Promise.all(Object.entries(SERVICES).map(async ([name, url]) => {
      const { model, provider } = await loadService({ serviceUrl: url, fetch: fetchJson, language: locale });
      const cfg: ServiceConfig = { model, dataProvider: provider, variants: model.entitySets.Variants ? new ODataVariantStore(provider) : undefined };
      return [name, cfg] as const;
    }))
      .then((entries) => { if (!cancelled) setServices(Object.fromEntries(entries)); })
      .catch((e: Error) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [locale]);

  const navigation = useMemo(() => createNavigationAdapter(navigate), [navigate]);
  const pageState = useMemo(() => createSessionPageStateStore('smart-kit-demo'), []);
  const shell = useMemo(() => ({ locale, s: (k: ShellKey, p?: Record<string, string | number>) => shellText(locale, k, p) }), [locale]);
  const fill = /^\/(po|nw\/products|nw\/orders|freestyle)\/?$/.test(location.pathname);

  return (
    <MantineProvider theme={smartKitMantineTheme} cssVariablesResolver={smartKitCssVariablesResolver} forceColorScheme="light">
      <DatesProvider settings={{ locale: locale === 'zh' ? 'zh-cn' : 'en' }}>
        <ShellCtx.Provider value={shell}>
          <div className="demo">
            <header className="demo__bar">
              <span className="demo__brand">{shell.s('app')}</span>
              <nav className="demo__nav">
                <NavLink to="/po">{shell.s('po')}</NavLink>
                <NavLink to="/nw/products">{shell.s('products')}</NavLink>
                <NavLink to="/nw/orders">{shell.s('orders')}</NavLink>
                <NavLink to="/freestyle">{shell.s('freestyle')}</NavLink>
                <NavLink to="/hooks">{shell.s('hooks')}</NavLink>
                <NavLink to="/about">{shell.s('about')}</NavLink>
              </nav>
              <SegmentedControl size="xs" aria-label={shell.s('language')} value={locale} onChange={(v) => { setLocale(v as Locale); remember('lang', v); }} data={[{ value: 'zh', label: '中文' }, { value: 'en', label: 'English' }]} data-demo-lang />
              <Select size="xs" w={120} aria-label={shell.s('theme')} value={theme} allowDeselect={false} onChange={(v) => { if (v) { setTheme(v as typeof theme); remember('theme', v); } }} data={(['yellow', 'navy', 'dark'] as const).map((v) => ({ value: v, label: shell.s(v) }))} data-demo-theme />
              <Select size="xs" w={120} aria-label={shell.s('density')} value={density} allowDeselect={false} onChange={(v) => { if (v) { setDensity(v as typeof density); remember('density', v); } }} data={(['comfortable', 'compact'] as const).map((v) => ({ value: v, label: shell.s(v) }))} data-demo-density />
            </header>
            <main className={fill ? 'demo__main demo__main--fill' : 'demo__main'} id="demo-main">
              {error ? (
                <Alert color="red" m="lg" title={shell.s('loadFailed')}>{error}</Alert>
              ) : !services ? (
                <div className="demo__page"><Loader size="sm" /> {shell.s('loading')}</div>
              ) : (
                <SmartKitProvider services={services} defaultService="purchasing" locale={locale} namespace="smart-kit-demo" navigation={navigation} pageState={pageState}>
                  <Routes>
                    <Route path="/" element={<HomePage />} />
                    <Route path="/po" element={<PurchaseOrdersPage />} />
                    <Route path="/nw/products" element={<NorthwindListPage entitySet="Products" />} />
                    <Route path="/nw/orders" element={<NorthwindListPage entitySet="Orders" />} />
                    <Route path="/freestyle" element={<FreestylePage />} />
                    <Route path="/hooks" element={<HooksOnlyPage />} />
                    <Route path="/:service/object" element={<ObjectRoute />} />
                    <Route path="/about" element={<AboutPage />} />
                  </Routes>
                </SmartKitProvider>
              )}
            </main>
          </div>
        </ShellCtx.Provider>
      </DatesProvider>
    </MantineProvider>
  );
}
