/** Texts of the demo shell (not part of the library). */
export const SHELL = {
  zh: {
    app: 'smart-kit 示例', po: '采购订单', products: '产品', orders: '订单', freestyle: '自由拼装', hooks: '只用 hook', about: '关于',
    language: '语言', theme: '主题', density: '密度', yellow: '明黄', navy: '海军蓝', dark: '深色', comfortable: '标准', compact: '紧凑',
    loading: '正在加载元数据…', loadFailed: '元数据加载失败', home: '首页', homeText: '从左侧选择一个页面。',
    aboutText: '这是宿主应用自己的页面，用来验证组件库不影响宿主路由。', back: '返回',
    overdueColumn: '逾期', overdue: '已逾期', copyAction: '复制单号', copied: '已复制：{ids}',
    timeline: '交货时间线', timelineText: '这是插入在“常规信息”之后的自定义区块。', overdueMessage: '该订单有逾期未交货的项目。',
    search: '搜索', go: '执行', detail: '详情', noSelection: '在左侧选择一行查看详情。', rows: '{count} 条',
    customToolbar: '自定义工具栏', refresh: '刷新',
  },
  en: {
    app: 'smart-kit demo', po: 'Purchase Orders', products: 'Products', orders: 'Orders', freestyle: 'Freestyle', hooks: 'Hooks only', about: 'About',
    language: 'Language', theme: 'Theme', density: 'Density', yellow: 'Yellow', navy: 'Navy', dark: 'Dark', comfortable: 'Comfortable', compact: 'Compact',
    loading: 'Loading metadata…', loadFailed: 'Could not load metadata', home: 'Home', homeText: 'Choose a page on the left.',
    aboutText: 'This page belongs to the host application; it shows that the library does not affect host routing.', back: 'Back',
    overdueColumn: 'Overdue', overdue: 'Overdue', copyAction: 'Copy Numbers', copied: 'Copied: {ids}',
    timeline: 'Delivery Timeline', timelineText: 'This custom section is inserted after "General Information".', overdueMessage: 'This order has overdue items.',
    search: 'Search', go: 'Go', detail: 'Details', noSelection: 'Select a row to see its details.', rows: '{count} rows',
    customToolbar: 'Custom Toolbar', refresh: 'Refresh',
  },
} as const;
export type ShellLocale = keyof typeof SHELL;
export type ShellKey = keyof (typeof SHELL)['en'];
export function shellText(locale: ShellLocale, key: ShellKey, params: Record<string, string | number> = {}): string {
  return (SHELL[locale][key] as string).replace(/\{(\w+)\}/g, (_, k: string) => String(params[k] ?? ''));
}
