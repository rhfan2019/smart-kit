import { MantineProvider } from '@mantine/core';
import { buildModel, MemoryProvider, MemoryVariantStore, type Row } from '@rhfan2019/smart-kit-core';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ReactNode } from 'react';
import { SmartKitProvider, smartKitMantineTheme, type Locale } from '../src';

export const shopModel = buildModel(readFileSync(join(import.meta.dirname, '../../core/test/fixtures/shop.xml'), 'utf8'));

export const shopData: Record<string, Row[]> = {
  Products: Array.from({ length: 25 }, (_, i) => ({
    ID: i + 1, Code: `P${i + 1}`, Name: `Item ${i + 1}`, Price: `${10 + i}.50`, Currency: 'EUR', CategoryID: i % 2 ? 'C1' : 'C2', Status: 'A', StatusCriticality: 3,
    Rating: '4.0', Stock: '12', ReleaseDate: '2026-01-02', Version: 1,
  })),
  Categories: [{ ID: 'C1', Name: 'Office' }, { ID: 'C2', Name: 'School' }],
  Reviews: [],
};

export function wrap(children: ReactNode, opts: { locale?: Locale; renderers?: Parameters<typeof SmartKitProvider>[0]['renderers'] } = {}) {
  const provider = new MemoryProvider({ model: shopModel, data: shopData });
  return (
    <MantineProvider theme={smartKitMantineTheme}>
      <SmartKitProvider services={{ shop: { model: shopModel, dataProvider: provider, variants: new MemoryVariantStore() } }} locale={opts.locale ?? 'en'} namespace="test" renderers={opts.renderers}>
        {children}
      </SmartKitProvider>
    </MantineProvider>
  );
}
