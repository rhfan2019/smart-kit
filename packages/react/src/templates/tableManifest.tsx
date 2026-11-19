/**
 * The manifest configuration of a table (`controlConfiguration › <…>/@UI.LineItem`: `tableSettings`, `columns`,
 * `actions`, `overflowGroups`; FE TableManifestConfiguration) as settings of the Table building block. Shared by the
 * list report and the object page's sub-tables, which FE builds with the same converter (sap.fe.core.converters.controls
 * .Common.Table getTableManifestConfiguration, getTableAnnotationConfiguration and Action getActionsFromManifest).
 * Template-specific settings (type, row count mode, threshold, creation, header) stay with the template.
 */
import type { ReactNode } from 'react';
import type { $ActionSettings, $ColumnSettings, $OverflowGroupSettings, $TableSettings, ActionGroup, ColumnItem, Context, TableExtendEntry } from '../v4/fe/macros/Table';
import type { $ManifestColumnSettings } from './ListReport';

/** A column of the Table building block, with the settings of an annotation column override (FE CustomDefinedTableColumnForOverride). */
export type ColumnOverride = $ColumnSettings & Partial<Pick<ColumnItem, 'showDataFieldsLabel' | 'mergeCells' | 'mergeComparisonProperties' | 'formatOptions' | 'microChartSize' | 'showMicroChartLabel'>>;

type Priority = 'AlwaysOverflow' | 'Disappear' | 'High' | 'Low' | 'NeverOverflow';
interface PositionLike { anchor?: string; placement?: 'After' | 'Before' | 'End' }

/** A custom table toolbar action of the manifest, as both templates declare it (FE ManifestAction). */
export interface TableActionManifest {
  text?: string;
  press?(e: { selectedContexts: Context[] }): void;
  visible?: boolean;
  enabled?: boolean;
  position?: PositionLike;
  requiresSelection?: boolean;
  enableOnSelect?: 'multi' | 'single';
  menu?: string[];
  priority?: Priority;
  overflowGroup?: number;
  group?: number;
  isAIOperation?: boolean;
  defaultAction?: string;
  template?(): ReactNode;
}

/** The `tableSettings` both templates pass to the building block unchanged (FE TableManifestSettingsConfiguration). */
export interface TableSettingsManifest {
  selectionMode?: $TableSettings['selectionMode'];
  enableExport?: boolean;
  exportFileName?: string;
  exportSheetName?: string;
  exportRequestSize?: number;
  disableCopyToClipboard?: boolean;
  enableFullScreen?: boolean;
  personalization?: boolean | { sort?: boolean; column?: boolean; filter?: boolean; group?: boolean; aggregate?: boolean };
  selectAll?: boolean;
  selectionLimit?: number;
  frozenColumnCount?: number;
  disableColumnFreeze?: boolean;
  widthIncludingColumnHeader?: boolean;
  condensedTableLayout?: boolean;
  popinLayout?: $TableSettings['popinLayout'];
  isSearchable?: boolean;
  readOnly?: boolean;
  ignoredFields?: string;
  enablePaste?: boolean;
  enablePastingOfComputedProperties?: boolean;
  enableMassEdit?: boolean | { visibleFields?: string; ignoredFields?: string; operationGroupingMode?: 'ChangeSet' | 'Isolated'; customFragment?(): ReactNode };
  analyticalConfiguration?: { aggregationOnLeafLevel?: boolean };
}

/** Calls a render function of the settings as a component of its own (its hooks stay inside it). */
export function RenderContent(p: { render(): ReactNode }) {
  return <>{p.render()}</>;
}

/** The personalization string of `Table` ("false" or the panels) for the FE setting. */
export function personalizationOf(v: TableSettingsManifest['personalization']): string | undefined {
  if (v === undefined || v === true) return undefined;
  if (v === false) return 'false';
  const panels = [v.column && 'Column', v.sort && 'Sort', v.filter && 'Filter', v.group && 'Group', v.aggregate && 'Aggregate'].filter(Boolean);
  return panels.length ? panels.join(',') : 'false';
}

/**
 * The `massEdit` of `Table` for `enableMassEdit` (FE getMassEditSettings); `grouping` is the template's default
 * operationGroupingMode (list report "Isolated", object page "ChangeSet").
 */
export function massEditOf(v: NonNullable<TableSettingsManifest['enableMassEdit']>, grouping: 'ChangeSet' | 'Isolated'): NonNullable<$TableSettings['massEdit']> {
  const list = (x: string | undefined) => (x ? x.split(',').map((f) => f.trim()).filter(Boolean) : undefined);
  return v === true || v === false ? { operationGroupingMode: grouping } : { visibleFields: list(v.visibleFields), ignoredFields: list(v.ignoredFields), operationGroupingMode: v.operationGroupingMode ?? grouping, customContent: v.customFragment?.() };
}

/** The `tableSettings` that map one to one to the building block's settings. */
export function tableSettingsOf(ts: TableSettingsManifest, o: { massEditGrouping: 'ChangeSet' | 'Isolated' }): Partial<$TableSettings> {
  return {
    selectionMode: ts.selectionMode,
    enableExport: ts.enableExport,
    exportFileName: ts.exportFileName,
    exportSheetName: ts.exportSheetName,
    exportRequestSize: ts.exportRequestSize,
    disableCopyToClipboard: ts.disableCopyToClipboard,
    enableFullScreen: ts.enableFullScreen,
    personalization: personalizationOf(ts.personalization),
    enableSelectAll: ts.selectAll,
    selectionLimit: ts.selectionLimit,
    frozenColumnCount: ts.frozenColumnCount,
    disableColumnFreeze: ts.disableColumnFreeze,
    widthIncludingColumnHeader: ts.widthIncludingColumnHeader,
    condensedTableLayout: ts.condensedTableLayout,
    popinLayout: ts.popinLayout,
    isSearchable: ts.isSearchable,
    readOnly: ts.readOnly,
    ignoredFields: ts.ignoredFields,
    enablePaste: ts.enablePaste,
    enablePastingOfComputedProperties: ts.enablePastingOfComputedProperties,
    massEdit: ts.enableMassEdit ? massEditOf(ts.enableMassEdit, o.massEditGrouping) : undefined,
    analyticalConfiguration: ts.analyticalConfiguration,
  };
}

/**
 * Custom columns (FE getTableAnnotationConfiguration → insertCustomElements; "End" or no anchor places them last). A
 * column without template is an override of the annotation column of its key (FE isColumnOverride; the Table building
 * block applies it); only overrides carry formatOptions, showDataFieldsLabel and settings.
 */
export function tableColumnsOf(columns: Record<string, $ManifestColumnSettings> | undefined): ColumnOverride[] | undefined {
  return columns
    ? Object.entries(columns).map(([key, c]) => {
      const notice = c.aiNotice ? { contentText: c.aiNotice.contentText, content: c.aiNotice.contentFragmentName ? <RenderContent render={c.aiNotice.contentFragmentName} /> : undefined } : undefined;
      const merge = c.settings?.mergeComparisonProperties;
      return {
        key, header: c.header, template: c.template, properties: c.properties, width: c.width, importance: c.importance, horizontalAlign: c.horizontalAlign,
        disableExport: c.disableExport, availability: c.availability, tooltip: c.tooltip, required: c.required, widthIncludingColumnHeader: c.widthIncludingColumnHeader,
        exportSettings: c.exportSettings, aiNotice: notice,
        ...(c.template ? {} : {
          formatOptions: c.formatOptions === undefined ? undefined : { textLinesEdit: 4, ...c.formatOptions }, showDataFieldsLabel: c.showDataFieldsLabel,
          mergeCells: c.settings?.mergeCells, mergeComparisonProperties: merge === undefined ? undefined : Array.isArray(merge) ? merge : [merge],
          microChartSize: c.settings?.microChartSize, showMicroChartLabel: c.settings?.showMicroChartLabel,
        }),
        ...(c.position?.placement === 'End' ? {} : { anchor: c.position?.anchor, placement: c.position?.placement }),
      };
    })
    : undefined;
}

/**
 * Custom toolbar actions (FE getActionsFromManifest): buttons with their overflow priority and group (`overflowGroup`,
 * else `group`); a `menu` is a menu button of other actions whose `defaultAction` makes it a split button; an action
 * with `template` is custom content of the toolbar (FE isCustomToolbarContent).
 */
export function tableActionsOf(all: Record<string, TableActionManifest> | undefined): { actions?: $ActionSettings[]; groups?: ActionGroup[]; extend?: TableExtendEntry[] } {
  const entries = Object.entries(all ?? {});
  const content: TableExtendEntry[] = entries.filter(([, a]) => a.template && !a.menu && a.visible !== false).map(([key, a]) => ({
    kind: 'action', id: key, position: a.position?.placement === 'Before' || !a.position?.anchor ? 'before' : 'after', anchor: a.position?.anchor ?? 'Create',
    item: { id: key, label: a.text ?? key, content: <RenderContent render={a.template!} />, priority: a.priority, overflowGroup: a.overflowGroup ?? a.group, onPress: () => undefined },
  }));
  const actions: $ActionSettings[] = entries.filter(([, a]) => !a.menu && !a.template).map(([key, a]) => ({
    key, text: a.text ?? key, anchor: a.position?.anchor, placement: a.position?.placement === 'End' ? undefined : a.position?.placement,
    enabled: a.enabled, visible: a.visible, requiresSelection: a.requiresSelection, enableOnSelect: a.enableOnSelect,
    priority: a.priority, overflowGroup: a.overflowGroup ?? a.group, isAIOperation: a.isAIOperation,
    onPress: a.press ? (e) => a.press!({ selectedContexts: e.selectedContexts }) : undefined,
  }));
  const groups: ActionGroup[] = entries.filter(([, a]) => a.menu).map(([key, a]) => ({ id: key, label: a.text ?? key, actions: a.menu!, defaultAction: a.defaultAction }));
  return { actions: actions.length ? actions : undefined, groups: groups.length ? groups : undefined, extend: content.length ? content : undefined };
}

/** `overflowGroups` (FE addSeparators): a separator before the first action of each group with `showSeparator`. */
export function overflowGroupsOf(groups: Record<string, { showSeparator?: boolean }> | undefined): $OverflowGroupSettings[] | undefined {
  return groups ? Object.entries(groups).map(([k, g]) => ({ overflowGroup: Number(k), showSeparator: g.showSeparator })) : undefined;
}
