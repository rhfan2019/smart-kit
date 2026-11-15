/** Story providers: Mantine, smart-kit with an in-memory service built from the shop fixture. */
import { MantineProvider } from '@mantine/core';
import { buildModel, MemoryProvider, MemoryVariantStore, type NavigationAdapter, type Row } from '@rhfan2019/smart-kit-core';
import { smartKitCssVariablesResolver, smartKitMantineTheme, SmartKitProvider } from '@rhfan2019/smart-kit';
import { useMemo, type ReactNode } from 'react';
import shopXml from '../../../packages/core/test/fixtures/shop.xml?raw';

export const model = buildModel(shopXml);

const categories = [{ ID: 'C1', Name: 'Office' }, { ID: 'C2', Name: 'School' }, { ID: 'C3', Name: 'Home' }];
export const data: Record<string, Row[]> = {
  Products: Array.from({ length: 240 }, (_, i) => ({
    ID: i + 1, Code: `P${String(i + 1).padStart(4, '0')}`, Name: `${['Pen', 'Paper', 'Folder', 'Stapler', 'Ruler'][i % 5]} ${i + 1}`,
    Price: (5 + ((i * 37) % 300) / 7).toFixed(2), Currency: i % 4 ? 'EUR' : 'USD', CategoryID: categories[i % 3]!.ID, _Category: categories[i % 3],
    Status: ['A', 'B', 'X'][i % 3], StatusCriticality: [3, 2, 1][i % 3], Rating: ((i % 10) / 2).toFixed(1), Stock: String(1000 + i * 13),
    ReleaseDate: `2026-${String((i % 12) + 1).padStart(2, '0')}-${String((i % 27) + 1).padStart(2, '0')}`, ChangedAt: '2026-11-14T08:30:00Z',
    Notes: 'Long text\nwith two lines', Version: 1,
  })),
  Categories: categories,
  Reviews: Array.from({ length: 30 }, (_, i) => ({ ProductID: 1, ReviewNo: i + 1, Stars: (i % 5) + 1, Text: `Review ${i + 1}` })),
  Plains: [],
};

const navigation: NavigationAdapter = { toObject: (p) => console.info('toObject', p), toList: (s) => console.info('toList', s), hasObjectPage: () => true };

export function Providers({ locale, children }: { locale: 'en' | 'zh'; children: ReactNode }) {
  const services = useMemo(() => ({ shop: { model, dataProvider: new MemoryProvider({ model, data, latency: 150 }), variants: new MemoryVariantStore() } }), []);
  return (
    <MantineProvider theme={smartKitMantineTheme} cssVariablesResolver={smartKitCssVariablesResolver} forceColorScheme="light">
      <SmartKitProvider services={services} locale={locale} namespace="storybook" navigation={navigation}>
        {children}
      </SmartKitProvider>
    </MantineProvider>
  );
}
