/** Stage 1.5: the edit seam works end to end — enter edit, PATCH, ETag conflict (v5 §6.4). */
import { expect, test } from '@playwright/test';
import { ConcurrencyError, loadService, type FetchLike } from '../../packages/core/src';
import { DirectEditStrategy } from '../../spikes/edit-seam/directEditStrategy';
import { PURCHASING, resetServer } from './helpers';

test('edit seam: direct save with PATCH and ETag conflict', async ({ page }) => {
  await resetServer(page);
  const fetchLike: FetchLike = (url, init) => fetch(url, init);
  const { provider } = await loadService({ serviceUrl: `${PURCHASING}/`, fetch: fetchLike, language: 'en' });
  const path = "PurchaseOrders('4500000002')";
  const row = await provider.read(path, { select: ['PurchaseOrder', 'Description', 'Version'], expand: [] });
  const strategy = new DirectEditStrategy(provider);

  const a = await strategy.begin(path, row);
  const b = await strategy.begin(path, row); // a second editor with the same ETag
  a.set('Description', 'Changed by A');
  const saved = await a.save();
  expect(saved.etag).toBeTruthy();
  expect(saved.etag).not.toBe(row['@odata.etag']);
  const reread = await provider.read(path, { select: ['Description'], expand: [] });
  expect(reread.Description).toBe('Changed by A');

  b.set('Description', 'Changed by B');
  await expect(b.save()).rejects.toBeInstanceOf(ConcurrencyError);
  // A can keep saving with the new ETag
  a.set('Description', 'Changed again by A');
  await expect(a.save()).resolves.toBeTruthy();
});
