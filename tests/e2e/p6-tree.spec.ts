/** Tree table on the test service (docs/26 §3.10, docs/27 UE-89): /tree shows the cost center hierarchy with TopLevels. */
import { expect, test, type Page } from '@playwright/test';
import { filterInput, open, recordOData, resetServer, table } from './helpers';

test.beforeEach(async ({ page }) => resetServer(page));

const CC = 'CostCenters';
/** Visible tree rows as "<level> <name> <drill state>". */
const rows = (page: Page) => table(page, CC).locator('[data-sk-tree-level]').evaluateAll((els) => els.map((el) => {
  const e = el as HTMLElement;
  return `${e.dataset.skTreeLevel} ${e.querySelector('.sk-tree__content')?.textContent?.trim() ?? ''} ${e.dataset.skDrillState}`;
}));
const toggle = (page: Page, name: string) => table(page, CC).locator('.sk-tree', { hasText: name }).first().locator('[data-sk-tree-toggle]');
const topLevels = (urls: string[]) => urls.filter((u) => u.includes('/CostCenters?') && u.includes('com.sap.vocabularies.Hierarchy.v1.TopLevels('));

for (const kernel of ['grid', 'responsive'] as const) {
  test(`UE-89 ${kernel}: roots first, expand and collapse a node with TopLevels ExpandLevels, filters keep the ancestors`, async ({ page }) => {
    const rec = recordOData(page);
    await open(page, kernel === 'grid' ? '/tree' : '/tree?table=responsive');
    await expect.poll(() => rows(page)).toEqual(['0 Hamburg Head Office collapsed', '0 Chicago Head Office collapsed', '0 Shanghai Head Office collapsed', '0 Osaka Head Office collapsed']);
    expect(topLevels(rec.urls)[0]).toContain("TopLevels(HierarchyNodes=$root/CostCenters,HierarchyQualifier='CostCenterHierarchy',NodeProperty='CostCenter',Levels=1)");
    expect(topLevels(rec.urls)[0]).toMatch(/\$select=[^&]*DrillState,DistanceFromRoot,LimitedDescendantCount/);

    await toggle(page, 'Hamburg Head Office').click();
    await expect.poll(() => rows(page)).toEqual([
      '0 Hamburg Head Office expanded', '1 Purchasing collapsed', '1 Production collapsed', '1 Logistics leaf',
      '0 Chicago Head Office collapsed', '0 Shanghai Head Office collapsed', '0 Osaka Head Office collapsed',
    ]);
    expect(topLevels(rec.urls).at(-1)).toContain('ExpandLevels=[{"NodeID":"1000","Levels":1}]');
    await expect(page.locator('[data-demo-toggle-event]')).toHaveText('Expanded: Hamburg Head Office (row 0)');
    // the budget column is formatted with the currency of the row
    await expect(table(page, CC).getByText('5,000,000.00').first()).toBeVisible();

    await toggle(page, 'Purchasing').click();
    await expect.poll(async () => (await rows(page)).slice(1, 4)).toEqual(['1 Purchasing expanded', '2 Strategic Purchasing leaf', '2 Operational Purchasing leaf']);
    await toggle(page, 'Hamburg Head Office').click();
    await expect.poll(async () => (await rows(page)).length).toBe(4);

    // ref methods behind the demo buttons: expandToLevel(3), collapseAll()
    await page.locator('[data-demo-expand-all]').click();
    await expect.poll(async () => (await rows(page)).filter((r) => r.startsWith('2 ')).length).toBeGreaterThan(0);
    expect(topLevels(rec.urls).at(-1)).toContain('Levels=3)');
    await page.locator('[data-demo-collapse-all]').click();
    await expect.poll(async () => (await rows(page)).length).toBe(4);

    const company = filterInput(page, 'CompanyCode');
    await company.fill('2000');
    await company.press('Enter');
    await expect.poll(() => rows(page)).toEqual(['0 Chicago Head Office collapsed']);
    expect(topLevels(rec.urls).at(-1)).toContain("$apply=ancestors($root/CostCenters,CostCenterHierarchy,CostCenter,filter(CompanyCode eq '2000'),keep start)/");
  });
}

test('UE-89 Chinese texts: names from the service, toggle label from smart-kit', async ({ page }) => {
  await open(page, '/tree', { lang: 'zh' });
  await expect(toggle(page, '汉堡总部')).toHaveAttribute('aria-label', '展开节点');
});
