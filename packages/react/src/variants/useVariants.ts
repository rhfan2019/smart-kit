/** Headless variant management backed by the service's VariantStore (LR-02, ADR-014). */
import { MemoryVariantStore, STANDARD_VARIANT_ID, type Variant, type VariantContent, type VariantStore } from '@rhfan2019/smart-kit-core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useService, useSmartKit } from '../context/SmartKitProvider';
import { usePageState } from '../util/usePageState';

const fallbackStores = new WeakMap<object, VariantStore>();

export interface UseVariantsOptions {
  service?: string;
  /** Content of the built-in "Standard" variant. */
  standard: VariantContent;
  /** Called once when a default variant is selected on first load (no stored selection); apply it. */
  onDefaultLoaded?(v: Variant): void;
  /** false: the variants are not read (a list report with `variantManagement` "None"). Default true. */
  enabled?: boolean;
}

export interface VariantsApi {
  variants: Variant[];
  /** Current variant ("" is Standard). */
  currentId: string;
  current: Variant;
  isLoading: boolean;
  /** Whether views may be saved (VariantStore.canSave, default true). */
  canSave: boolean;
  select(id: string): Variant;
  saveAs(name: string, content: VariantContent, opts: { isDefault: boolean; autoApply: boolean }): Promise<Variant>;
  save(content: VariantContent): Promise<Variant | undefined>;
  update(v: Variant): Promise<void>;
  remove(id: string): Promise<void>;
  setDefault(id: string): Promise<void>;
  /** Whether `content` differs from the current variant. */
  isModified(content: VariantContent): boolean;
}

const canon = (c: VariantContent) => JSON.stringify({ f: c.filters ?? {}, s: c.search ?? '', ff: c.filterFields ?? null, c: c.columns ?? null, o: c.sort ?? null, g: c.groupBy ?? null, t: c.totals ?? null });

/**
 * The `custom` state of a content (the list report: the selected view tab and quick variant; FE keeps the IconTabBar's
 * selected key as a change of the variant, MultipleModeControl handlePersonalizationUpdate "selectIconTabBarFilter"),
 * compared on the keys the saved variant has: a variant saved without them matches any value.
 */
const customOf = (c: VariantContent, saved: VariantContent) => JSON.stringify(
  Object.keys(saved.custom ?? {}).filter((k) => saved.custom![k] !== undefined && saved.custom![k] !== null).sort().map((k) => [k, c.custom?.[k] ?? null]),
);

export function useVariants(pageKey: string, o: UseVariantsOptions): VariantsApi {
  const service = useService(o.service);
  const { namespace } = useSmartKit();
  const store = useMemo(() => {
    if (service.variants) return service.variants;
    let s = fallbackStores.get(service.model);
    if (!s) { s = new MemoryVariantStore(); fallbackStores.set(service.model, s); }
    return s;
  }, [service]);
  const qc = useQueryClient();
  const key = ['smart-kit', namespace, service.name, 'variants', pageKey];
  const q = useQuery({ queryKey: key, queryFn: () => store.list(pageKey), staleTime: Infinity, enabled: o.enabled !== false });
  const variants = useMemo(() => q.data ?? [], [q.data]);
  const [state, setState] = usePageState<{ currentId: string | null }>(`${pageKey}:variant`, { currentId: null });
  const standard: Variant = useMemo(() => ({ id: STANDARD_VARIANT_ID, pageKey, name: '', isDefault: !variants.some((v) => v.isDefault), autoApply: true, content: o.standard }), [pageKey, variants, o.standard]);
  const defaultVariant = variants.find((v) => v.isDefault);
  const currentId = state.currentId ?? (q.isSuccess ? defaultVariant?.id ?? STANDARD_VARIANT_ID : STANDARD_VARIANT_ID);
  const current = variants.find((v) => v.id === currentId) ?? standard;
  const handledDefault = useRef(state.currentId !== null);
  useEffect(() => {
    if (handledDefault.current || !q.isSuccess) return;
    handledDefault.current = true;
    if (defaultVariant) {
      setState({ currentId: defaultVariant.id });
      o.onDefaultLoaded?.(defaultVariant);
    }
  }, [q.isSuccess, defaultVariant, setState, o]);

  const reload = useCallback(() => qc.invalidateQueries({ queryKey: key }), [qc, key.join('|')]); // eslint-disable-line react-hooks/exhaustive-deps

  const select = (id: string) => {
    setState({ currentId: id });
    return variants.find((v) => v.id === id) ?? standard;
  };
  const clearOtherDefaults = async (keepId: string) => {
    for (const v of variants) if (v.isDefault && v.id !== keepId) await store.save({ ...v, isDefault: false });
  };
  return {
    variants,
    currentId,
    current,
    isLoading: q.isLoading,
    canSave: store.canSave !== false,
    select,
    async saveAs(name, content, opts) {
      const v = await store.save({ id: '', pageKey, name, content, isDefault: opts.isDefault, autoApply: opts.autoApply });
      if (opts.isDefault) await clearOtherDefaults(v.id);
      await reload();
      setState({ currentId: v.id });
      return v;
    },
    async save(content) {
      if (current.id === STANDARD_VARIANT_ID) return undefined;
      const v = await store.save({ ...current, content });
      await reload();
      return v;
    },
    async update(v) {
      await store.save(v);
      if (v.isDefault) await clearOtherDefaults(v.id);
      await reload();
    },
    async remove(id) {
      await store.remove(id);
      if (currentId === id) setState({ currentId: STANDARD_VARIANT_ID });
      await reload();
    },
    async setDefault(id) {
      for (const v of variants) {
        const isDefault = v.id === id;
        if (v.isDefault !== isDefault) await store.save({ ...v, isDefault });
      }
      await reload();
    },
    isModified: (content) => canon(content) !== canon(current.content) || customOf(content, current.content) !== customOf(current.content, current.content),
  };
}
