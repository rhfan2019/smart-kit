/**
 * Card scenarios (docs/20-research-cards.md): every card type of the SAP Fiori guidelines, driven by the purchasing
 * service's annotations (UI.LineItem, UI.PresentationVariant, UI.SelectionVariant, UI.Chart, UI.DataPoint,
 * UI.QuickViewFacets, Communication.Event). Cards are 340 px wide like the SAPUI5 reference (docs/21-evidence).
 * The calendar and timeline are frozen at 2026-11-16 09:00 (Berlin) so that the page always looks the same.
 */
import {
  AnalyticalContent, CalendarContent, Card, Header, ListContent, NumericHeader, ObjectContent, TableContent, TimelineContent,
} from '@rhfan2019/smart-kit/cards';
import { useShell } from '../App';

type Lang = 'zh' | 'en';

const TEXT = {
  zh: {
    title: '卡片', intro: '每种卡片都由采购服务的注解驱动，宽 340 px，与 SAPUI5 1.154 的集成卡片（Horizon 主题）对照。日历和时间线固定在 2026-11-16 09:00（柏林时间），页面每次打开都一样。',
    list: '待审批的大额订单', listSub: '按净值降序', extended: '大额订单（扩展）', bar: '净值对比', suppliers: '供应商',
    table: '待审批订单', tableSub: '新建状态', spend: '采购支出', spendSub: '欧元订单', details: '本年度',
    share: '按订单类型', timeline: '近期供应商会议', calendar: '我的会议', calendarSub: '供应商会议',
    holiday: '公司假日', custom: '自定义卡片', customSub: 'Component 卡片', customText: '卡片内容可以是任何 React 内容（对应 SAPUI5 的 Component 卡片）。',
  },
  en: {
    title: 'Cards', intro: 'Every card is driven by the purchasing service\'s annotations, 340 px wide, compared with the SAPUI5 1.154 integration cards (Horizon theme). The calendar and the timeline are frozen at 2026-11-16 09:00 (Berlin) so that the page always looks the same.',
    list: 'Large Orders to Approve', listSub: 'By net amount, descending', extended: 'Large Orders (Extended)', bar: 'Net Amount Comparison', suppliers: 'Suppliers',
    table: 'Orders to Approve', tableSub: 'Status New', spend: 'Purchasing Spend', spendSub: 'Orders in EUR', details: 'Current year',
    share: 'By Order Type', timeline: 'Upcoming Supplier Meetings', calendar: 'My Meetings', calendarSub: 'Supplier meetings',
    holiday: 'Company holiday', custom: 'Custom Card', customSub: 'Component card', customText: 'The content of a card can be any React content (the SAPUI5 Component card).',
  },
} as const;

/** The demo's frozen "now": Monday 2026-11-16, 09:00 in Berlin (the mock data's meeting day). */
const NOW = new Date('2026-11-16T08:00:00Z');
const MEETING_DAY = '2026-11-16';

export function CardsPage() {
  const { locale } = useShell();
  const tx = TEXT[locale as Lang];
  return (
    <div className="demo__page demo-cards" data-demo-cards>
      <h2>{tx.title}</h2>
      <p className="demo-mc__intro">{tx.intro}</p>
      <div className="demo-cards__grid">
        <Card header={<Header title={tx.list} subtitle={tx.listSub} />}>
          <ListContent entitySet="PurchaseOrders" presentationAnnotationPath="com.sap.vocabularies.UI.v1.PresentationVariant#CardLarge" selectionAnnotationPath="com.sap.vocabularies.UI.v1.SelectionVariant#CardNew" />
        </Card>
        <Card header={<Header title={tx.suppliers} />}>
          <ListContent entitySet="Suppliers" maxItems={3} />
        </Card>
        <Card header={<Header title={tx.table} subtitle={tx.tableSub} />}>
          <TableContent entitySet="PurchaseOrders" annotationPath="com.sap.vocabularies.UI.v1.LineItem#CardTable" presentationAnnotationPath="@UI.PresentationVariant#CardLarge" selectionAnnotationPath="@UI.SelectionVariant#CardNew" />
        </Card>
        <Card header={<Header />}>
          <ObjectContent entitySet="Suppliers" keys={{ Supplier: '0000100001' }} />
        </Card>
        <Card header={<NumericHeader title={tx.spend} subtitle={tx.spendSub} details={tx.details} entitySet="PurchaseOrders" dataPointAnnotationPath="@UI.DataPoint#CardSpend" selectionAnnotationPath="@UI.SelectionVariant#CardEur" />}>
          <AnalyticalContent entitySet="PurchaseOrders" chartAnnotationPath="@UI.Chart#ByStatus" selectionAnnotationPath="@UI.SelectionVariant#CardEur" />
        </Card>
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
        <Card header={<Header title={tx.extended} />}>
          <ListContent entitySet="PurchaseOrders" listType="extended" maxItems={3} presentationAnnotationPath="@UI.PresentationVariant#CardLarge" selectionAnnotationPath="@UI.SelectionVariant#CardNew" />
        </Card>
        <Card header={<Header title={tx.bar} />}>
          <ListContent entitySet="PurchaseOrders" listFlavor="bar" presentationAnnotationPath="@UI.PresentationVariant#CardLarge" selectionAnnotationPath="@UI.SelectionVariant#CardNew" />
        </Card>
        <Card header={<Header title={tx.share} />}>
          <AnalyticalContent entitySet="PurchaseOrders" chartAnnotationPath="@UI.Chart#CardTypeShare" selectionAnnotationPath="@UI.SelectionVariant#CardEur" />
        </Card>
        <Card header={<Header title={tx.custom} subtitle={tx.customSub} />}>
          <p className="demo-cards__custom">{tx.customText}</p>
        </Card>
      </div>
    </div>
  );
}
