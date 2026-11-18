/**
 * Card scenarios (docs/20-research-cards.md): every card type of the SAP Fiori guidelines, driven by the purchasing
 * service's annotations (UI.LineItem, UI.PresentationVariant, UI.SelectionVariant, UI.Chart, UI.DataPoint,
 * UI.QuickViewFacets, Communication.Event). Cards are 340 px wide like the SAPUI5 reference (docs/21-evidence).
 * The calendar and timeline are frozen at 2026-11-16 09:00 (Berlin) so that the page always looks the same.
 */
import AnalyticalContent from '@rhfan2019/smart-kit/ui/integration/cards/AnalyticalContent';
import CalendarContent from '@rhfan2019/smart-kit/ui/integration/cards/CalendarContent';
import Card from '@rhfan2019/smart-kit/f/Card';
import Header from '@rhfan2019/smart-kit/f/cards/Header';
import ListContent from '@rhfan2019/smart-kit/ui/integration/cards/ListContent';
import NumericHeader from '@rhfan2019/smart-kit/f/cards/NumericHeader';
import ObjectContent from '@rhfan2019/smart-kit/ui/integration/cards/ObjectContent';
import TableContent from '@rhfan2019/smart-kit/ui/integration/cards/TableContent';
import TimelineContent from '@rhfan2019/smart-kit/ui/integration/cards/TimelineContent';
import { SmartKitProvider, useSmartKit } from '@rhfan2019/smart-kit/context';
import type { ReactNode } from 'react';
import { useShell } from '../App';

type Lang = 'zh' | 'en';

const TEXT = {
  zh: {
    title: '卡片', intro: '每种卡片都由采购服务的注解驱动，宽 340 px，与 SAPUI5 1.154 的集成卡片（Horizon 主题）对照。日历和时间线固定在 2026-11-16 09:00（柏林时间），页面每次打开都一样。',
    list: '在途大额订单', listSub: '按净值降序', approve: '待审批的大额订单', extended: '大额订单（扩展）', bar: '净值对比', suppliers: '供应商',
    table: '待审批订单', tableSub: '新建状态', spend: '采购支出', spendSub: '欧元订单', details: '本年度',
    share: '按订单类型', budget: '开票与预算', budgetSub: '已开票金额 / 订单净值', delivery: '在途订单', deliverySub: 'Wesarmark Supply Ltd', timeline: '近期供应商会议', calendar: '我的会议', calendarSub: '供应商会议',
    holiday: '公司假日', custom: '自定义卡片', customSub: 'Component 卡片', customText: '卡片内容可以是任何 React 内容（对应 SAPUI5 的 Component 卡片）。',
  },
  en: {
    title: 'Cards', intro: 'Every card is driven by the purchasing service\'s annotations, 340 px wide, compared with the SAPUI5 1.154 integration cards (Horizon theme). The calendar and the timeline are frozen at 2026-11-16 09:00 (Berlin) so that the page always looks the same.',
    list: 'Large Orders in Delivery', listSub: 'By net amount, descending', approve: 'Large Orders to Approve', extended: 'Large Orders (Extended)', bar: 'Net Amount Comparison', suppliers: 'Suppliers',
    table: 'Orders to Approve', tableSub: 'Status New', spend: 'Purchasing Spend', spendSub: 'Orders in EUR', details: 'Current year',
    share: 'By Order Type', budget: 'Invoicing vs. Budget', budgetSub: 'Invoiced amount / net amount', delivery: 'Orders in Delivery', deliverySub: 'Wesarmark Supply Ltd', timeline: 'Upcoming Supplier Meetings', calendar: 'My Meetings', calendarSub: 'Supplier meetings',
    holiday: 'Company holiday', custom: 'Custom Card', customSub: 'Component card', customText: 'The content of a card can be any React content (the SAPUI5 Component card).',
  },
} as const;

/** The demo's frozen "now": Monday 2026-11-16, 09:00 in Berlin (the mock data's meeting day). */
const NOW = new Date('2026-11-16T08:00:00Z');
const MEETING_DAY = '2026-11-16';

/** The demo's cards run in Berlin time (the frozen "now" above), whatever the browser's time zone is. */
function BerlinTime({ children }: { children: ReactNode }) {
  const kit = useSmartKit();
  return (
    <SmartKitProvider services={kit.services} defaultService={kit.defaultService} locale={kit.locale} namespace={kit.namespace} navigation={kit.navigation} pageState={kit.pageState} renderers={kit.renderers} timeZone="Europe/Berlin">
      {children}
    </SmartKitProvider>
  );
}

/** A small outline icon for card headers (the SAPUI5 samples show icons there). */
function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}
const ORDER_ICON = 'M6 3h9l3 3v15H6z M14 3v4h4 M9 11h6 M9 15h6';
const TRUCK_ICON = 'M2 6h11v9H2z M13 9h4l3 3v3h-7 M6 18.5a1.5 1.5 0 1 0 0-.01 M17 18.5a1.5 1.5 0 1 0 0-.01';

export function CardsPage() {
  const { locale } = useShell();
  const tx = TEXT[locale as Lang];
  return (
    <div className="demo__page demo-cards" data-demo-cards>
      <h2>{tx.title}</h2>
      <p className="demo-mc__intro">{tx.intro}</p>
      <BerlinTime>
        <div className="demo-cards__grid">
          <Card header={<Header title={tx.list} subtitle={tx.listSub} icon={<Icon d={ORDER_ICON} />} />}>
            <ListContent entitySet="PurchaseOrders" highlight showStateIcon maxItems={4} presentationAnnotationPath="com.sap.vocabularies.UI.v1.PresentationVariant#CardLarge" selectionAnnotationPath="com.sap.vocabularies.UI.v1.SelectionVariant#CardInDelivery" />
          </Card>
          <Card header={<NumericHeader title={tx.spend} subtitle={tx.spendSub} details={tx.details} entitySet="PurchaseOrders" dataPointAnnotationPath="@UI.DataPoint#CardSpend" selectionAnnotationPath="@UI.SelectionVariant#CardEur" />}>
            <AnalyticalContent entitySet="PurchaseOrders" chartAnnotationPath="@UI.Chart#ByStatus" selectionAnnotationPath="@UI.SelectionVariant#CardEur" />
          </Card>
          <Card header={<Header title={tx.budget} subtitle={tx.budgetSub} />}>
            <ListContent entitySet="PurchaseOrders" listFlavor="bar" maxItems={4} annotationPath="@UI.LineItem#CardBudget" presentationAnnotationPath="@UI.PresentationVariant#CardLarge" selectionAnnotationPath="@UI.SelectionVariant#CardEur" />
          </Card>
          <Card header={<Header />}>
            <ObjectContent entitySet="Suppliers" keys={{ Supplier: '0000100001' }} />
          </Card>
          <div className="demo-cards__wide">
            <Card header={<Header title={tx.delivery} subtitle={tx.deliverySub} icon={<Icon d={TRUCK_ICON} />} />}>
              <TableContent entitySet="PurchaseOrders" maxColumns={4} presentationAnnotationPath="@UI.PresentationVariant#CardTable" selectionAnnotationPath="@UI.SelectionVariant#CardInDelivery" filters={{ Supplier: [{ operator: 'EQ', values: ['0000100092'] }] }} />
            </Card>
          </div>
          <Card header={<Header title={tx.timeline} />}>
            <TimelineContent entitySet="SupplierMeetings" maxItems={3} now={NOW} filters={{ StartAt: [{ operator: 'GE', values: [MEETING_DAY] }] }} />
          </Card>
          <div className="demo-cards__wide">
            <Card width="640px" header={<Header title={tx.calendar} subtitle={tx.calendarSub} />}>
              <CalendarContent
                entitySet="SupplierMeetings"
                date={MEETING_DAY}
                now={NOW}
                maxItems={3}
                maxLegendItems={3}
                specialDates={[{ startDate: '2026-11-20', type: 'holiday' }]}
                legendItems={[{ category: 'calendar', type: 'holiday', text: tx.holiday }]}
              />
            </Card>
          </div>
          <Card header={<Header title={tx.share} />}>
            <AnalyticalContent entitySet="PurchaseOrders" chartAnnotationPath="@UI.Chart#CardTypeShare" selectionAnnotationPath="@UI.SelectionVariant#CardEur" />
          </Card>
          <Card header={<Header title={tx.table} subtitle={tx.tableSub} />}>
            <TableContent entitySet="PurchaseOrders" annotationPath="@UI.LineItem#CardTable" presentationAnnotationPath="@UI.PresentationVariant#CardLarge" selectionAnnotationPath="@UI.SelectionVariant#CardNew" />
          </Card>
          <Card header={<Header title={tx.approve} subtitle={tx.listSub} />}>
            <ListContent entitySet="PurchaseOrders" maxItems={3} presentationAnnotationPath="@UI.PresentationVariant#CardLarge" selectionAnnotationPath="@UI.SelectionVariant#CardNew" />
          </Card>
          <Card header={<Header title={tx.extended} />}>
            <ListContent entitySet="PurchaseOrders" listType="extended" maxItems={3} presentationAnnotationPath="@UI.PresentationVariant#CardLarge" selectionAnnotationPath="@UI.SelectionVariant#CardNew" />
          </Card>
          <Card header={<Header title={tx.suppliers} />}>
            <ListContent entitySet="Suppliers" maxItems={3} />
          </Card>
          <Card header={<Header title={tx.custom} subtitle={tx.customSub} />}>
            <p className="demo-cards__custom">{tx.customText}</p>
          </Card>
        </div>
      </BerlinTime>
    </div>
  );
}
