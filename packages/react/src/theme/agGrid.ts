/** AG Grid theme bridged to smart-kit tokens; switching data-theme / data-density needs no rebuild. */
import { themeQuartz } from 'ag-grid-community';

export const smartKitGridTheme = themeQuartz.withParams({
  accentColor: 'var(--sk-color-primary)',
  backgroundColor: 'var(--sk-color-surface)',
  foregroundColor: 'var(--sk-color-text)',
  borderColor: 'var(--sk-color-border)',
  headerBackgroundColor: 'var(--sk-table-header-bg)',
  headerTextColor: 'var(--sk-color-text-muted)',
  rowHoverColor: 'var(--sk-table-row-hover-bg)',
  selectedRowBackgroundColor: 'var(--sk-table-row-selected-bg)',
  oddRowBackgroundColor: 'var(--sk-color-surface)',
  fontFamily: 'var(--sk-font-sans)',
  fontSize: 'var(--sk-text-small)',
  headerFontSize: 'var(--sk-text-small)',
  rowHeight: 'var(--sk-row-height)',
  headerHeight: 'var(--sk-header-row-height)',
  wrapperBorderRadius: 'var(--sk-radius-panel)',
  borderRadius: 'var(--sk-radius-control)',
  checkboxCheckedBackgroundColor: 'var(--sk-color-primary)',
  checkboxCheckedBorderColor: 'var(--sk-color-primary)',
  checkboxCheckedShapeColor: 'var(--sk-color-text-on-primary)',
  rangeSelectionBorderColor: 'var(--sk-color-focus)',
  focusShadow: { radius: 2, spread: 0, color: 'var(--sk-color-focus)' },
  inputFocusBorder: { color: 'var(--sk-color-focus)' },
  spacing: 'var(--sk-space-2)',
});
