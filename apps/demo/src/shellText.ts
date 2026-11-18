/** Texts of the demo shell (not part of the library). */
export const SHELL = {
  zh: {
    app: 'smart-kit 示例', po: '采购订单', products: '产品', orders: '订单', freestyle: '自由拼装', hooks: '只用 hook', microcharts: '微型图表', cards: '卡片', controls: '控件', about: '关于',
    language: '语言', theme: '主题', density: '密度', yellow: '明黄', navy: '海军蓝', sky: '天蓝', dark: '深色', comfortable: '标准', compact: '紧凑',
    loading: '正在加载元数据…', loadFailed: '元数据加载失败', home: '首页', homeText: '从左侧选择一个页面。',
    aboutText: '这是宿主应用自己的页面，用来验证组件库不影响宿主路由。', back: '返回',
    overdueColumn: '逾期', overdue: '已逾期', copyAction: '复制单号', copied: '已复制：{ids}',
    timeline: '交货时间线', timelineText: '这是插入在“常规信息”之后的自定义区块。', overdueMessage: '该订单有逾期未交货的项目。',
    search: '搜索', go: '执行', detail: '详情', noSelection: '在左侧选择一行查看详情。', rows: '{count} 条',
    customToolbar: '自定义工具栏', refresh: '刷新',
    poDraft: '采购订单（草稿）', fcl: '并排', decide: '决策', supplierInfo: '供应商信息', supplierInfoText: '供应商 {id} 的联系人和交货条件（上下文信息）。',
    blockOne: '占一列的块', blockTwo: '占两列的块', blockThree: '占三列的块', blockMore: '“显示更多”里的块', allItems: '全部项目', orderItems: '订单 {id} 的项目',
    items: '采购订单项目', statusTag: '状态', fclEmpty: '在左侧选择一行。',
    tree: '成本中心', treeExpandAll: '全部展开', treeCollapseAll: '全部折叠', treeExpanded: '已展开：{name}（第 {index} 行）', treeCollapsed: '已折叠：{name}（第 {index} 行）',
  },
  en: {
    app: 'smart-kit demo', po: 'Purchase Orders', products: 'Products', orders: 'Orders', freestyle: 'Freestyle', hooks: 'Hooks only', microcharts: 'Micro Charts', cards: 'Cards', controls: 'Controls', about: 'About',
    language: 'Language', theme: 'Theme', density: 'Density', yellow: 'Yellow', navy: 'Navy', sky: 'Sky', dark: 'Dark', comfortable: 'Comfortable', compact: 'Compact',
    loading: 'Loading metadata…', loadFailed: 'Could not load metadata', home: 'Home', homeText: 'Choose a page on the left.',
    aboutText: 'This page belongs to the host application; it shows that the library does not affect host routing.', back: 'Back',
    overdueColumn: 'Overdue', overdue: 'Overdue', copyAction: 'Copy Numbers', copied: 'Copied: {ids}',
    timeline: 'Delivery Timeline', timelineText: 'This custom section is inserted after "General Information".', overdueMessage: 'This order has overdue items.',
    search: 'Search', go: 'Go', detail: 'Details', noSelection: 'Select a row to see its details.', rows: '{count} rows',
    customToolbar: 'Custom Toolbar', refresh: 'Refresh',
    poDraft: 'Purchase Orders (Draft)', fcl: 'Side by Side', decide: 'Decide', supplierInfo: 'Supplier Information', supplierInfoText: 'Contacts and delivery terms of supplier {id} (contextual information).',
    blockOne: 'Block spanning one column', blockTwo: 'Block spanning two columns', blockThree: 'Block spanning three columns', blockMore: 'Block behind "Show More"', allItems: 'All Items', orderItems: 'Items of order {id}',
    items: 'Purchase Order Items', statusTag: 'Status', fclEmpty: 'Select a row on the left.',
    tree: 'Cost Centers', treeExpandAll: 'Expand All', treeCollapseAll: 'Collapse All', treeExpanded: 'Expanded: {name} (row {index})', treeCollapsed: 'Collapsed: {name} (row {index})',
  },
} as const;
export type ShellLocale = keyof typeof SHELL;
export type ShellKey = keyof (typeof SHELL)['en'];
export function shellText(locale: ShellLocale, key: ShellKey, params: Record<string, string | number> = {}): string {
  return (SHELL[locale][key] as string).replace(/\{(\w+)\}/g, (_, k: string) => String(params[k] ?? ''));
}
