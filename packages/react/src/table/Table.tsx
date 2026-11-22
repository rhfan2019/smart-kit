/**
 * sap.fe.macros.Table and sap.fe.macros.TreeTable (ADR-033, docs/26b): columns from UI.LineItem, server-side sorting
 * and paging, selection, row navigation, personalization, export and "no data" texts (LR-18–LR-35); actions from
 * UI.DataFieldForAction (toolbar, menu buttons, line item actions, partial processing), create and delete, copy,
 * working modes, draft markers (ADR-024).
 * Kernels (ADR-002, ADR-020):
 * - "grid": AG Grid, own scrollbar, infinite row model with server blocks (`type` GridTable / AnalyticalTable with
 *   `rowCountMode` "Auto", the default of list tables)
 * - "auto": AG Grid with auto height, "More" button or scroll to load (`rowCountMode` "Fixed" / "Interactive", the
 *   default of sub-tables)
 * - "responsive": sap.m.Table scrolling with the page, scroll to load, pop-in by importance (`type` ResponsiveTable)
 * `TreeTable` shows the recursive hierarchy (Aggregation.RecursiveHierarchy, docs/26 §3.10, tree.tsx) in the grid
 * kernel (the grid uses client-side rows like grouping, docs/23 §9).
 */
import { ActionIcon, Alert, Anchor, Button, Group, Menu, Modal, Popover, Stack, Text, TextInput, Tooltip } from '@mantine/core';
import {
  canGroup, canSubtotal, canTotal, capabilitiesFor, hierarchyOf, isAbortError, isSortable, keyPredicate, matches, messagesFromError, parseAnnotationPath, resolvePath, RolledBackError, sourceInfo, STANDARD_VARIANT_ID, withHiddenFilters, writeAll,
  type ActionModel, type EntityTypeModel, type FieldModel, type FilterState, type MetaModel, type Message, type MessageType, type PresentationModel, type QueryRequest, type QuerySource, type Row, type SortItem, type TotalsEntry, type VariantContent,
} from '@rhfan2019/smart-kit-core';
import { useQueryClient } from '@tanstack/react-query';
import {
  AllCommunityModule, ModuleRegistry, type CellKeyDownEvent, type ColDef, type GridApi, type GridReadyEvent, type IDatasource, type SortChangedEvent,
} from 'ag-grid-community';
import { AgGridReact } from 'ag-grid-react';
import { ChevronDown, ChevronRight, Copy, Download, ListCollapse, ListTree, Maximize2, Minimize2, MoreHorizontal, Search, Settings2, Sparkles, X } from 'lucide-react';
import { lazy, Suspense, useCallback, useContext, useEffect, useImperativeHandle, useMemo, useRef, useState, type ReactNode, type Ref } from 'react';
import { actionPaths, isActionAvailable, useActionRunner, type ActionResult } from '../actions/useActionRunner';
import { useService, useSmartKit, useText } from '../context/SmartKitProvider';
import type { TitleLevel } from '../controls/types';
import { typedText } from '../i18n/text';
import { CreateDialog, createFields, createWith, useEditStrategy } from '../edit/editing';
import { createPopupFields, NewObjectDialog } from '../edit/NewObjectDialog';
import { Field, type FieldFormatOptions } from '../field/Field';
import { fieldValue, getPath } from '../field/values';
import { useMessages } from '../messages/MessageContext';
import { DraftIndicator } from '../object/DraftIndicator';
import { IllustratedMessage, type IllustratedMessageSize } from '../controls/display/IllustratedMessage';
import { smartKitGridTheme } from '../theme/agGrid';
import { applyExtensions, type ExtendEntry } from '../util/extend';
import { usePageState, useStoredState } from '../util/usePageState';
import { useDynamicPage } from '../page/DynamicPage';
import { exportRows } from './exportRows';
import { TableP13nDialog } from './TableP13nDialog';
import { useListQuery } from './useListQuery';
import { InlineCreateRow } from './InlineCreateRow';
import { TableCtx, useTableContext, type TableContextValue } from './tableContext';
export { useTableContext, type TableContextValue };
import { groupValueOf, Table as MTable, type $ColumnSettings as MColumn, type PopinLayout, type Priority } from './ResponsiveTable';
import { MultiUnitTotal, TotalLines, useGrandTotals, useSubtotals, useTotalFormatter } from './useTotals';
import { useAnalyticalRequests } from './useAnalytical';
import { GROUP_ROW, groupOf, useAnalyticalGroups, type GroupRowData } from './useAnalyticalGroups';
import { TreeCell, useTree, useTreeState, type TreeMethods, type TreeTable$ToggleOpenStateEvent } from './tree';
import { specialCell, type CellEnv } from './cells';
import { parseClipboard, pastedRows, pasteTargets } from './paste';
// the mass edit dialog (with the field editors) loads when it is opened
const MassEditDialog = /*#__PURE__*/ lazy(() => import('./MassEditDialog'));
import { conditionsAsFilters, QuickVariantSwitch, quickVariantsOf, stateOfPresentationVariant, tablePresentationVariant, useQuickCounts } from './tableState';
import { fromSelectionVariant, toSelectionVariant } from '../filter/selectionVariant';
import { VariantManagement } from '../variants/VariantManagement';
import { useVariants } from '../variants/useVariants';
import type { PresentationVariant } from '../list/presentationVariant';
import type { SelectionVariant } from '../filter/selectionVariant';

let gridModulesRegistered = false;

/** Registers AG Grid's modules the first time a grid table renders, not when this module loads (ADR-026 P2, P3). */
function ensureGridModules(): void {
  if (gridModulesRegistered) return;
  ModuleRegistry.registerModules([AllCommunityModule]);
  gridModulesRegistered = true;
}

/** A column of the table (annotation or custom); the internal form of `columns` and `extend`. */
export interface ColumnItem {
  id: string;
  label: string;
  /** Model field; omitted for custom columns. */
  field?: FieldModel;
  /** Custom cell content. */
  render?(row: Row): ReactNode;
  width?: number;
  /** Extra paths to select for custom columns. */
  select?: string[];
  /** Importance in responsive tables (pop-in on narrow screens); default the field's `UI.Importance`, else Medium. */
  importance?: 'High' | 'Medium' | 'Low';
  /** Horizontal alignment of the cells; default right for numbers. */
  align?: 'Begin' | 'Center' | 'End';
  /** Not exported to the spreadsheet. */
  disableExport?: boolean;
  /** The header text is hidden (FE headerVisible false: inline action columns). */
  headerHidden?: boolean;
  /** Offered in the personalization only (FE availability "Adaptation": entity properties outside the LineItem). */
  adaptation?: boolean;
  /** Header tooltip. */
  tooltip?: string;
  /** Header with the mandatory marker. */
  required?: boolean;
  /** The automatic width includes the header (column `widthIncludingColumnHeader`). */
  widthIncludingColumnHeader?: boolean;
  /** Field group columns: each field with its label before the value (FE column `showDataFieldsLabel`). */
  showDataFieldsLabel?: boolean;
  /**
   * Responsive tables: a cell whose value equals the one of the row above is left empty (FE column
   * `settings.mergeCells` → sap.m.Column mergeDuplicates with the merge key of MdcTableTemplate).
   */
  mergeCells?: boolean;
  /** The properties compared for `mergeCells` (FE `settings.mergeComparisonProperties`); default the column's value. */
  mergeComparisonProperties?: string[];
  /** An AI notice in the column header (sap.fe.macros.table.ColumnAINotice, FE getColumnHeaderAiNotice). */
  aiNotice?: $ColumnAINoticeSettings;
  /** Export settings of the column (sap.fe.macros.table.ColumnExportSettings). */
  exportSettings?: $ColumnExportSettings;
  /** Format options of the cells' fields (FE column `formatOptions` of annotation columns, sap.fe.macros.field.FieldFormatOptions). */
  formatOptions?: FieldFormatOptions;
  /** Responsive tables: micro chart columns show the chart in this size (FE `settings.microChartSize`). @defaultValue "XS" */
  microChartSize?: string;
  /** Responsive tables: micro chart columns also show the labels (FE `settings.showMicroChartLabel`). @defaultValue false */
  showMicroChartLabel?: boolean;
}

/** The AI notice of a column header (sap.fe.macros.table.ColumnAINotice): an AI button opening a popover. */
export interface $ColumnAINoticeSettings {
  /** Text of the popover (FE manifest `aiNotice.contentText`); default "This content was partially or fully generated by AI …". */
  contentText?: string;
  /** Content of the popover (sap.fe.macros.table.ColumnAINotice aggregation `content`; FE manifest: `contentFragmentName`). */
  content?: ReactNode;
}

/** Export settings of a column (sap.fe.macros.table.ColumnExportSettings, sap.ui.export column settings). */
export interface $ColumnExportSettings {
  /** Header text of the column in the file (default the column header). */
  label?: string;
  /** The properties exported (default the column's value; custom columns: their `properties`). */
  property?: string[];
  /** Template with indexed placeholders of `property`, e.g. "{0} ({1})"; default the values separated by spaces. */
  template?: string;
  /** "Number", "BigNumber", "Currency", "Percentage": the raw number is written as a number; "Boolean": `trueValue` / `falseValue`; "Enumeration": `valueMap`; others: the displayed text. */
  type?: string;
  /** Width of the column in characters. */
  width?: number;
  /** Wraps the cell content (default: when several properties are exported). */
  wrap?: boolean;
  /** "Left", "Right", "Center", "Begin" or "End". */
  textAlign?: string;
  /** "Boolean": text for true. */
  trueValue?: string;
  /** "Boolean": text for false. */
  falseValue?: string;
  /** "Enumeration": text by value. */
  valueMap?: Record<string, string>;
  /** Pattern of textual dates ("Date" type); accepted, the displayed date is exported. */
  inputFormat?: string;
}

/** A toolbar action (annotation or custom); the internal form of `actions` and `extend`. */
export interface ActionItem {
  id: string;
  label: string;
  onPress(ctx: TableContextValue): void;
  /** Disabled while no row is selected (LR-18). */
  requiresSelection?: boolean;
  /** Further enablement check on the selected rows. */
  enabled?(selected: Row[]): boolean;
  /** Menu button the action belongs to (similar actions grouped, LR Table Toolbar). */
  group?: string;
  /** Overflow group: the actions of a group move into "More" together (sap.fe.macros.table.Action `overflowGroup`). */
  overflowGroup?: number;
  /** Overflow priority (sap.m.OverflowToolbarPriority). */
  priority?: $ActionSettings['priority'];
  /** A separator before the action (the first of an overflow group with `showSeparator`, FE Action addSeparators). */
  separator?: boolean;
  /** An AI operation (BaseAction isAIOperation): the button shows the AI icon. */
  ai?: boolean;
  /** A menu button with these items (UI.DataFieldForActionGroup, `actionGroups`); always enabled as in FE. */
  menu?: ActionItem[];
  /** The menu button is a split button whose main part runs `onPress` (FE ActionGroup `defaultAction`). */
  split?: boolean;
  /**
   * Custom toolbar content placed instead of a button (FE ActionsTemplating getCustomToolbarContent: the manifest
   * action's `template`); `label` names it in the overflow.
   */
  content?: ReactNode;
  /** Kept for positioning only (FE templates the standard action but it is not shown). */
  hidden?: boolean;
}

/** Menu button grouping annotation and custom actions by id (smart-kit addition). */
export interface ActionGroup {
  id: string;
  label: string;
  /** Action ids (`DataFieldForAction::Namespace.action` or custom ids) shown in the menu. */
  actions: string[];
  /** Id of the action run by the menu button itself: the menu becomes a split button (FE ActionGroup `defaultAction`). */
  defaultAction?: string;
}

export type TableExtendEntry =
  | (ExtendEntry<ColumnItem> & { kind?: 'column' })
  | (ExtendEntry<ActionItem> & { kind: 'action' });

/** A row of the table, as sap.ui.model.odata.v4.Context: its entity path and its data. */
export interface Context {
  /** Entity path, e.g. "/Orders('1')". */
  getPath(): string;
  /** The row data. */
  getObject(): Row;
}

/** A custom column (sap.fe.macros.table.Column) of the `columns` aggregation. */
export interface $ColumnSettings {
  /** Unique key; annotation columns have keys like "DataField::GrossAmount". */
  key: string;
  /** Column header. */
  header?: string;
  /** Key of the column the new one is placed next to; default: after the last column. */
  anchor?: string;
  /** @defaultValue "After" */
  placement?: 'After' | 'Before';
  /** Column width (CSS length). */
  width?: string;
  /** Importance for the pop-in of responsive tables. */
  importance?: 'High' | 'Medium' | 'Low' | 'None';
  /** Horizontal alignment of the cells. */
  horizontalAlign?: 'Begin' | 'Center' | 'End';
  /** Properties the column shows: they are selected from the service (and exported). */
  properties?: string[];
  /** The column is not exported. */
  disableExport?: boolean;
  /** "Default": shown; "Adaptation": only offered in the personalization; "Hidden": left out. @defaultValue "Default" */
  availability?: 'Adaptation' | 'Default' | 'Hidden';
  /** Tooltip of the column header. */
  tooltip?: string;
  /** The column header shows the mandatory marker. */
  required?: boolean;
  /** The automatic width is at least as wide as the column header. */
  widthIncludingColumnHeader?: boolean;
  /** Cell content (the template control of the column in FE). */
  template?(row: Row): ReactNode;
  /** Export settings (sap.fe.macros.table.ColumnExportSettings). */
  exportSettings?: $ColumnExportSettings;
  /** An AI notice in the column header (sap.fe.macros.table.ColumnAINotice). */
  aiNotice?: $ColumnAINoticeSettings;
}

/** A custom action (sap.fe.macros.table.Action) of the `actions` aggregation. */
export interface $ActionSettings {
  /** Unique key; annotation actions have keys like "DataFieldForAction::Namespace.action". */
  key: string;
  /** Button text. */
  text: string;
  /** Key of the action the new one is placed next to; default: after the last action. */
  anchor?: string;
  /** @defaultValue "After" */
  placement?: 'After' | 'Before';
  /** @defaultValue true */
  enabled?: boolean;
  /** Enabled only with one ("single") or at least one ("multi") selected row. */
  enableOnSelect?: 'single' | 'multi';
  /** Enabled only with selected rows. */
  requiresSelection?: boolean;
  /** @defaultValue true */
  visible?: boolean;
  /** The button was pressed; the contexts of the selected rows are passed. */
  onPress?(e: { selectedContexts: Context[] }): void;
  /** Marks the action as an AI operation (an AI icon on the button). */
  isAIOperation?: boolean;
  /** The overflow group of the action in the toolbar (sap.fe.macros.table.Action `overflowGroup`; see `actionOverflowGroups`). */
  overflowGroup?: number;
  /** Priority in the overflow toolbar: "High" stays, "Low" moves first, "AlwaysOverflow" / "NeverOverflow" (sap.m.OverflowToolbarPriority). */
  priority?: 'AlwaysOverflow' | 'Disappear' | 'High' | 'Low' | 'NeverOverflow';
}

/**
 * A menu button of the `actions` aggregation (sap.fe.macros.table.ActionGroup; FE TableDefinition turns it into a
 * manifest menu). Its `actions` are the menu items: an action whose key is an existing toolbar action (annotation or
 * custom) without `onPress` moves that action into the menu, the others are added as custom actions. With
 * `defaultAction` (the key of an action) the menu button is a split button whose main part runs that action (FE
 * ActionsTemplating getMenuButton: MenuButton buttonMode "Split", useDefaultActionOnly). A menu without items is not shown.
 */
export interface $ActionGroupSettings {
  /** Unique key of the menu button. */
  key: string;
  /** Button text. */
  text: string;
  /** Key of the action the menu button is placed next to; default: before "Create" like the custom actions. */
  anchor?: string;
  /** @defaultValue "After" */
  placement?: 'After' | 'Before';
  /** Key of the action run by the menu button itself (a split button). */
  defaultAction?: string;
  /** The overflow group of the menu button in the toolbar. */
  overflowGroup?: number;
  /** Priority in the overflow toolbar (sap.m.OverflowToolbarPriority). */
  priority?: 'AlwaysOverflow' | 'Disappear' | 'High' | 'Low' | 'NeverOverflow';
  /** The menu items. */
  actions: $ActionSettings[];
}

/** A separator group of the toolbar's overflow (sap.fe.macros.table.OverflowGroup). */
export interface $OverflowGroupSettings {
  /** The group of the toolbar separator in the overflow toolbar. */
  overflowGroup?: number;
  /** Shows a toolbar separator before the group. */
  showSeparator?: boolean;
}

/** Quick filters of the table toolbar (sap.fe.macros.table.QuickVariantSelection). */
export interface $QuickVariantSelectionSettings {
  /** Annotation paths of the UI.SelectionVariant (or UI.SelectionPresentationVariant) annotations used as quick filters. */
  paths?: string[];
  /** Shows the counts next to the texts. @defaultValue false */
  showCounts?: boolean;
}

/** The mass edit dialog (sap.fe.macros.table.MassEdit). */
export interface $MassEditSettings {
  /** Fields shown in the mass edit dialog (default: the updatable fields of the columns). */
  visibleFields?: string[];
  /** Fields left out of the mass edit dialog. */
  ignoredFields?: string[];
  /** "ChangeSet": the changes are saved together; "Isolated": each object on its own. */
  operationGroupingMode?: 'ChangeSet' | 'Isolated';
  /** Further content of the dialog, below the fields (FE: a sap.ui.layout.form.FormContainer). */
  customContent?: ReactNode;
}

/** Settings of the analytical table (sap.fe.macros.table.AnalyticalConfiguration). */
export interface $AnalyticalConfigurationSettings {
  /** True if leaf level rows shall display aggregated data. @defaultValue false */
  aggregationOnLeafLevel?: boolean;
}

/** Creation options (sap.fe.macros.table.TableCreationOptions) of the `creationMode` aggregation. */
export interface $TableCreationOptionsSettings {
  /**
   * "CreationDialog" (a dialog with the line item fields; then the object page of a list), "Inline" /
   * "InlineCreationRows" (a new row in sub-tables), "NewPage" (draft lists: a new draft opens on the object page; lists
   * without draft use the dialog). Default: "CreationDialog" for lists, "Inline" for sub-tables; "External" and
   * "AddViaValueHelp" are not implemented yet (they behave as the default).
   */
  name?: 'AddViaValueHelp' | 'CreationDialog' | 'External' | 'Inline' | 'InlineCreationRows' | 'NewPage';
  /** false: no "Create" button (smart-kit addition; FE hides it with UI.CreateHidden). */
  enabled?: boolean;
  /** "CreationDialog": the comma-separated properties the dialog asks (default: the mandatory ones, else the line item's editable fields). */
  creationFields?: string;
  /** "Inline": the new row is created at the end of the table instead of the top. */
  createAtEnd?: boolean;
}

/** What is exported (`onBeforeExport`, `onExported`); the same filters, search and sort as the file. */
export interface Table$BeforeExportEvent {
  entitySet: string;
  /** File name (without .xlsx): `exportFileName`, else the header. */
  title: string;
  filters: FilterState;
  search: string;
  sort: SortItem[];
  /** Ids of the exported columns, in order. */
  columns: string[];
  /** Number of exported rows. */
  rowCount: number;
  /** More rows matched than `exportRequestSize`; only the first `rowCount` are exported. */
  truncated: boolean;
  /** The request that read the rows (without paging). */
  request: QueryRequest;
}
export type Table$ExportedEvent = Table$BeforeExportEvent;

export interface Table$RowPressEvent {
  /** The pressed row. */
  bindingContext: Context;
}
export interface Table$SelectionChangeEvent {
  /** The selected rows (also `getSelectedContexts()`). */
  selectedContexts: Context[];
}

export interface TableQuery {
  filters: FilterState;
  search: string;
}

/** Settings of sap.fe.macros.Table (docs/26b; defaults in "实际默认值（源码）"). */
export interface $TableSettings {
  /**
   * Entity set path as in FE: "/Orders"; a sub-table "/Orders/_Item" (the navigation of the object
   * in `bindingContext`).
   */
  contextPath?: string;
  /**
   * Annotation path of the table: "@com.sap.vocabularies.UI.v1.LineItem#Q" (alias "@UI.LineItem#Q"),
   * "@…SelectionPresentationVariant#Q" or "@…PresentationVariant#Q" (their line item, sort, grouping and totals); sub-tables may
   * prefix the navigation ("_Item/@UI.LineItem"). Default: the LineItem (sub-tables: the one of the UI.Facets entry).
   */
  metaPath?: string;
  /** Instance path of the parent object of a sub-table, e.g. "Orders('1')" (FE: the binding context; smart-kit addition). */
  bindingContext?: string;
  /** Name of the service in `SmartKitProvider` `services`; default: the provider's `defaultService` (smart-kit addition). */
  service?: string;
  /**
   * Table type: "ResponsiveTable" (sap.m.Table, rows scroll with the page; grouping without subtotals), "GridTable"
   * (the grid; no grouping, no totals) and "AnalyticalTable" (the grid with grouping, group subtotals and totals of the
   * custom aggregates, on entity sets with Aggregation.ApplySupported; docs/23, D39). Default: the grid (FE derives
   * it from the annotations, stage 4).
   */
  type?: 'GridTable' | 'ResponsiveTable' | 'AnalyticalTable';
  /**
   * Grid tables: "Auto" fills the available height with its own scrollbar (default of list tables); "Fixed" and
   * "Interactive" grow with the rows and a "More" button (default of sub-tables).
   */
  rowCountMode?: 'Auto' | 'Fixed' | 'Interactive';
  /**
   * Grid tables: the number of rows shown — "Fixed" and "Interactive" show exactly this many rows with their own
   * scrollbar, "Auto" at least this many. Default: "Fixed" / "Interactive" grow with the rows and a "More" button.
   */
  rowCount?: number;
  /**
   * "Control": a variant management of the table's own (columns, sort, grouping, totals and the table's filter) in the
   * toolbar, kept in smart-kit's variant store under `pageKey` (D42). Default: none.
   */
  variantManagement?: '' | 'Control';
  /** Quick filters: a segmented button (≤ 3) or a select (> 3) of selection variants in the toolbar. */
  quickVariantSelection?: $QuickVariantSelectionSettings;
  /** Separators of the toolbar actions' overflow groups. */
  actionOverflowGroups?: $OverflowGroupSettings[];
  /** Offers "Edit" (mass edit) for the selected rows in a dialog. */
  massEdit?: $MassEditSettings;
  /** Analytical tables: how the leaves are read. */
  analyticalConfiguration?: $AnalyticalConfigurationSettings;
  /**
   * Pasting rows from the clipboard (Ctrl+V on the table) creates them, when the table can create inline (editable
   * sub-tables). Default: true in sub-tables (FE: object page), else false.
   */
  enablePaste?: boolean;
  /** Pasted values also fill computed (Core.Computed) properties. @defaultValue false */
  enablePastingOfComputedProperties?: boolean;
  /** Table title in the toolbar; default `UI.HeaderInfo/TypeNamePlural`, with the row count. */
  header?: string;
  /** Shows the title. Default true. */
  headerVisible?: boolean;
  /** Heading level of the title (OP Title Styles; smart-kit addition). Default "H2". */
  headerLevel?: TitleLevel;
  /** Shows the busy indicator. */
  busy?: boolean;
  /** Grid tables: lower rows (condensed content density). Default false. */
  condensedTableLayout?: boolean;
  /** A button in the toolbar shows the table in full screen. */
  enableFullScreen?: boolean;
  /** false: rows are loaded only after `refresh()` (or a new `query`). Default: loaded at once. */
  initialLoad?: boolean;
  /**
   * "No data" display: "text", or an illustrated message ("illustratedMessage-Auto", "-Base", "-ExtraSmall", "-Small",
   * "-Medium", "-Large"; "-Dot", "-Spot", "-Scene" as ExtraSmall, Small, Large). Default "text" (FE: illustratedMessage-Auto, stage 4).
   */
  modeForNoDataMessage?: 'illustratedMessage-Auto' | 'illustratedMessage-Base' | 'illustratedMessage-Medium' | 'illustratedMessage-Dot' | 'illustratedMessage-ExtraSmall' | 'illustratedMessage-Scene' | 'illustratedMessage-Large' | 'illustratedMessage-Spot' | 'illustratedMessage-Small' | 'text';
  /** Responsive tables: arrangement of the pop-in ("Block", "GridSmall", "GridLarge"). Default "Block". */
  popinLayout?: PopinLayout;
  /** Maximum number of selected rows (0: no limit). Default 200. */
  selectionLimit?: number;
  /** Offers "Export to Spreadsheet" in the toolbar. Default true. */
  enableExport?: boolean;
  /** File name of the export (without .xlsx); default the header. */
  exportFileName?: string;
  /** Sheet name of the export. */
  exportSheetName?: string;
  /** Maximum rows of the export (read in requests of 500). Default 10 000. */
  exportRequestSize?: number;
  /** Hides "Copy" of the selected rows to the clipboard. Default false. */
  disableCopyToClipboard?: boolean;
  /** Display only: no create, no delete in sub-tables. Default for sub-tables: true (the parent is not in edit mode). */
  readOnly?: boolean;
  /** Search field in the toolbar (when the service can search). Default: no search field. */
  isSearchable?: boolean;
  /** "None", "Single", "Multi"; "Auto", "ForceMulti" are "Multi", "ForceSingle" is "Single". Default "Multi". */
  selectionMode?: 'None' | 'Single' | 'Multi' | 'Auto' | 'ForceMulti' | 'ForceSingle';
  /** "Select all" check box in tables that hold all rows (responsive, sub-tables); false hides it. */
  enableSelectAll?: boolean;
  /** Rows per request when growing (sub-tables and responsive tables); default 10 for the first, 20 for each further page. */
  threshold?: number;
  /** Grid tables: rows per request while scrolling. Default 100. */
  scrollThreshold?: number;
  /** Grid tables: no column is frozen. */
  disableColumnFreeze?: boolean;
  /** Grid tables: number of frozen (pinned) columns. Default 1. */
  frozenColumnCount?: number;
  /** Column widths follow the type of their content; false: one width for all. @defaultValue true */
  enableAutoColumnWidth?: boolean;
  /** Automatic column widths are at least as wide as the column header. @defaultValue false */
  widthIncludingColumnHeader?: boolean;
  /** Comma-separated properties whose columns are left out. */
  ignoredFields?: string;
  /** Ignores the stored personalization (columns, sort, grouping, totals) of `pageKey`. @defaultValue false */
  ignorePersonalizationChanges?: boolean;
  /**
   * Personalization: "false" hides the settings button; a comma-separated list of "Column", "Sort", "Group",
   * "Aggregate" offers grouping and totals only when listed. Default: all.
   */
  personalization?: string;
  /** Content when there are no rows (replaces the "no data" text). */
  noData?: ReactNode;
  /** Custom columns (sap.fe.macros.table.Column), placed by `anchor` and `placement`. */
  columns?: $ColumnSettings[];
  /** Custom actions and menu buttons (sap.fe.macros.table.Action, sap.fe.macros.table.ActionGroup), placed by `anchor` and `placement`. */
  actions?: ($ActionSettings | $ActionGroupSettings)[];
  /** Creation (sap.fe.macros.table.TableCreationOptions). */
  creationMode?: $TableCreationOptionsSettings;
  /** Applied filters; null means "not executed yet" (shows "To start, set the relevant filters."). Undefined loads without filters (smart-kit addition). */
  query?: TableQuery | null;
  /** Visible column ids in order (controlled, smart-kit addition). */
  visibleColumns?: string[];
  /** Called with the visible column ids after personalization. */
  onVisibleColumnsChange?(ids: string[]): void;
  /** Sort order (controlled); default from `UI.PresentationVariant/SortOrder` (smart-kit addition). */
  sort?: SortItem[];
  /** Called with the new sort order. */
  onSortChange?(sort: SortItem[]): void;
  /** The selection changed. */
  onSelectionChange?(e: Table$SelectionChangeEvent): void;
  /** Called when the total count becomes known (object page tab counts; smart-kit addition). */
  onCountChange?(count: number | undefined): void;
  /** A row was pressed; without a handler rows navigate with NavigationAdapter.toObject when the adapter has an object page. */
  onRowPress?(e: Table$RowPressEvent): void;
  /** Whether rows navigate (shows the chevron). Defaults to `onRowPress` or the adapter's hasObjectPage (smart-kit addition). */
  navigable?: boolean;
  /** Insert, replace or remove columns and toolbar actions (ids as in the model, e.g. "DataField::GrossAmount"; smart-kit addition). */
  extend?: TableExtendEntry[];
  /** Key for restoring sort, columns, scroll and selection on back navigation (smart-kit addition). */
  pageKey?: string;
  /** Grey out the table (filters changed in manual mode; sap.m.Table showOverlay). */
  showOverlay?: boolean;
  /**
   * Called when the rows to export are loaded, before the file is written. Return false (or a promise of false) to
   * cancel: no file is written. Use it to check permissions or to log the export.
   */
  onBeforeExport?(e: Table$BeforeExportEvent): boolean | void | Promise<boolean | void>;
  /** Called after the file was written. */
  onExported?(e: Table$ExportedEvent): void;
  /** Replace the default parts: <Table.Toolbar> etc. */
  children?: ReactNode;
  /** Extra CSS class on the root element. */
  className?: string;
  /** Further properties read with the rows (FE: the table's `additionalProperties`, the manifest's tableSettings; smart-kit addition). */
  additionalProperties?: string[];
  /** Menu buttons for similar actions (smart-kit addition). */
  actionGroups?: ActionGroup[];
  /** Called after an object was created (default for lists: navigate to its object page). */
  onCreated?(path: string, row: Row): void;
  /** Sub-tables ("Fixed" rows): grow when the end of the table is scrolled into view instead of a "More" button. */
  growingScrollToLoad?: boolean;
  /** Sub-tables: above this count only a preview is shown with a "Show All (x)" link (OP Tables; default 200). */
  showAllThreshold?: number;
  /** "Show All (x)": default NavigationAdapter.toTable. */
  onShowAll?(): void;
  /** Worklist (default): rows refresh after an action; continuous: changed rows stay and are marked (LR Working Modes). */
  workingMode?: 'worklist' | 'continuous';
  /** Called with the loaded rows (e.g. paging buttons of a flexible column layout). */
  onRowsChange?(rows: Row[]): void;
  /** Toolbar content after the title (content switch of multiple views, LR Multiple Views). */
  titleAddon?: ReactNode;
  /** Toolbar content before the settings (table / chart toggle). */
  toolbarEnd?: ReactNode;
  /**
   * Group column id (controlled, docs/23; grid tables then load rows in blocks of 100 while scrolling and show group
   * header rows). Default: the column of the first `UI.PresentationVariant/GroupBy` path; null: not grouped.
   */
  groupBy?: string | null;
  /** Called with the group column id after personalization; when given, `groupBy` is fully controlled (undefined: the default). */
  onGroupByChange?(id: string | null): void;
  /** Column ids whose totals are shown (controlled, docs/23). Default: the columns of `UI.PresentationVariant/Total`. */
  totals?: string[];
  /** Called with the total column ids after personalization; when given, `totals` is fully controlled (undefined: the default). */
  onTotalsChange?(ids: string[]): void;
  /** Instance methods: refresh, getSelectedContexts, clearSelection, … (sap.fe.macros.Table). */
  ref?: Ref<Table>;
}

/** Settings of sap.fe.macros.TreeTable: those of `Table` plus the hierarchy. */
export interface $TreeTableSettings extends Omit<$TableSettings, 'type' | 'ref' | 'groupBy' | 'onGroupByChange' | 'totals' | 'onTotalsChange'> {
  /** The only value. @defaultValue "TreeTable" */
  type?: 'TreeTable';
  /** Qualifier of Aggregation.RecursiveHierarchy (default: the type's first hierarchy; without one it is a plain table). */
  hierarchyQualifier?: string;
  /** Levels shown at first (default: UI.PresentationVariant/InitialExpansionLevel + 1, as FE, else 1: the roots); `collapseAll` goes back to the roots (smart-kit addition). */
  initialExpansionLevel?: number;
  /** Leaves (nodes without children) cannot be selected. Default false. */
  disableLeafSelection?: boolean;
  /** Shows the tree in the responsive table (sap.m.Table) kernel, e.g. on phones (smart-kit addition; FE always uses the grid). */
  responsive?: boolean;
  /** A node was expanded or collapsed by the user (sap.ui.table.TreeTable#toggleOpenState; smart-kit addition). */
  onToggleOpenState?(e: TreeTable$ToggleOpenStateEvent): void;
  /** Instance methods of `Table` plus expand, collapse, collapseAll, expandToLevel, isExpanded (sap.ui.table.TreeTable). */
  ref?: Ref<TreeTable>;
}

/** Instance methods of sap.fe.macros.Table (through `ref`). */
export interface Table {
  /** Reloads the rows (and totals). */
  refresh(): void;
  /** Contexts of the selected rows. */
  getSelectedContexts(): Context[];
  clearSelection(): void;
  /** Contexts of the loaded rows. */
  getAllCurrentContexts(): Context[];
  /** Number of rows of the result, when known. */
  getCount(): number | undefined;
  /** Hides the columns with these keys (they stay in the personalization dialog). */
  hideColumns(columnKeys: string[], keepInPersonalisationDialog?: boolean): Promise<void>;
  /** Shows the columns with these keys, at the end or at `position`. */
  showColumns(columnKeys: (string | { key: string; position: number })[]): Promise<void>;
  /** Changes column labels at runtime. */
  changeColumnsLabel(labelChanges: { key: string; newLabel: string; newTooltip?: string }[]): Promise<void>;
  getIgnoredFields(): string;
  setIgnoredFields(ignoredFields: string): Table;
  /** Adds a message about the whole table to the page messages; resolves with its id. */
  addMessage(parameters: { message?: string; description?: string; type?: 'Error' | 'Warning' | 'Success' | 'Information' | 'None'; persistent?: boolean }): Promise<string>;
  removeMessage(id: string): void;
  /** Key of the selected variant of `variantManagement` "Control" ("" the standard variant); null without one. */
  getCurrentVariantKey(): string | null;
  /** Selects a variant of `variantManagement` "Control"; an unknown key is ignored. */
  setCurrentVariantKey(key: string): void;
  /** Sort, grouping, totals and the visible columns as the JSON form of sap.fe.navigation.PresentationVariant. */
  getPresentationVariant(): Promise<PresentationVariant>;
  /** Applies sort (SortOrder), grouping (GroupBy), totals (Aggregations) and columns (the LineItem visualization). */
  setPresentationVariant(tablePV: PresentationVariant): Promise<void>;
  /** The table's own filter conditions (not the filter bar's) as the JSON form of sap.fe.navigation.SelectionVariant. */
  getSelectionVariant(): Promise<SelectionVariant>;
  /** Clears the table's own filter conditions and applies the SelectionVariant. */
  setSelectionVariant(selectionVariant: SelectionVariant, prefillDescriptions?: boolean): Promise<void>;
}

/** Instance methods of sap.fe.macros.TreeTable: those of `Table` plus the tree methods of sap.ui.table.TreeTable. */
export interface TreeTable extends Omit<Table, 'setIgnoredFields'>, TreeMethods {
  setIgnoredFields(ignoredFields: string): TreeTable;
}

/** Internal settings shared by both components. */
interface CoreSettings extends Omit<$TreeTableSettings, 'type' | 'ref'>, Pick<$TableSettings, 'groupBy' | 'onGroupByChange' | 'totals' | 'onTotalsChange'> {
  type?: $TableSettings['type'];
  tree?: boolean;
  ref?: Ref<TreeTable>;
}

/** Data of the grid's pinned totals row (docs/23). */
const TOTAL_ROW = '$smartKitTotal';

interface InternalCtx {
  p: CoreSettings;
  ctx: TableContextValue;
  title: string;
  allColumns: ColumnItem[];
  visibleIds: string[];
  setVisibleIds(ids: string[]): void;
  setSort(s: SortItem[]): void;
  actions: ActionItem[];
  copyNow(): void;
  canCopy: boolean;
  copied: string | null;
  details: { available: boolean; shown: boolean; toggle(): void };
  fullScreen: { on: boolean; toggle(): void };
  /** Width of the table (px), for the toolbar overflow. */
  width: number;
  openP13n(): void;
  exportNow(): void;
  exporting: boolean;
  search: string;
  setSearch(s: string): void;
  searchable: boolean;
  /** The table's variant management (`variantManagement` "Control"). */
  variant?: ReactNode;
  /** The quick filter switch (`quickVariantSelection`). */
  quick?: ReactNode;
  /** The table's own filter conditions (setSelectionVariant): "Filtered By" with a clear button. */
  filterInfo?: { labels: string[]; clear(): void };
}

function useInternal() {
  const c = useContext(TableCtx) as InternalCtx | null;
  if (!c) throw new Error('Table parts must be used inside <Table> or <TreeTable>');
  return c;
}


/** Index of the row at the top of the viewport (getFirstDisplayedRowIndex includes the render buffer). */
function topRowIndex(api: GridApi): number {
  const first = api.getDisplayedRowAtIndex(Math.max(0, api.getFirstDisplayedRowIndex() ?? 0));
  const height = first?.rowHeight || 1;
  return Math.max(0, Math.round(api.getVerticalPixelRange().top / height));
}

function defaultWidth(f: FieldModel | undefined, edmType: string | undefined): number {
  if (f?.kind === 'dataPoint') return f.dataPoint?.visualization === 'Progress' ? 180 : 130;
  if (f?.kind === 'chart') return 160;
  if (edmType === 'Edm.Date') return 130;
  if (edmType === 'Edm.DateTimeOffset') return 180;
  if (edmType && /Decimal|Int|Double|Single/.test(edmType)) return 150;
  return 200;
}

/**
 * Draft paths a list always requests (FE Table.ts "Some properties are always loaded"): HasActiveEntity on
 * draft-enabled lists; on draft roots also HasDraftEntity and DraftAdministrativeData/InProcessByUser (not for tree
 * tables, which show active instances only). The key of DraftAdministrativeData comes with it, as the SAPUI5 V4 model
 * adds the keys of expanded entities. The draft indicator loads the rest of the administrative data when opened.
 */
function draftPaths(model: MetaModel, type: EntityTypeModel, root: boolean, tree: boolean): string[] {
  const out = ['HasActiveEntity', ...(root ? ['HasDraftEntity'] : [])].filter((p) => p in type.properties);
  const admin = type.navigations.DraftAdministrativeData;
  if (root && !tree && admin) out.push(...(model.entityTypes[admin.targetType]?.keys ?? []).map((k) => `DraftAdministrativeData/${k}`), 'DraftAdministrativeData/InProcessByUser');
  return out;
}

// ---------------------------------------------------------------------------------------------- parts

function TitlePart() {
  const { title, ctx, p } = useInternal();
  const t = useText();
  if (p.headerVisible === false) return null;
  const level = p.headerLevel && p.headerLevel !== 'Auto' ? Number(p.headerLevel.slice(1)) : 2;
  const Tag = `h${level}` as 'h2';
  return (
    <Tag className={`sk-table__title sk-title--h${level === 2 ? 3 : level}`} data-sk-table-title data-level={level}>
      {ctx.count === undefined ? title : t('table.title', { title, count: ctx.count })}
    </Tag>
  );
}

function VariantPart() {
  return <>{useInternal().variant ?? null}</>;
}

function QuickPart() {
  return <>{useInternal().quick ?? null}</>;
}

/** The info bar of the table's own filter (sap.ui.mdc.Table "Filtered By"). */
function FilterInfoPart() {
  const { filterInfo } = useInternal();
  const t = useText();
  if (!filterInfo?.labels.length) return null;
  return (
    <Group gap="xs" wrap="nowrap" className="sk-table__filter-info" role="status" data-sk-table-filter-info>
      <Text size="sm" className="sk-grow">{t('table.filteredBy', { fields: filterInfo.labels.join(', ') })}</Text>
      <ActionIcon variant="subtle" size="sm" aria-label={t('table.clearFilters')} title={t('table.clearFilters')} onClick={filterInfo.clear} data-sk-table-filter-clear><X className="sk-icon" /></ActionIcon>
    </Group>
  );
}

function ActionsPart() {
  const { actions, ctx, width } = useInternal();
  const t = useText();
  const btn = (a: ActionItem) => {
    const disabled = (a.requiresSelection && ctx.selected.length === 0) || (a.enabled ? !a.enabled(ctx.selected) : false);
    return { disabled, onPress: () => a.onPress(ctx) };
  };
  // Menu buttons (UI.DataFieldForActionGroup, `actionGroups`) stand at their position and are always enabled; their
  // items are enabled by the selection (FE ActionsTemplating getMenuButton: `enabled` of the menu itself).
  const shown = actions.filter((a) => !a.hidden && (!a.menu || a.menu.length));
  // sap.m.OverflowToolbar (FE table toolbar): actions move into "More" only when they do not fit. The widths are
  // estimated from the labels (title, search and the table buttons keep about 520px); narrow tables (e.g. the first
  // column of a flexible column layout) keep at most two. Priorities (sap.m.OverflowToolbarPriority): "NeverOverflow"
  // stays, "AlwaysOverflow" / "Disappear" go, "Low" goes before the others; an overflow group goes as a whole.
  const keep = new Set<ActionItem>();
  if (width >= 560) {
    let room = width - 520;
    const cost = (a: ActionItem) => (a.content ? 160 : a.label.length * 7.5 + 34 + (a.menu ? 20 : 0) + (a.ai ? 20 : 0));
    for (const a of shown.filter((x) => x.priority === 'NeverOverflow')) { keep.add(a); room -= cost(a); }
    for (const a of [...shown.filter((x) => !x.priority || x.priority === 'High'), ...shown.filter((x) => x.priority === 'Low')]) {
      if (room - cost(a) < 0) break;
      room -= cost(a);
      keep.add(a);
    }
    if (width < 900) [...keep].filter((a) => a.priority !== 'NeverOverflow').slice(2).forEach((a) => keep.delete(a));
  } else for (const a of shown.filter((x) => x.priority === 'NeverOverflow')) keep.add(a);
  for (const a of shown) if (a.overflowGroup !== undefined && a.priority !== 'NeverOverflow' && shown.some((x) => x.overflowGroup === a.overflowGroup && !keep.has(x) && x.priority !== 'Disappear')) keep.delete(a);
  const inline = shown.filter((a) => keep.has(a));
  const overflow = shown.filter((a) => !keep.has(a) && a.priority !== 'Disappear').flatMap((a) => (a.menu ? a.menu.map((m, i) => (i === 0 ? { ...m, separator: a.separator } : m)) : [a]));
  return (
    <>
      {inline.map((a) => {
        if (a.content !== undefined) {
          // FE getCustomToolbarContent: the custom content stands in the toolbar instead of a button
          return (
            <span key={a.id} className="sk-table__action" data-sk-toolbar-content={a.id}>
              {a.separator ? <span className="sk-toolbar__separator" role="separator" aria-orientation="vertical" data-sk-separator /> : null}
              {a.content}
            </span>
          );
        }
        if (a.menu) {
          const ai = a.ai ? <Sparkles className="sk-icon" /> : undefined;
          const items = (
            <Menu.Dropdown>
              {a.menu.map((m) => { const b = btn(m); return <Menu.Item key={m.id} disabled={b.disabled} onClick={b.onPress} leftSection={m.ai ? <Sparkles className="sk-icon" /> : undefined} data-sk-action={m.id}>{m.label}</Menu.Item>; })}
            </Menu.Dropdown>
          );
          // FE getMenuButton: with a default action a split button (sap.m.MenuButton buttonMode "Split")
          if (a.split) {
            return (
              <Group key={a.id} gap={0} wrap="nowrap" display="inline-flex" data-sk-action-group={a.id} data-sk-split>
                <Button variant="subtle" leftSection={ai} onClick={() => a.onPress(ctx)} data-sk-action-group-default={a.id}>{a.label}</Button>
                <Menu position="bottom-end">
                  <Menu.Target>
                    <ActionIcon size="lg" variant="subtle" aria-label={a.label} data-sk-action-group-arrow={a.id}><ChevronDown className="sk-icon" /></ActionIcon>
                  </Menu.Target>
                  {items}
                </Menu>
              </Group>
            );
          }
          return (
            <Menu key={a.id} position="bottom-end">
              <Menu.Target>
                <Button variant="subtle" leftSection={ai} rightSection={<ChevronDown className="sk-icon" />} data-sk-action-group={a.id}>{a.label}</Button>
              </Menu.Target>
              {items}
            </Menu>
          );
        }
        const b = btn(a);
        return (
          <span key={a.id} className="sk-table__action">
            {a.separator ? <span className="sk-toolbar__separator" role="separator" aria-orientation="vertical" data-sk-separator /> : null}
            <Button variant="subtle" disabled={b.disabled} onClick={b.onPress} leftSection={a.ai ? <Sparkles className="sk-icon" /> : undefined} data-sk-action={a.id}>{a.label}</Button>
          </span>
        );
      })}
      {overflow.length ? (
        <Menu position="bottom-end">
          <Menu.Target>
            <ActionIcon aria-label={t('table.overflow')} title={t('table.overflow')}><MoreHorizontal className="sk-icon" /></ActionIcon>
          </Menu.Target>
          <Menu.Dropdown>
            {overflow.map((a, i) => {
              const b = btn(a);
              return (
                <span key={a.id}>
                  {a.separator && i > 0 ? <Menu.Divider data-sk-separator /> : null}
                  {a.content !== undefined
                    ? <div className="sk-table__overflow-content" data-sk-toolbar-content={a.id}>{a.content}</div>
                    : <Menu.Item disabled={b.disabled} onClick={b.onPress} data-sk-action={a.id}>{a.label}</Menu.Item>}
                </span>
              );
            })}
          </Menu.Dropdown>
        </Menu>
      ) : null}
    </>
  );
}

function SettingsPart() {
  const { openP13n, p } = useInternal();
  const t = useText();
  if (p.personalization === 'false') return null;
  return (
    <Tooltip label={t('table.settings')}>
      <ActionIcon onClick={openP13n} aria-label={t('table.settings')} data-sk-table-settings><Settings2 className="sk-icon" /></ActionIcon>
    </Tooltip>
  );
}

function ExportPart() {
  const { exportNow, exporting, p } = useInternal();
  const t = useText();
  if (p.enableExport === false) return null;
  return (
    <Tooltip label={exporting ? t('table.exporting') : t('table.export')}>
      <ActionIcon onClick={exportNow} loading={exporting} aria-label={t('table.export')} data-sk-table-export><Download className="sk-icon" /></ActionIcon>
    </Tooltip>
  );
}

function SearchPart() {
  const { search, setSearch, searchable } = useInternal();
  const t = useText();
  const [draft, setDraft] = useState(search);
  if (!searchable) return null;
  return (
    <form onSubmit={(e) => { e.preventDefault(); setSearch(draft); }} className="sk-table__search">
      <TextInput size="xs" value={draft} onChange={(e) => setDraft(e.currentTarget.value)} onBlur={() => setSearch(draft)} placeholder={t('table.search')} aria-label={t('table.search')} leftSection={<Search className="sk-icon" />} />
    </form>
  );
}

function CopyPart() {
  const { copyNow, canCopy, ctx, copied } = useInternal();
  const t = useText();
  if (!canCopy) return null;
  return (
    <>
      {copied ? <span className="sk-table__status" role="status" data-sk-copy-status>{copied}</span> : null}
      <Tooltip label={t('actions.copy')}>
        <ActionIcon onClick={copyNow} disabled={!ctx.selected.length} aria-label={t('actions.copy')} data-sk-table-copy><Copy className="sk-icon" /></ActionIcon>
      </Tooltip>
    </>
  );
}

function DetailsPart() {
  const { details } = useInternal();
  const t = useText();
  if (!details.available) return null;
  const label = details.shown ? t('table.hideDetails') : t('table.showDetails');
  return (
    <Tooltip label={label}>
      <ActionIcon onClick={details.toggle} aria-label={label} aria-pressed={details.shown} data-sk-table-details>{details.shown ? <ListCollapse className="sk-icon" /> : <ListTree className="sk-icon" />}</ActionIcon>
    </Tooltip>
  );
}

function FullScreenPart() {
  const { p, fullScreen } = useInternal();
  const t = useText();
  if (!p.enableFullScreen) return null;
  const label = fullScreen.on ? t('layout.exitFullScreen') : t('layout.fullScreen');
  return (
    <Tooltip label={label}>
      <ActionIcon onClick={fullScreen.toggle} aria-label={label} aria-pressed={fullScreen.on} data-sk-table-fullscreen>{fullScreen.on ? <Minimize2 className="sk-icon" /> : <Maximize2 className="sk-icon" />}</ActionIcon>
    </Tooltip>
  );
}

function ToolbarPart({ children, before }: { children?: ReactNode; before?: ReactNode }) {
  const { p } = useInternal();
  return (
    <div className="sk-table__toolbar" role="toolbar">
      {children ?? (
        <>
          <TitlePart />
          <VariantPart />
          {before ?? p.titleAddon ?? <QuickPart />}
          <span className="sk-grow" />
          <Group gap="xs" wrap="nowrap" className="sk-table__toolbar-actions">
            {p.isSearchable ? <SearchPart /> : null}
            <ActionsPart />
            <CopyPart />
            <DetailsPart />
            {p.toolbarEnd}
            <SettingsPart />
            <ExportPart />
            <FullScreenPart />
          </Group>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------- table

/** Line item and presentation of a `metaPath` (docs/30 §5.2); undefined parts fall back to the defaults. */
function resolveMetaPath(ui: { lineItems: Record<string, FieldModel[]>; views: { id: string; lineItem: FieldModel[]; presentation: PresentationModel }[]; presentationVariants: Record<string, { presentation: PresentationModel; lineItemQualifier?: string }> }, metaPath: string | undefined): { lineItem?: FieldModel[]; presentation?: PresentationModel } {
  if (!metaPath) return {};
  const { term, qualifier } = parseAnnotationPath(metaPath);
  if (term === 'LineItem') return { lineItem: ui.lineItems[qualifier] };
  if (term === 'SelectionPresentationVariant') {
    const v = ui.views.find((x) => x.id === qualifier);
    return v ? { lineItem: v.lineItem, presentation: v.presentation } : {};
  }
  if (term === 'PresentationVariant') {
    const pv = ui.presentationVariants[qualifier];
    return pv ? { lineItem: ui.lineItems[pv.lineItemQualifier ?? ''], presentation: pv.presentation } : {};
  }
  return {};
}

/** Entity set or sub-table source of `contextPath`, `metaPath` and `bindingContext`. */
function sourceOf(contextPath: string | undefined, metaPath: string | undefined, bindingContext: string | undefined, model?: MetaModel): { entitySet: string; parent?: { path: string; navigation: string } } {
  const segs = (contextPath ?? '').split('/').filter(Boolean);
  // a parameterized entity set "/P/Set" (Common.ResultContext) is one entity set of the model
  if (!bindingContext && segs.length > 1 && model?.entitySets[segs.join('/')]?.parameters) return { entitySet: segs.join('/') };
  const metaNav = metaPath && metaPath.includes('@') ? metaPath.slice(0, metaPath.indexOf('@')).split('/').filter(Boolean).pop() : undefined;
  const navigation = segs.length > 1 ? segs[segs.length - 1] : metaNav;
  return { entitySet: segs[0] ?? '', parent: bindingContext && navigation ? { path: bindingContext, navigation } : undefined };
}

/** CSS width (px, rem, em) → px for the grid; undefined otherwise. */
function pxWidth(w: string | undefined): number | undefined {
  const m = w ? /^(\d+(?:\.\d+)?)(px|rem|em)?$/.exec(w.trim()) : null;
  return m ? Number(m[1]) * (m[2] === 'rem' || m[2] === 'em' ? 16 : 1) : undefined;
}

const contextOf = (path: string, row: Row): Context => ({ getPath: () => (path.startsWith('/') ? path : `/${path}`), getObject: () => row });

const MESSAGE_TYPE: Record<string, MessageType> = { Error: 'error', Warning: 'warning', Success: 'success', Information: 'info', None: 'info' };

/**
 * The AI notice of a column header (FE getColumnHeaderAiNotice → sap.m.ColumnAIAction; ColumnHelper
 * generateHeaderAIPopover, AiNoticeHelper.generatePopover): an AI button after the header text opening a popover
 * "Created with AI" with the content, the text or the default notice, and a "Close" button.
 */
function ColumnAINotice(p: { notice: $ColumnAINoticeSettings; label: string }) {
  const t = useText();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  // the grid sorts on a click of the header (a native listener): the button handles its clicks natively and keeps them
  // (React's delegated handlers would not see a click stopped here)
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const stop = (e: Event) => e.stopPropagation();
    const toggle = (e: Event) => { e.stopPropagation(); setOpen((o) => !o); };
    el.addEventListener('click', toggle);
    el.addEventListener('mousedown', stop);
    return () => { el.removeEventListener('click', toggle); el.removeEventListener('mousedown', stop); };
  }, []);
  return (
    <Popover opened={open} onChange={setOpen} position="bottom" withArrow shadow="md" width={365}>
      <Popover.Target>
        <ActionIcon ref={ref} size="sm" variant="subtle" aria-label={t('table.aiNotice.title')} title={t('table.aiNotice.title')} data-sk-ai-notice={p.label}>
          <Sparkles className="sk-icon" />
        </ActionIcon>
      </Popover.Target>
      <Popover.Dropdown data-sk-ai-notice-popover>
        <Stack gap="sm">
          <Text fw={600} size="sm">{t('table.aiNotice.title')}</Text>
          {p.notice.content !== undefined && p.notice.contentText === undefined ? p.notice.content : <Text size="sm" className="sk-pre-line">{p.notice.contentText ?? t('table.aiNotice.content')}</Text>}
          <Group justify="flex-end"><Button size="xs" variant="subtle" onClick={() => setOpen(false)}>{t('table.aiNotice.close')}</Button></Group>
        </Stack>
      </Popover.Dropdown>
    </Popover>
  );
}

/** The header text of a grid column with its AI notice (AG Grid innerHeaderComponent). */
function AINoticeHeader(p: { displayName: string; aiNotice: $ColumnAINoticeSettings }) {
  return <span className="sk-table__header-ai">{p.displayName}<ColumnAINotice notice={p.aiNotice} label={p.displayName} /></span>;
}

/**
 * A sap.fe.macros.table.Column (or manifest column) with the key of an annotation column and without template: its
 * settings change the annotation column (FE getColumnsFromManifest propertiesToOverwriteAnnotationColumn).
 */
export type ColumnOverride = $ColumnSettings & Partial<Pick<ColumnItem, 'showDataFieldsLabel' | 'mergeCells' | 'mergeComparisonProperties' | 'formatOptions' | 'microChartSize' | 'showMicroChartLabel'>>;

function overrideColumn(o: ColumnItem, c: ColumnOverride): ColumnItem {
  const set = <K extends keyof ColumnItem>(k: K, v: ColumnItem[K] | undefined) => (v === undefined ? {} : { [k]: v });
  return {
    ...o,
    ...set('width', pxWidth(c.width)), ...set('align', c.horizontalAlign), ...set('importance', c.importance === 'None' ? undefined : c.importance),
    ...set('widthIncludingColumnHeader', c.widthIncludingColumnHeader), ...set('disableExport', c.disableExport),
    ...set('adaptation', c.availability === 'Adaptation' ? true : c.availability === 'Default' ? undefined : o.adaptation),
    ...set('exportSettings', c.exportSettings), ...set('aiNotice', c.aiNotice), ...set('showDataFieldsLabel', c.showDataFieldsLabel),
    ...set('mergeCells', c.mergeCells), ...set('mergeComparisonProperties', c.mergeComparisonProperties), ...set('formatOptions', c.formatOptions),
    ...set('microChartSize', c.microChartSize), ...set('showMicroChartLabel', c.showMicroChartLabel),
  };
}

/**
 * sap.m.Column mergeDuplicates of a responsive table column (FE MdcTableTemplate: mergeCells on ResponsiveTable with
 * the merge key from `mergeComparisonProperties`, else a DataPoint's value, else the column's property; FE
 * isMergeableColumn: DataField (not with action, navigation path or semantic object) and DataPoint columns only,
 * unless comparison properties are given).
 */
function mergeOf(c: ColumnItem, semanticObjectOf: (path: string) => string | undefined): { mergeDuplicates?: boolean; mergeValue?(row: Row): unknown } {
  if (!c.mergeCells) return {};
  const f = c.field;
  const plainField = f?.kind === 'field' && f.path && !f.action && !f.navigationPath && !f.intent && !f.url && !semanticObjectOf(f.path);
  const paths = c.mergeComparisonProperties?.length ? c.mergeComparisonProperties
    : f?.kind === 'dataPoint' && f.dataPoint?.value ? [f.dataPoint.value]
      : plainField ? [f.path!] : [];
  if (!paths.length) return {};
  return { mergeDuplicates: true, mergeValue: (row: Row) => paths.map((x) => String(getPath(row, x) ?? '')).join('|') };
}

function TableCore(p: CoreSettings) {
  ensureGridModules();
  const service = useService(p.service);
  const { navigation, intlLocale, timeZone } = useSmartKit();
  const t = useText();
  const page = useDynamicPage();
  const model = service.model;
  const { entitySet, parent } = sourceOf(p.contextPath, p.metaPath, p.bindingContext, model);
  const source: QuerySource = useMemo(
    () => (parent ? { parent: parent.path, navigation: parent.navigation } : { entitySet }),
    [parent?.path, parent?.navigation, entitySet], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const info = useMemo(() => sourceInfo(model, source), [model, source]);
  const type = model.entityTypes[info.typeName]!;
  const ui = model.ui[info.typeName]!;
  const caps = info.parentSet ? capabilitiesFor(model, info.parentSet, info.navigation) : capabilitiesFor(model, info.entitySet);
  const rowCountMode = p.rowCountMode ?? (parent ? 'Fixed' : 'Auto');
  // `rowCount` with "Fixed" / "Interactive": exactly that many rows with the grid's own scrollbar (sap.ui.table.rowmodes.Fixed)
  const fixedRows = rowCountMode !== 'Auto' && p.rowCount !== undefined && p.rowCount > 0 ? p.rowCount : undefined;
  const mode: 'grid' | 'auto' | 'responsive' = p.type === 'ResponsiveTable' || (p.tree && p.responsive) ? 'responsive' : rowCountMode === 'Auto' || fixedRows ? 'grid' : 'auto';
  const responsive = mode === 'responsive';
  const editing = p.readOnly === undefined ? false : !p.readOnly;
  // Tree table (docs/26 §3.10): no grouping, no totals, no paging.
  const hierarchy = p.tree ? hierarchyOf(model, info.typeName, p.hierarchyQualifier) : undefined;
  const isTree = Boolean(hierarchy);
  const messages = useMessages();
  const draftRoot = !parent && Boolean(model.entitySets[info.entitySet]?.draft?.root);
  // Draft root or node list (FE isObjectPathDraftSupported, outside an object page).
  const draftList = !parent && Boolean(model.entitySets[info.entitySet]?.draft);
  // Quick filters (FE QuickFilterSelector): the selected one's conditions are hidden filters; a selection presentation
  // variant also brings its line item and presentation.
  const quickVariants = useMemo(() => quickVariantsOf(ui, p.quickVariantSelection?.paths), [ui, p.quickVariantSelection?.paths]);
  const [quickKey, setQuickKey] = usePageState<string | undefined>(p.pageKey && quickVariants.length ? `${p.pageKey}:table:quick` : undefined, undefined);
  const activeQuick = quickVariants.find((x) => x.key === quickKey) ?? quickVariants[0];
  const metaPath = activeQuick?.view ? `@com.sap.vocabularies.UI.v1.SelectionPresentationVariant#${activeQuick.view.id}` : p.metaPath;
  const meta = useMemo(() => resolveMetaPath(ui, metaPath), [ui, metaPath]);
  const [ignored, setIgnored] = useState(p.ignoredFields);
  useEffect(() => setIgnored(p.ignoredFields), [p.ignoredFields]);
  const [labels, setLabels] = useState<Record<string, string>>({});

  const lineItem = useMemo(() => {
    const ignoredPaths = new Set((ignored ?? '').split(',').map((x) => x.trim()).filter(Boolean));
    const keep = (fs: FieldModel[]) => (ignoredPaths.size ? fs.filter((f) => !f.path || !ignoredPaths.has(f.path)) : fs);
    if (meta.lineItem) return keep(meta.lineItem);
    if (!parent) return keep(ui.lineItem);
    const parentUi = model.ui[model.entitySets[info.parentSet!]!.typeName]!;
    for (const s of parentUi.sections) for (const sub of s.subSections) {
      if (sub.content.kind === 'table' && sub.content.navigation === info.navigation) return keep(sub.content.columns);
    }
    return keep(ui.lineItem);
  }, [Boolean(parent), meta, ui, model, info, ignored]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cells of special column types run actions and navigate through the latest handlers (set below).
  const cellEnvRef = useRef<CellEnv>({ typeName: info.typeName, service: p.service, run: () => undefined, navigate: () => undefined });
  const allColumns = useMemo(() => {
    const base: ColumnItem[] = lineItem.map((f) => {
      const special = f.kind === 'fieldGroup' || f.kind === 'connectedFields' || f.kind === 'contact' || f.kind === 'action' || (f.kind === 'field' && Boolean(f.action || f.navigationPath));
      return {
        id: f.id,
        // FE Columns: an inline action column is labelled "Inline Action" (header hidden)
        label: f.kind === 'action' ? t('table.inlineAction') : f.label,
        field: f,
        ...(f.width ? { width: pxWidth(f.width) } : {}),
        ...(f.kind === 'action' ? { headerHidden: true, disableExport: true } : {}),
        ...(special ? { render: (row: Row) => specialCell(cellEnvRef.current, f, row) ?? null } : {}),
      };
    });
    // FE getColumnsFromEntityType: the other properties of the type, not hidden, are columns for the personalization
    // (availability "Adaptation"), shown only when added there.
    const used = new Set(lineItem.flatMap((f) => (f.kind === 'dataPoint' ? [f.dataPoint!.value] : f.path ? [f.path] : [])));
    for (const name of type.propertyOrder) {
      const prop = type.properties[name]!;
      if (used.has(name) || prop.hidden || ['IsActiveEntity', 'HasActiveEntity', 'HasDraftEntity'].includes(name) || prop.edmType === 'Edm.Stream') continue;
      base.push({ id: name, label: prop.label, field: { id: name, kind: 'field', path: name, label: prop.label, criticalityIcon: true, isSemanticKey: ui.semanticKey.includes(name) }, adaptation: true });
    }
    // `columns` (sap.fe.macros.table.Column) first, then `extend`. A column with the key of an annotation column and
    // without template changes that column (FE TableDefinition / getColumnsFromManifest isColumnOverride).
    const annotationKeys = new Set(base.map((c) => c.id));
    const overrides: ExtendEntry<ColumnItem>[] = (p.columns ?? []).filter((c) => annotationKeys.has(c.key) && !c.template).map((c) => ({
      id: c.key, position: 'replace', item: (o: ColumnItem) => overrideColumn(o, c),
    }));
    const hiddenKeys = new Set((p.columns ?? []).filter((c) => annotationKeys.has(c.key) && !c.template && c.availability === 'Hidden').map((c) => c.key));
    const custom: ExtendEntry<ColumnItem>[] = (p.columns ?? []).filter((c) => c.availability !== 'Hidden' && !(annotationKeys.has(c.key) && !c.template)).map((c) => ({
      id: c.key, position: c.anchor ? (c.placement === 'Before' ? 'before' : 'after') : 'end', anchor: c.anchor,
      item: {
        id: c.key, label: c.header ?? '', render: c.template, select: c.properties, width: pxWidth(c.width), align: c.horizontalAlign,
        importance: c.importance === 'None' ? undefined : c.importance, disableExport: c.disableExport,
        adaptation: c.availability === 'Adaptation' || undefined, tooltip: c.tooltip, required: c.required, widthIncludingColumnHeader: c.widthIncludingColumnHeader,
        exportSettings: c.exportSettings, aiNotice: c.aiNotice,
      },
    }));
    const colExt = (p.extend ?? []).filter((e) => e.kind !== 'action') as ExtendEntry<ColumnItem>[];
    const out = applyExtensions(applyExtensions(applyExtensions(base, overrides, 'Table columns'), custom, 'Table columns'), colExt, 'Table extend')
      .filter((c) => !hiddenKeys.has(c.id))
      // FE MdcTableTemplate getFieldGroupTemplate: with showDataFieldsLabel each field of the group has its label
      .map((c) => (c.showDataFieldsLabel && c.field?.kind === 'fieldGroup' ? { ...c, render: (row: Row) => specialCell(cellEnvRef.current, c.field!, row, { labels: true, label: (text) => t('table.fieldLabel', { label: text }) }) } : c));
    return Object.keys(labels).length ? out.map((c) => (labels[c.id] ? { ...c, label: labels[c.id]! } : c)) : out;
  }, [lineItem, p.columns, p.extend, labels, type, t]); // eslint-disable-line react-hooks/exhaustive-deps
  const modelActions: ActionModel[] = ui.actions;
  const creationName = p.creationMode?.name;
  const createMode = p.creationMode?.enabled === false ? 'none' : creationName === 'CreationDialog' ? 'dialog' : creationName === 'Inline' || creationName === 'InlineCreationRows' ? 'inline' : parent ? 'inline' : 'dialog';
  // UI.CreateHidden / UI.DeleteHidden (FE StandardActions): a constant hides the button; a path is read from the parent
  // context, which a list does not have (the button stays).
  const hiddenBy = (r: { value: unknown } | { path: string } | undefined) => Boolean(r && 'value' in r && r.value === true);
  const canCreate = createMode !== 'none' && caps.insertable && !hiddenBy(caps.createHidden) && (!parent || editing) && Boolean(service.dataProvider.create);
  const canDelete = (!parent || editing) && caps.deletable && !hiddenBy(caps.deleteHidden) && Boolean(service.dataProvider.remove);
  /** DeleteRestrictions/Deletable as a path: only rows where it is not false are deleted (FE deletableContexts). */
  const isDeletable = (row: Row) => !caps.deletablePath || getPath(row, caps.deletablePath) !== false;
  const [creating, setCreating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Row[] | null>(null);
  const canMassEdit = Boolean(p.massEdit) && caps.updatable && !hiddenBy(caps.updateHidden) && (!parent || editing) && Boolean(service.dataProvider.update) && p.selectionMode !== 'None' && p.selectionMode !== 'Single' && p.selectionMode !== 'ForceSingle';
  /** Draft lists edit the active objects without a draft (FE: the updatable contexts of a read-only draft table). */
  const massEditable = (row: Row) => !draftRoot || (row.IsActiveEntity !== false && !row.HasDraftEntity);
  const [massEditRows, setMassEditRows] = useState<Row[] | null>(null);

  const stateKey = p.pageKey && !p.ignorePersonalizationChanges ? `${p.pageKey}:table` : undefined;
  const firstPage = p.threshold ?? 10;
  const growSize = p.threshold ?? 20;
  const [own, setOwn] = usePageState<{ columns: string[]; known?: string[]; sort?: SortItem[]; search: string; loaded: number; groupBy?: string | null; totals?: string[]; details?: boolean; filters?: FilterState }>(stateKey, () => ({ columns: allColumns.filter((c) => !c.adaptation).map((c) => c.id), search: '', loaded: firstPage }));
  const visibleIds = (p.visibleColumns ?? own.columns).filter((id) => allColumns.some((c) => c.id === id));
  // Columns added by extensions after the state was stored are shown too.
  const known = new Set([...(own.known ?? own.columns), ...(p.visibleColumns ?? [])]);
  const visible = [...visibleIds, ...allColumns.filter((c) => !c.adaptation && !known.has(c.id) && !p.visibleColumns).map((c) => c.id)];
  const setVisibleIds = (ids: string[]) => { if (!p.visibleColumns) setOwn((s) => ({ ...s, columns: ids, known: allColumns.map((c) => c.id) })); p.onVisibleColumnsChange?.(ids); };
  const presentation = meta.presentation ?? ui.presentation;
  // Tree tables: PV InitialExpansionLevel n shows n + 1 levels (FE Table getInitialExpansionLevel); default the roots.
  const treeState = useTreeState(p.initialExpansionLevel ?? (presentation.initialExpansionLevel !== undefined ? presentation.initialExpansionLevel + 1 : 1));
  const baseSort = p.sort ?? own.sort ?? presentation.sortOrder;
  const setSort = (s: SortItem[]) => { if (!p.sort) setOwn((x) => ({ ...x, sort: s })); p.onSortChange?.(s); };
  const search = own.search;
  const setSearch = (s: string) => setOwn((x) => ({ ...x, search: s }));

  const visibleColumns = visible.map((id) => allColumns.find((c) => c.id === id)!).filter(Boolean);
  const fields = visibleColumns.map((c) => c.field).filter((f): f is FieldModel => Boolean(f));
  const draftFields = draftList ? draftPaths(model, type, draftRoot, isTree) : [];
  // LineItem@UI.Criticality: the row highlight (FE Table getHighlightRowBinding, TableFormatter rowHighlighting).
  const lineItemQualifier = metaPath && parseAnnotationPath(metaPath).term === 'LineItem' ? parseAnnotationPath(metaPath).qualifier : '';
  const highlightRef = ui.rowHighlight?.[lineItemQualifier];
  const extraSelect = [...visibleColumns.flatMap((c) => c.select ?? []), ...(p.additionalProperties ?? []), ...actionPaths(modelActions), ...draftFields,
    ...(highlightRef && 'path' in highlightRef ? [highlightRef.path] : []), ...(caps.deletablePath ? [caps.deletablePath] : [])];
  // The ETag property (Core.OptimisticConcurrency) is not selected: the service returns `@odata.etag` with every entity,
  // and the OData V4 model of Fiori elements does not add it to $select either (DV-FE-02).
  // D39 (FE updateTableVisualizationForType, getP13nMode): only the analytical table (type "AnalyticalTable" on an
  // entity set with Aggregation.ApplySupported) groups with subtotals and shows totals; the responsive table groups
  // without subtotals (FE groupConditions, p13n "Group"); the grid table neither groups nor totals.
  const analytical = p.type === 'AnalyticalTable' && !isTree && Boolean(caps.aggregation);
  // Grouping (docs/12 U-5, docs/23): rows are sorted by the group property first.
  const fieldPath = (c: ColumnItem | undefined) => (c?.field?.kind === 'field' ? c.field.path : undefined);
  const columnOfPath = (path: string | undefined) => (path ? allColumns.find((c) => fieldPath(c) === path)?.id : undefined);
  // FE PropertyInfos (table Columns getColumnsFromEntityType, Property_Technical): the properties the sort panel offers,
  // and the group panel of a responsive table (isGroupable = sortable). The type's properties that are not hidden, except
  // non-sortable ones and those shown as their text only (FE display mode Description: the text is sorted instead), plus
  // the technical properties of the LineItem columns, the texts and criticality paths (FE comparison cols5-p13n-*).
  const p13nProps = useMemo(() => {
    const out = new Map<string, string>();
    const add = (path: string | undefined) => {
      const prop = path ? resolvePath(model.entityTypes, info.typeName, path).property : undefined;
      if (!path || !prop || out.has(path) || !isSortable(caps, path) || prop.edmType === 'Edm.Stream') return;
      if (prop.text && prop.textArrangement === 'TextOnly') return;
      out.set(path, prop.label);
    };
    for (const name of type.propertyOrder) {
      if (!type.properties[name]!.hidden && !['IsActiveEntity', 'HasActiveEntity', 'HasDraftEntity'].includes(name)) add(name);
    }
    for (const f of lineItem) {
      const prop = f.kind === 'field' && f.path ? resolvePath(model.entityTypes, info.typeName, f.path).property : undefined;
      if (prop?.text && f.path) add([...f.path.split('/').slice(0, -1), prop.text].join('/'));
      if (f.criticality && 'path' in f.criticality) add(f.criticality.path);
    }
    return [...out].map(([path, label]) => ({ path, label }));
  }, [model, info.typeName, caps, type, lineItem]);
  // Responsive table: group by any of them (by its column when there is one); analytical table: the groupable columns.
  const groupable: { id: string; label: string; path: string }[] = responsive
    ? p13nProps.map((x) => ({ id: columnOfPath(x.path) ?? x.path, label: x.label, path: x.path }))
    : allColumns.flatMap((c) => { const path = fieldPath(c); return path && canGroup(model, source, path) ? [{ id: c.id, label: c.label, path }] : []; });
  // With onGroupByChange the parent keeps the state (a variant): undefined there means the annotation default.
  const groupOwned = p.groupBy !== undefined || Boolean(p.onGroupByChange);
  const groupChoice = (groupOwned ? p.groupBy : own.groupBy) ?? (groupOwned || own.groupBy === undefined ? columnOfPath(presentation.groupBy[0]) ?? null : null);
  const canGroupHere = !isTree && (responsive || (analytical && mode === 'grid'));
  const groupBy = canGroupHere && groupChoice && groupable.some((c) => c.id === groupChoice) ? groupChoice : null;
  const groupPath = groupBy ? groupable.find((c) => c.id === groupBy)?.path : undefined;
  // a group property without a shown column (a column text or criticality, a hidden column): read with the rows
  if (groupPath && !fields.some((f) => f.path === groupPath)) extraSelect.push(groupPath);
  const setGroupBy = (id: string | null) => { if (!groupOwned) setOwn((x) => ({ ...x, groupBy: id })); p.onGroupByChange?.(id); };
  // Totals (docs/23, D39): analytical tables only, columns of custom aggregates (Aggregation.CustomAggregate).
  const totalPath = (c: ColumnItem | undefined) => { const path = analytical ? fieldPath(c) : undefined; return path && canTotal(model, source, path) ? path : undefined; };
  const totalable = analytical ? allColumns.filter((c) => totalPath(c)) : [];
  const totalsOwned = p.totals !== undefined || Boolean(p.onTotalsChange);
  // Default (FE getAggregateConditions): the columns of UI.PresentationVariant/Total (an empty Total: none); without
  // Total all custom aggregates.
  const defaultTotals = presentation.hasTotal || presentation.total.length ? totalable.filter((c) => presentation.total.includes(totalPath(c)!)) : totalable;
  const totalIds = (totalsOwned ? p.totals : own.totals) ?? defaultTotals.map((c) => c.id);
  const setTotals = (ids: string[]) => { if (!totalsOwned) setOwn((x) => ({ ...x, totals: ids })); p.onTotalsChange?.(ids); };
  // The table's own conditions (FE: the mdc table's filter, setSelectionVariant) and the quick filter: hidden filters.
  const controlFilters = own.filters ?? {};
  const setControlFilters = (f: FilterState) => setOwn((x) => ({ ...x, filters: f }));
  const tableHidden = useMemo(() => {
    const out: FilterState = { ...conditionsAsFilters(activeQuick?.conditions ?? []) };
    for (const [k, v] of Object.entries(controlFilters)) out[k] = [...(out[k] ?? []), ...v];
    return out;
  }, [activeQuick, JSON.stringify(controlFilters)]); // eslint-disable-line react-hooks/exhaustive-deps
  const filters = useMemo(() => (Object.keys(tableHidden).length ? withHiddenFilters(p.query?.filters ?? {}, tableHidden) : p.query?.filters ?? {}), [JSON.stringify(p.query?.filters), tableHidden]); // eslint-disable-line react-hooks/exhaustive-deps
  const effectiveSearch = [p.query?.search, search].filter(Boolean).join(' ');
  // initialLoad false: nothing is loaded before refresh() or a new query.
  const [loadRequested, setLoadRequested] = useState(p.initialLoad !== false);
  const firstQuery = useRef(JSON.stringify(p.query));
  useEffect(() => {
    if (firstQuery.current === JSON.stringify(p.query)) return;
    firstQuery.current = JSON.stringify(p.query);
    setLoadRequested(true);
  }, [JSON.stringify(p.query)]); // eslint-disable-line react-hooks/exhaustive-deps
  const executed = p.query !== null && loadRequested;

  const totalColumns = isTree ? [] : visibleColumns.filter((c) => totalIds.includes(c.id) && totalPath(c));
  const measures = [...new Set(totalColumns.map((c) => totalPath(c)!))];
  const [totalsRevision, setTotalsRevision] = useState(0);

  // Grouped grid tables load client-side rows in blocks (the infinite row model cannot insert group rows).
  const gridGrouped = mode === 'grid' && Boolean(groupPath);
  // The grid's infinite row model with server blocks; grouped and tree grids hold client-side rows instead.
  const infinite = mode === 'grid' && !gridGrouped && !isTree;
  // Responsive tables sort by the group property first (sap.m.Table groups consecutive rows); the analytical grid's
  // visual grouping (groupLevels) keeps the table's sort.
  const sort = useMemo(() => (groupPath && !gridGrouped ? [{ path: groupPath, descending: false }, ...baseSort.filter((x) => x.path !== groupPath)] : baseSort), [groupPath, gridGrouped, JSON.stringify(baseSort)]); // eslint-disable-line react-hooks/exhaustive-deps
  // AL-10 (FE AnalyticalTable): the first page reads rows, grand total and count in one $apply, see useAnalytical.ts.
  const apply = useAnalyticalRequests({
    enabled: analytical && executed && !groupPath, service: p.service, source, columns: fields, filters, search: effectiveSearch, sort, extraSelect,
    requestAtLeast: meta.presentation?.requestAtLeast, totals: measures, aggregationOnLeafLevel: p.analyticalConfiguration?.aggregationOnLeafLevel,
    groupExtra: [...visibleColumns.filter((c) => !c.field).flatMap((c) => c.select ?? []), ...(highlightRef && 'path' in highlightRef ? [highlightRef.path] : [])],
    // toolbar actions without an inline column: their OperationAvailable is read when a row is selected
    selectionPaths: actionPaths(modelActions).filter((x) => !actionPaths(fields.flatMap((f) => (f.kind === 'action' && f.action ? [f.action] : []))).includes(x)),
  });
  // Visual grouping of the analytical grid (FE groupLevels): collapsible groups, read on demand (useAnalyticalGroups.ts).
  const notWithRows = actionPaths(modelActions).filter((x) => !actionPaths(fields.flatMap((f) => (f.kind === 'action' && f.action ? [f.action] : []))).includes(x));
  const [groupsRevision, setGroupsRevision] = useState(0);
  const groupDisplayRef = useRef<(row: Row) => string>(() => '');
  const groups = useAnalyticalGroups({
    enabled: gridGrouped && executed, service: p.service, source, groupPath: groupPath ?? '', columns: fields, filters, search: effectiveSearch, sort,
    extraSelect: extraSelect.filter((x) => !notWithRows.includes(x)), requestAtLeast: meta.presentation?.requestAtLeast, totals: measures,
    groupExtra: [...visibleColumns.filter((c) => !c.field).flatMap((c) => c.select ?? []), ...(highlightRef && 'path' in highlightRef ? [highlightRef.path] : [])],
    aggregationOnLeafLevel: p.analyticalConfiguration?.aggregationOnLeafLevel, pageSize: p.scrollThreshold ?? 100,
    display: (row) => groupDisplayRef.current(row), revision: groupsRevision,
  });
  const list = useListQuery({
    service: p.service, source, columns: fields, filters, search: effectiveSearch, sort, extraSelect, requestAtLeast: meta.presentation?.requestAtLeast,
    blockRequest: apply.blockRequest, onBlock: apply.received,
    pageSize: responsive ? p.threshold ?? 20 : Math.max(firstPage, own.loaded),
    growSize: responsive ? p.threshold ?? 20 : growSize,
    enabled: !infinite && executed && !gridGrouped,
    hierarchy: hierarchy ? { qualifier: hierarchy.qualifier, ...treeState.request } : undefined,
  });
  // A new query starts a new selection (rows of the old result may be gone).
  const requestKey = JSON.stringify({ f: list.request.filters, s: list.request.search, o: list.request.orderBy });
  const firstRequest = useRef(requestKey);
  useEffect(() => {
    if (firstRequest.current === requestKey) return;
    firstRequest.current = requestKey;
    setSelected([]);
    apiRef.current?.deselectAll();
  }, [requestKey]);

  const [selected, setSelected] = useState<Row[]>([]);
  const limit = p.selectionLimit ?? 200;
  const selection = p.selectionMode === 'None' ? 'None' : p.selectionMode === 'Single' || p.selectionMode === 'ForceSingle' ? 'Single' : 'Multi';
  // Continuous working mode: rows changed by actions stay in the list and are marked (LR Working Modes).
  const [overrides, setOverrides] = useState<Record<string, Row>>({});
  const [gridRows, setGridRows] = useState<Row[]>([]);
  const [gridCount, setGridCount] = useState<number | undefined>();
  const [gridError, setGridError] = useState<Error | null>(null);
  const [gridEmpty, setGridEmpty] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);
  const apiRef = useRef<GridApi | null>(null);
  const queryClient = useQueryClient();

  // AnalyticalConfiguration aggregationOnLeafLevel: the leaves are aggregates; they are entities (navigable, with bound
  // actions) only when all keys are shown (FE TableDelegate checkAllKeysAreRequested, UI.isNodeLevelNavigable).
  const leafAggregated = analytical && Boolean(p.analyticalConfiguration?.aggregationOnLeafLevel);
  const allKeysShown = type.keys.filter((k) => k !== 'IsActiveEntity').every((k) => fields.some((f) => f.kind === 'field' && f.path === k));
  const leafEntities = !leafAggregated || allKeysShown;
  const keyOf = useCallback((row: Row) => (leafEntities ? keyPredicate(type, row) : JSON.stringify(Object.entries(row).filter(([k]) => !k.startsWith('@')))), [type, leafEntities]);
  const pathOf = useCallback((row: Row) => ('entitySet' in source ? `${source.entitySet}${keyOf(row)}` : `${source.parent}/${source.navigation}${keyOf(row)}`), [source, keyOf]);
  const navigable = (p.navigable ?? Boolean(p.onRowPress || navigation?.hasObjectPage?.(info.entitySet, service.name))) && (leafEntities || Boolean(p.onRowPress));
  const navigate = useCallback((row: Row) => {
    const path = pathOf(row);
    if (p.onRowPress) p.onRowPress({ bindingContext: contextOf(path, row) });
    else navigation?.toObject(path, service.name);
  }, [p, pathOf, navigation, service.name]);

  // Restore selection and scroll position (NAV-04).
  const stored = useStoredState<{ selectedKeys: string[]; firstRow: number }>(stateKey ? `${stateKey}:view` : undefined);
  const restore = useRef(stored.read());

  const loadedRows = useMemo(() => (infinite ? [] : (gridGrouped ? groups.leaves : apply.withLate(list.rows)).map((r) => overrides[keyOf(r)] ?? r)), [infinite, gridGrouped, groups.leaves, list.rows, overrides, keyOf, apply.version]); // eslint-disable-line react-hooks/exhaustive-deps
  const tree = useTree({ hierarchy, rows: loadedRows, tree: treeState, onToggleOpenState: p.onToggleOpenState });
  /** Rows that can be selected: not group headers; with `disableLeafSelection` no tree leaves. */
  const selectable = (row: Row | undefined) => Boolean(row) && !groupOf(row) && !(p.disableLeafSelection && isTree && latest.current.tree.nodeOf(row!)?.drillState === 'leaf');
  // ------------------------------------------------------------------ variants, PresentationVariant, SelectionVariant
  // `variantManagement` "Control" (FE: the mdc table's own variant management): columns, sort, grouping, totals and the
  // table's own filter, in smart-kit's variant store (D42).
  const tableVariantsOn = p.variantManagement === 'Control';
  const defaultColumns = useMemo(() => allColumns.filter((c) => !c.adaptation).map((c) => c.id), [allColumns]);
  const variantStandard = useMemo<VariantContent>(() => ({ columns: defaultColumns, sort: presentation.sortOrder, groupBy: undefined, totals: undefined, filters: {} }), [defaultColumns, presentation]);
  const applyVariant = (c: VariantContent) => {
    setVisibleIds(c.columns ?? defaultColumns);
    setSort(c.sort ?? presentation.sortOrder);
    if (!groupOwned) setOwn((x) => ({ ...x, groupBy: c.groupBy ?? undefined, totals: c.totals, filters: c.filters ?? {} }));
    else { p.onGroupByChange?.(c.groupBy ?? null); setOwn((x) => ({ ...x, filters: c.filters ?? {} })); }
    if (totalsOwned && c.totals) p.onTotalsChange?.(c.totals);
  };
  const tableVariants = useVariants(`${p.pageKey ?? `table:${info.entitySet}`}:variants`, { service: p.service, standard: variantStandard, enabled: tableVariantsOn, onDefaultLoaded: (v) => applyVariant(v.content) });
  const variantContent: VariantContent = { columns: visible, sort: baseSort, groupBy: groupBy ?? undefined, totals: totalIds, filters: controlFilters };
  const pvState = () => ({
    columns: visible, sort: baseSort, groupBy: groupPath ? [groupPath] : [], totals: totalColumns.map((c) => totalPath(c)!),
    initialExpansionLevel: isTree ? (p.initialExpansionLevel ?? (presentation.initialExpansionLevel !== undefined ? presentation.initialExpansionLevel + 1 : undefined)) : undefined,
  });
  const labelOfPath = (path: string) => allColumns.find((c) => fieldPath(c) === path)?.label ?? resolvePath(model.entityTypes, info.typeName, path).property?.label ?? path;

  useImperativeHandle(p.ref, (): TreeTable => {
    const ctxs = (rows: Row[]) => rows.map((r) => contextOf(pathOf(r), r));
    const self: TreeTable = {
      ...tree.api,
      refresh: () => { setLoadRequested(true); ctx.refresh(); },
      getSelectedContexts: () => ctxs(ctx.selected),
      clearSelection: () => { setSelected([]); apiRef.current?.deselectAll(); },
      getAllCurrentContexts: () => ctxs(ctx.rows),
      getCount: () => ctx.count,
      hideColumns: async (keys) => { setVisibleIds(visible.filter((id) => !keys.includes(id))); },
      showColumns: async (keys) => {
        const next = [...visible];
        for (const k of keys) {
          const key = typeof k === 'string' ? k : k.key;
          if (next.includes(key)) continue;
          if (typeof k === 'string' || k.position < 0 || k.position >= next.length) next.push(key);
          else next.splice(k.position, 0, key);
        }
        setVisibleIds(next);
      },
      changeColumnsLabel: async (changes) => setLabels((x) => ({ ...x, ...Object.fromEntries(changes.map((c) => [c.key, c.newLabel])) })),
      getIgnoredFields: () => ignored ?? '',
      setIgnoredFields: (fields) => { setIgnored(fields); return self; },
      addMessage: async (m) => {
        const id = `table-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        messages?.add([{ id, type: MESSAGE_TYPE[m.type ?? 'Information'] ?? 'info', message: [m.message, m.description].filter(Boolean).join(' – '), source: 'client' }]);
        return id;
      },
      removeMessage: (id) => messages?.remove(id),
      getCurrentVariantKey: () => (tableVariantsOn ? tableVariants.currentId : null),
      setCurrentVariantKey: (key) => {
        if (!tableVariantsOn || (key !== STANDARD_VARIANT_ID && !tableVariants.variants.some((v) => v.id === key))) return;
        applyVariant(tableVariants.select(key).content);
      },
      getPresentationVariant: async () => tablePresentationVariant(pvState()),
      setPresentationVariant: async (pv) => {
        const current = pvState();
        const next = stateOfPresentationVariant(pv, current, { columns: allColumns.map((c) => c.id), properties: [...new Set([...p13nProps.map((x) => x.path), ...groupable.map((g) => g.path), ...allColumns.flatMap((c) => (fieldPath(c) ? [fieldPath(c)!] : []))])] });
        if (next.columns !== current.columns) setVisibleIds(next.columns);
        if (next.sort !== current.sort) setSort(next.sort);
        if (next.groupBy !== current.groupBy) setGroupBy(next.groupBy.length ? groupable.find((g) => g.path === next.groupBy[0])?.id ?? null : null);
        if (next.totals !== current.totals) setTotals(totalable.filter((c) => next.totals.includes(totalPath(c)!)).map((c) => c.id));
        if (isTree && next.initialExpansionLevel !== undefined && next.initialExpansionLevel !== current.initialExpansionLevel) tree.api.expandToLevel(next.initialExpansionLevel);
      },
      getSelectionVariant: async () => toSelectionVariant(controlFilters, ''),
      setSelectionVariant: async (sv, prefill) => { setControlFilters(fromSelectionVariant(sv, prefill)); },
    };
    return self;
  });
  const listRows = isTree ? tree.rows : loadedRows;

  // ------------------------------------------------------------------ totals and subtotals (docs/23)
  const totalsQuery = { service: p.service, source, filters, search: effectiveSearch, measures, revision: totalsRevision };
  const ownGrand = useGrandTotals({ ...totalsQuery, enabled: executed && !apply.active && !gridGrouped });
  const grand = gridGrouped ? groups.grand : !apply.active ? ownGrand : infinite ? apply.grand : apply.grandOf(list.first, list.error, list.isFetching);
  const subtotalsOn = Boolean(analytical && groupPath && (gridGrouped || canSubtotal(model, source, groupPath)));
  const groupValues = useMemo(() => {
    if (!subtotalsOn || !groupPath) return [];
    const seen = new Set<string>();
    const out: unknown[] = [];
    for (const r of listRows) {
      const v = getPath(r, groupPath);
      const k = v === null || v === undefined ? '' : String(v);
      if (!seen.has(k)) { seen.add(k); out.push(v ?? null); }
    }
    return out;
  }, [listRows, groupPath, subtotalsOn]);
  const subtotals = useSubtotals({ ...totalsQuery, groupBy: groupPath ?? '', groupValues, enabled: executed && subtotalsOn && !gridGrouped });
  const formatTotal = useTotalFormatter(p.service, source);
  const totalValue = (c: ColumnItem, entry: TotalsEntry | undefined, failed: boolean): ReactNode => {
    const path = totalPath(c);
    if (!path || !totalIds.includes(c.id)) return null;
    if (failed) return <span className="sk-total" data-sk-total={path}>–</span>;
    // several currencies (the service returned no unit): "Show Details" as FE (D39)
    if (entry?.values[path]?.some((a) => a.multiUnit)) {
      const sub = entry.group !== undefined && groupPath ? { groupBy: groupPath, groupValue: entry.group } : {};
      return <MultiUnitTotal query={{ service: p.service, source, filters, search: effectiveSearch, path, revision: totalsRevision, ...sub }} />;
    }
    return <TotalLines path={path} lines={formatTotal(path, entry?.values[path])} />;
  };
  const totalCells = (entry: TotalsEntry | undefined, failed: boolean) => Object.fromEntries(totalColumns.map((c) => [c.id, totalValue(c, entry, failed)]));
  const totalLabel = (error: string | undefined) => (
    <span className="sk-table__total-label" title={error ? t('table.totalsError', { message: error }) : undefined} data-sk-total-label data-error={error ? true : undefined}>{t('table.total')}</span>
  );
  /** Cell of the grid's pinned totals row. */
  const totalCell = (c: ColumnItem, i: number, data: Row | undefined): ReactNode => {
    const d = data?.[TOTAL_ROW] as { entry?: TotalsEntry; error?: string } | undefined;
    const value = totalValue(c, d?.entry, Boolean(d?.error));
    if (i !== 0) return value;
    return <>{totalLabel(d?.error)}{value ? <> {value}</> : null}</>;
  };
  const valueCtx = { model, typeName: info.typeName, locale: intlLocale, timeZone };
  // Grid group header rows: label and count in the first column (spanning to the first subtotal), subtotals below their columns.
  const groupColumn: ColumnItem | undefined = groupBy
    ? allColumns.find((c) => c.id === groupBy) ?? (groupPath ? { id: groupBy, label: groupable.find((c) => c.id === groupBy)?.label ?? groupPath, field: { id: groupBy, kind: 'field', path: groupPath, label: '', criticalityIcon: false, isSemanticKey: false } } : undefined)
    : undefined;
  const groupDisplay = (row: Row) => (groupColumn?.field ? fieldValue(valueCtx, groupColumn.field, row).display || groupValueOf(groupPath ?? '')(row) : '');
  groupDisplayRef.current = groupDisplay;
  const groupedRows = gridGrouped ? groups.rows.map((r) => (groupOf(r) ? r : overrides[keyOf(r)] ?? r)) : undefined;
  const groupSummaryOf = (g: GroupRowData) => {
    if (!subtotalsOn) return undefined;
    return { entry: groups.subtotal(g.key), failed: Boolean(groups.error) };
  };
  // FE (sap.ui.table, `$$aggregation.groupLevels`): a collapsed group shows its subtotals in its header, an expanded
  // group in a row at its bottom.
  const groupCell = (c: ColumnItem, i: number, g: GroupRowData): ReactNode => {
    const sum = g.expanded && !g.bottom ? undefined : groupSummaryOf(g);
    if (i === 0) {
      if (g.bottom) return <span className="sk-table__group-label sk-table__group-label--bottom" data-sk-group-bottom={g.display} />;
      const label = t('table.groupHeader', { label: groupColumn?.label ?? '', value: g.display || '–' }) + (g.count !== undefined ? t('table.groupCount', { count: g.count }) : '');
      return (
        <span className="sk-table__group-label" data-sk-group-row={g.display} data-sk-group-count={g.count} data-sk-group-expanded={g.expanded}>
          <ActionIcon variant="subtle" size="sm" aria-label={g.expanded ? t('table.collapseNode') : t('table.expandNode')} aria-expanded={g.expanded} onClick={() => latest.current.toggleGroup(g.key)} data-sk-group-toggle>
            {g.expanded ? <ChevronDown className="sk-icon" /> : <ChevronRight className="sk-icon" />}
          </ActionIcon>
          {label}
        </span>
      );
    }
    return sum && (sum.entry || sum.failed) ? totalValue(c, sum.entry, sum.failed) : null;
  };
  // Subtotals arrive after the rows: redraw the group rows (cells and heights).
  useEffect(() => {
    const api = apiRef.current;
    if (!gridGrouped || !api || api.isDestroyed()) return;
    api.refreshCells({ force: true });
    api.resetRowHeights();
  }, [gridGrouped, groups.rows]);
  /** Lines of the highest subtotal of a group (one per currency). */
  const groupLines = (g: GroupRowData) => {
    const e = groupSummaryOf(g)?.entry;
    return Math.max(1, ...measures.map((m) => e?.values[m]?.length ?? 1));
  };
  const ctx: TableContextValue = {
    entitySet: info.entitySet, typeName: info.typeName, source,
    rows: infinite ? gridRows : listRows, selected,
    count: infinite ? gridCount : gridGrouped ? groups.leafCount : list.count,
    filters, search: effectiveSearch, sort,
    refresh: () => { setOverrides({}); setTotalsRevision((n) => n + 1); if (infinite) setRefreshToken((n) => n + 1); else if (gridGrouped) setGroupsRevision((n) => n + 1); else list.refresh(); },
  };
  const onCountChange = p.onCountChange;
  useEffect(() => { onCountChange?.(ctx.count); }, [ctx.count, onCountChange]);
  const onRowsChange = p.onRowsChange;
  useEffect(() => { onRowsChange?.(ctx.rows); }, [ctx.rows, onRowsChange]);

  // ------------------------------------------------------------------ actions (ADR-024)
  const semanticKey = ui.semanticKey.length ? ui.semanticKey : type.keys;
  const targetOf = useCallback((row: Row) => ({ row, path: pathOf(row), label: semanticKey.map((k) => String(row[k] ?? '')).join(' / ') }), [pathOf, semanticKey]);
  const afterAction = (r: ActionResult) => {
    if (!r.processed.length) return;
    // UI.IsCopyAction: the copy is opened (FE Table getCopyAction, isNavigable).
    const copied = r.action.copy ? r.processed[0]?.row : undefined;
    if (copied && !parent && navigation?.hasObjectPage?.(info.entitySet, service.name)) {
      navigation.toObject(pathOf(copied), service.name);
      return;
    }
    if ((p.workingMode ?? 'worklist') === 'continuous') {
      const next: Record<string, Row> = {};
      const out: Message[] = [];
      for (const x of r.processed) {
        const merged = { ...x.target.row, ...(x.row ?? {}) };
        const k = keyOf(x.target.row);
        next[k] = merged;
        const fits = Object.entries(filters).every(([path, conds]) => path.startsWith('$') || matches(getPath(merged, path), conds, resolvePath(model.entityTypes, info.typeName, path).property?.edmType ?? 'Edm.String'));
        if (!fits) out.push({ id: `nm-${k}-${Date.now()}`, type: 'info', message: t('table.noLongerMatches', { item: x.target.label }), source: 'server' });
        apiRef.current?.getRowNode(k)?.setData(merged);
      }
      setOverrides((o) => ({ ...o, ...next }));
      messages?.add(out);
      setSelected((sel) => sel.map((row) => next[keyOf(row)] ?? row));
    } else {
      ctx.refresh();
      setSelected([]);
      apiRef.current?.deselectAll();
    }
  };
  const runner = useActionRunner({ service: p.service, onDone: afterAction });
  const actionItem = (a: ActionModel): ActionItem => ({
    id: a.id, label: a.label, requiresSelection: a.bound,
    // Core.OperationAvailable: bound actions per selected row; unbound actions by the constant or expression
    // itself (FE Table.ts _useEnabledExpression, UIFormatters getActionEnabledExpression: equal(value, true)).
    // The copy action (UI.IsCopyAction) needs exactly one row unless OperationAvailable says more (FE getCopyAction).
    enabled: (sel) => (a.bound && !leafEntities ? false : a.copy && !a.operationAvailable ? sel.length === 1 : a.bound ? sel.some((r) => isActionAvailable(a, r)) : isActionAvailable(a, undefined)),
    onPress: (c) => runner.run(a, a.bound ? c.selected.map(targetOf) : [{ row: {}, path: '', label: '' }]),
  });
  const actions = useMemo(() => {
    // FE Table getTableActions: the annotation actions of the LineItem (not inline, not determining; a
    // DataFieldForActionGroup is a menu at its position), then Create, the copy action, Delete. Custom actions and
    // menus without anchor go before Create (FE anchors them to StandardAction::Create).
    const base: ActionItem[] = [];
    const menus = new Map<string, ActionItem>();
    for (const a of modelActions.filter((x) => !x.inline && !x.determining && !x.copy)) {
      if (a.menu) {
        let m = menus.get(a.menu);
        if (!m) {
          m = { id: a.menu, label: ui.actionGroups?.find((g) => g.id === a.menu)?.label ?? '', onPress: () => undefined, menu: [] };
          menus.set(a.menu, m);
          base.push(m);
        }
        m.menu!.push(actionItem(a));
      } else base.push(actionItem(a));
    }
    base.push({ id: 'Create', label: t('actions.create'), onPress: () => setCreating(true), hidden: !canCreate });
    const copy = modelActions.find((x) => x.copy && !x.inline && !x.determining);
    if (copy) base.push({ ...actionItem(copy), label: copy.label || t('actions.copy') });
    base.push({
      id: 'Delete', label: t('actions.delete'), requiresSelection: true, hidden: !canDelete,
      enabled: (sel) => leafEntities && sel.some(isDeletable), onPress: (c) => setConfirmDelete(c.selected),
    });
    // FE StandardActions getStandardActionMassEdit: visible with `massEdit` on updatable lists (object page: in edit
    // mode), enabled with updatable rows selected
    base.push({ id: 'MassEdit', label: t('table.massEdit'), requiresSelection: true, hidden: !canMassEdit, enabled: (sel) => sel.some(massEditable), onPress: (c) => setMassEditRows(c.selected.filter(massEditable)) });
    // sap.fe.macros.table.ActionGroup: its actions become custom actions (FE TableDefinition addActionToExtraManifest)
    // unless they only name an existing toolbar action; the group is a menu of their keys (FE manifest `menu`)
    const isGroup = (a: $ActionSettings | $ActionGroupSettings): a is $ActionGroupSettings => Array.isArray((a as $ActionGroupSettings).actions);
    const existing = new Set(base.map((a) => a.id));
    const settings = (p.actions ?? []).flatMap((a) => (isGroup(a) ? a.actions.filter((m) => !existing.has(m.key) || m.onPress) : [a]));
    const custom: ExtendEntry<ActionItem>[] = settings.filter((a) => a.visible !== false).map((a) => ({
      id: a.key, position: a.placement === 'Before' || !a.anchor ? 'before' : 'after', anchor: a.anchor ?? 'Create',
      item: {
        id: a.key, label: a.text, requiresSelection: Boolean(a.requiresSelection || a.enableOnSelect), overflowGroup: a.overflowGroup, priority: a.priority, ai: a.isAIOperation,
        enabled: (sel) => a.enabled !== false && (a.enableOnSelect !== 'single' || sel.length === 1),
        onPress: (c) => a.onPress?.({ selectedContexts: c.selected.map((r) => contextOf(pathOf(r), r)) }),
      },
    }));
    let out = applyExtensions<ActionItem>(applyExtensions<ActionItem>(base, custom, 'Table actions'), (p.extend ?? []).filter((e) => e.kind === 'action') as ExtendEntry<ActionItem>[], 'Table extend');
    // Menus (`actions` groups, `actionGroups`): their actions leave the toolbar in the order of the menu (FE
    // mapMenuItems); a menu without items is removed; `defaultAction` makes a split button (FE mapMenuDefaultAction:
    // a visible action of the toolbar or of a menu). Menus without anchor stand before Create.
    const groups = [
      ...(p.actions ?? []).filter(isGroup).map((g) => ({
        id: g.key, label: g.text, keys: g.actions.map((m) => m.key), defaultAction: g.defaultAction, anchor: g.anchor, placement: g.placement,
        overflowGroup: g.overflowGroup, priority: g.priority, byGroup: false,
      })),
      ...(p.actionGroups ?? []).map((g) => ({ id: g.id, label: g.label, keys: g.actions, defaultAction: g.defaultAction, anchor: undefined, placement: undefined, overflowGroup: undefined, priority: undefined, byGroup: true })),
    ];
    const all = out;
    for (const g of groups) {
      const items = out.filter((a) => !a.menu && (g.keys.includes(a.id) || (g.byGroup && a.group === g.id)))
        .sort((a, b) => (g.keys.includes(a.id) ? g.keys.indexOf(a.id) : g.keys.length) - (g.keys.includes(b.id) ? g.keys.indexOf(b.id) : g.keys.length));
      if (!items.length) continue;
      out = out.filter((a) => !items.includes(a));
      const def = g.defaultAction ? [...all, ...items].find((a) => a.id === g.defaultAction && !a.hidden) : undefined;
      const menu: ActionItem = {
        id: g.id, label: g.label, menu: items, overflowGroup: g.overflowGroup, priority: g.priority,
        ai: items.every((m) => m.ai) || undefined, split: Boolean(def), onPress: def ? (c) => def.onPress(c) : () => undefined,
      };
      const at = g.anchor ? out.findIndex((a) => a.id === g.anchor) : -1;
      if (at >= 0) out.splice(g.placement === 'Before' ? at : at + 1, 0, menu);
      else out.splice(Math.max(0, out.findIndex((a) => a.id === 'Create')), 0, menu);
    }
    // `actionOverflowGroups`: a separator before the first action of a group with showSeparator (FE Action addSeparators)
    const started = new Set<number>();
    return out.map((a, i) => {
      if (a.overflowGroup === undefined || started.has(a.overflowGroup)) return a;
      started.add(a.overflowGroup);
      return i > 0 && (p.actionOverflowGroups ?? []).some((g) => g.overflowGroup === a.overflowGroup && g.showSeparator) ? { ...a, separator: true } : a;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runner is stable enough; rebuilt with its inputs
  }, [p.extend, p.actions, p.actionGroups, p.actionOverflowGroups, modelActions, canCreate, canDelete, canMassEdit, t, targetOf, leafEntities]);
  /** Row highlight (FE TableFormatter rowHighlighting): 1 Error, 2 Warning, 3 Success, 5 Information; a new draft is Information. */
  const rowState = (row: Row): string | undefined => {
    // A constant (EnumMember) reaches FE's formatter as the enum name, which is no valid highlight: FE logs an error and
    // shows none, not even the draft highlight (FE Table Dt → TableFormatter rowHighlighting; FE comparison cols5-negative).
    if (highlightRef && !('path' in highlightRef)) return undefined;
    const v = highlightRef ? Number(getPath(row, highlightRef.path)) : undefined;
    // a path value: 1, 2, 3, 5; others none
    const state = ({ 1: 'error', 2: 'warning', 3: 'success', 5: 'information' } as Record<number, string>)[v ?? 0];
    if (state) return state;
    return draftRoot && row.IsActiveEntity === false && row.HasActiveEntity === false ? 'information' : undefined;
  };
  cellEnvRef.current = {
    typeName: info.typeName, service: p.service,
    run: (a, row) => runner.run(a, [targetOf(row)]),
    navigate: (row, nav) => {
      const target = model.entityTypes[info.typeName]?.navigations[nav];
      const set = model.entitySets[info.entitySet]?.navigationBindings[nav];
      const keys = target ? model.entityTypes[target.targetType]?.keys ?? [] : [];
      const related = (row[nav] as Row | undefined) ?? Object.fromEntries((target?.referentialConstraints ?? []).map((r) => [r.referencedProperty, row[r.property]]));
      if (set && target && keys.every((k) => related[k] !== undefined)) navigation?.toObject(`${set}${keyPredicate(model.entityTypes[target.targetType]!, related)}`, service.name);
    },
  };

  // ------------------------------------------------------------------ copy (LR-21)
  const [copied, setCopied] = useState<string | null>(null);
  const copyNow = () => {
    const cols = visibleColumns.filter((c) => c.field);
    const lines = [cols.map((c) => c.label).join('\t'), ...selected.map((r) => cols.map((c) => fieldValue(valueCtx, c.field!, r).display.replace(/[\t\n]/g, ' ')).join('\t'))];
    void navigator.clipboard?.writeText(lines.join('\n')).then(() => {
      setCopied(t('actions.copied', { count: selected.length }));
      setTimeout(() => setCopied(null), 4000);
    });
  };

  // ------------------------------------------------------------------ create and delete
  const strategy = useEditStrategy(info.entitySet, p.service);
  // creationMode "NewPage" on a draft list (FE _getCreationBehaviour, EditFlow createDocument): Create makes a new draft
  // and opens it on the object page. Lists without draft create with the dialog (smart-kit, D42).
  const newPage = !parent && creationName === 'NewPage' && strategy.kind === 'draft' && Boolean(navigation?.hasObjectPage?.(info.entitySet, service.name));
  // FE createWithDialog "WithNavigation": non-computed keys and immutable properties are asked in "New Object" first.
  const newObjectFields = useMemo(() => (newPage ? createPopupFields(model, info.typeName) : []), [newPage, model, info.typeName]);
  const [askNewObject, setAskNewObject] = useState(false);
  const createDraft = (values: Row) => strategy.create(source, values).then((s) => { setAskNewObject(false); navigation!.toObject(s.path, service.name); });
  useEffect(() => {
    if (!creating || !newPage) return;
    setCreating(false);
    if (newObjectFields.length) setAskNewObject(true);
    else createDraft({}).catch((e: unknown) => messages?.add(messagesFromError(e)));
  }, [creating, newPage]); // eslint-disable-line react-hooks/exhaustive-deps
  const onCreated = (path: string, row: Row, ms: Message[]) => {
    messages?.add([...ms, { id: `created-${Date.now()}`, type: 'success', message: typedText(t, 'create.done', ui.headerInfo.typeName), source: 'server' }]);
    setCreating(false);
    ctx.refresh();
    if (p.onCreated) p.onCreated(path, row);
    else if (!parent && navigation?.hasObjectPage?.(info.entitySet, service.name)) navigation.toObject(path, service.name);
  };
  // creationMode creationFields (FE CreationDialog): the listed properties, by their line item field when there is one
  const dialogFields = p.creationMode?.creationFields
    ? p.creationMode.creationFields.split(',').map((x) => x.trim()).filter((x) => type.properties[x]).map((x): FieldModel => lineItem.find((f) => f.kind === 'field' && f.path === x) ?? { id: `DataField::${x}`, kind: 'field', path: x, label: type.properties[x]!.label, criticalityIcon: true, isSemanticKey: false })
    : createFields(model, info.typeName, lineItem);
  const createChild = async (values: Row) => {
    const r = await service.dataProvider.create!(source, values);
    onCreated(r.path, r.row, r.messages ?? []);
  };
  const createRoot = async (values: Row) => {
    const r = await createWith(strategy, source, values);
    onCreated(r.path, r.row, r.messages);
  };
  /**
   * Texts of the delete confirmation (FE EditFlow deleteDocument / DeleteHelper): one row by UI.HeaderInfo Title and
   * Description, several rows generic; rows that DeleteRestrictions/Deletable excludes are counted.
   */
  const deleteTexts = (rows: Row[]): string[] => {
    const ok = rows.filter(isDeletable);
    const out: string[] = [];
    // FE DeleteHelper: "1 out of n … has" / "k out of n … have"; "the remaining object" / "objects" by the deletable count
    const restricted = rows.length - ok.length;
    if (restricted) out.push(restricted === 1 ? t('delete.oneRestricted', { total: rows.length }) : t('delete.someRestricted', { count: restricted, total: rows.length }), t(ok.length === 1 ? 'delete.remainingOne' : 'delete.remaining'));
    else if (rows.length === 1) {
      const text = (path: string | undefined) => { const v = path ? getPath(rows[0], path) : undefined; return v === undefined || v === null || v === '' ? undefined : String(v); };
      const title = text(ui.headerInfo.title);
      const description = ui.headerInfo.description !== ui.headerInfo.title ? text(ui.headerInfo.description) : undefined;
      out.push(title && description ? t('delete.confirmObjectInfo', { title, description }) : title ? t('delete.confirmObjectTitle', { title }) : t('delete.confirmSingular'));
    } else out.push(t('delete.confirmPlural'));
    return out;
  };
  const deleteNow = async (rows: Row[]) => {
    setConfirmDelete(null);
    const out: Message[] = [];
    let done = 0;
    // FE DeleteHelper: the selected objects are deleted in one change set (all or none) when the service has $batch;
    // without it, one request each
    const results = await writeAll(service.dataProvider, rows.map((row) => ({ kind: 'remove' as const, path: pathOf(row), etag: row['@odata.etag'] as string | undefined })), { atomic: true });
    for (const r of results) {
      if (r.ok) {
        out.push(...(r.messages ?? []));
        done++;
      } else if (!(r.error instanceof RolledBackError)) out.push({ id: `del-${Date.now()}-${out.length}`, type: 'error', message: (r.error as Error).message, source: 'server' });
    }
    if (done) out.unshift({ id: `deleted-${Date.now()}`, type: 'success', message: done === 1 ? typedText(t, 'delete.done', ui.headerInfo.typeName) : t('delete.doneMany', { count: done }), source: 'server' });
    messages?.add(out);
    setSelected([]);
    apiRef.current?.deselectAll();
    ctx.refresh();
  };
  // Ctrl+Enter creates a new row in sub-tables (OP Create and edit subobjects).
  const sectionRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = sectionRef.current;
    if (!el || !canCreate) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && !(e.target as HTMLElement).closest('[data-sk-inline-create]')) { e.preventDefault(); setCreating(true); } };
    el.addEventListener('keydown', onKey);
    return () => el.removeEventListener('keydown', onKey);
  }, [canCreate, createMode]);
  // Paste (FE TableAPI onPaste, PasteHelper pasteData): Ctrl+V on an editable table that creates inline adds the
  // pasted lines as new rows. Default: on in sub-tables (FE: the object page), off elsewhere.
  const pasteOn = (p.enablePaste ?? Boolean(parent)) && canCreate && createMode === 'inline' && Boolean(parent) && !isTree;
  const latestPaste = useRef({ visibleColumns, type });
  latestPaste.current = { visibleColumns, type };
  useEffect(() => {
    const el = sectionRef.current;
    if (!el || !pasteOn) return;
    const onPaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest('input, textarea, [contenteditable="true"], [data-sk-inline-create]')) return;
      const text = e.clipboardData?.getData('text/plain');
      if (!text) return;
      e.preventDefault();
      const { visibleColumns: cols, type: t0 } = latestPaste.current;
      const targets = pasteTargets(t0, cols.map((c) => c.field), Boolean(p.enablePastingOfComputedProperties));
      const { rows, errors } = pastedRows(t0, targets, parseClipboard(text));
      if (errors.length) {
        messages?.add(errors.map((x, i) => ({ id: `paste-${Date.now()}-${i}`, type: 'error' as const, message: t('table.pasteError', { row: x.row, message: x.message }), source: 'client' as const })));
        return;
      }
      void (async () => {
        const out: Message[] = [];
        let done = 0;
        for (const values of rows) {
          try { const r = await service.dataProvider.create!(source, values); out.push(...(r.messages ?? [])); done++; } catch (err) { out.push(...messagesFromError(err)); }
        }
        if (done) out.unshift({ id: `pasted-${Date.now()}`, type: 'success', message: t('table.pasteDone', { count: done }), source: 'client' });
        messages?.add(out);
        ctx.refresh();
      })();
    };
    el.addEventListener('paste', onPaste);
    return () => el.removeEventListener('paste', onPaste);
  }); // re-attached with the latest handlers
  // Sticky column headers below the sticky toolbar (LR Sticky Behavior, responsive table).
  useEffect(() => {
    const el = sectionRef.current;
    const bar = el?.querySelector<HTMLElement>(':scope > .sk-table__toolbar');
    if (!el || !bar || !responsive || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => el.style.setProperty('--sk-table-toolbar-height', `${bar.offsetHeight}px`));
    ro.observe(bar);
    return () => ro.disconnect();
  }, [responsive]);
  // Draft indicator (FE DraftIndicator): the details are read when the popover opens, as the SAPUI5 model reads the
  // popover's properties late.
  const loadDraftAdmin = useCallback((row: Row) => service.dataProvider.read(pathOf(row), { select: [], expand: [{ navigation: 'DraftAdministrativeData', select: [], expand: [] }] }), [service, pathOf]);
  const marker = draftRoot ? (row: Row) => <DraftIndicator row={row} compact load={() => loadDraftAdmin(row)} /> : undefined;
  // Grid tables of a list show the indicator in a separate "Editing Status" column after the first visible column
  // (FE Columns.ts draftStatus, MdcTableTemplate getComputedColumn: header hidden, 3em, icon only), when a
  // semantic key column would carry it; responsive tables keep it in the first column.
  const statusColumn = draftList && !responsive && visibleColumns.some((c) => c.field?.kind === 'field' && Boolean(c.field.path) && ui.semanticKey.includes(c.field.path!));
  const statusMarker = statusColumn ? (row: Row) => <DraftIndicator row={row} iconOnly load={() => loadDraftAdmin(row)} /> : undefined;
  const cellMarker = statusColumn ? undefined : marker;
  const latest = useRef({ ctx, p, navigate, sort, totalCell, groupCell, groupLines, tree, toggleGroup: groups.toggle });
  latest.current = { ctx, p, navigate, sort, totalCell, groupCell, groupLines, tree, toggleGroup: groups.toggle };

  // Frozen columns (grid tables); default the first.
  const frozen = p.disableColumnFreeze ? 0 : p.frozenColumnCount ?? 1;
  /** Width of a column: by its content type (`enableAutoColumnWidth`), at least its header (`widthIncludingColumnHeader`). */
  const autoWidth = (c: ColumnItem, edmType: string | undefined) => {
    const base = p.enableAutoColumnWidth === false ? 200 : defaultWidth(c.field, edmType);
    return c.widthIncludingColumnHeader ?? p.widthIncludingColumnHeader ? Math.max(base, c.label.length * 8 + 48) : base;
  };
  const colDefs = useMemo<ColDef[]>(() => {
    const defs: ColDef[] = visibleColumns.map((c, i) => {
      const prop = c.field?.path ? model.entityTypes[info.typeName] && type.properties[c.field.path] : undefined;
      const sortPath = c.field?.kind === 'field' ? c.field.path : undefined;
      const s = sort.find((x) => x.path === sortPath);
      return {
        colId: c.id,
        headerName: c.required ? `${c.label} *` : c.label,
        ...(c.headerHidden ? { headerClass: 'sk-table__header--hidden', headerTooltip: c.label } : c.tooltip ? { headerTooltip: c.tooltip } : {}),
        ...(c.aiNotice ? { headerComponentParams: { innerHeaderComponent: AINoticeHeader, innerHeaderComponentParams: { aiNotice: c.aiNotice } } } : {}),
        width: c.width ?? autoWidth(c, prop?.edmType),
        minWidth: 80,
        // Not pinned while grouped: a column span cannot cross from the pinned into the scrolled columns.
        pinned: i < frozen && mode === 'grid' && !gridGrouped ? 'left' : undefined,
        colSpan: i === 0 && gridGrouped ? (params: { data?: Row }) => {
          if (!groupOf(params.data)) return 1;
          const next = visibleColumns.findIndex((x, j) => j > 0 && totalIds.includes(x.id) && totalPath(x));
          return next > 0 ? next : visibleColumns.length;
        } : undefined,
        sortable: Boolean(sortPath && isSortable(caps, sortPath)),
        sort: s ? (s.descending ? 'desc' : 'asc') : null,
        sortIndex: s && sort.length > 1 ? sort.indexOf(s) : null,
        resizable: true,
        type: (c.align ? c.align === 'End' : prop && /Int|Decimal|Double|Single|Byte/.test(prop.edmType) && c.field?.kind === 'field') ? 'rightAligned' : undefined,
        cellRenderer: (params: { data?: Row; node?: { rowPinned?: string | null } }) => {
          if (params.node?.rowPinned) return latest.current.totalCell(c, i, params.data);
          const g = groupOf(params.data);
          if (g) return latest.current.groupCell(c, i, g);
          const row = params.data;
          if (!row) return null;
          const content = (
            <span className={i === 0 && cellMarker ? 'sk-cell--with-marker' : undefined}>
              {c.render ? c.render(row) : <Field typeName={info.typeName} service={p.service} metaPath={c.field!} row={row} formatOptions={c.formatOptions} cell />}
              {i === 0 && cellMarker ? cellMarker(row) : null}
              {i === 0 && overridesRef.current[keyOf(row)] ? <span className="sk-table__changed" data-sk-changed-marker>{t('table.changedItem')}</span> : null}
            </span>
          );
          const tr = latest.current.tree;
          return i === 0 && isTree ? <TreeCell node={tr.nodeOf(row)} onToggle={() => latest.current.tree.toggle(row)}>{content}</TreeCell> : content;
        },
        context: { sortPath },
      } satisfies ColDef;
    });
    if (statusMarker) {
      defs.splice(1, 0, {
        colId: 'draftStatus', headerName: t('draft.editingStatus'), headerTooltip: t('draft.editingStatus'), headerClass: 'sk-table__header--hidden',
        width: 48, minWidth: 48, sortable: false, resizable: false, suppressMovable: true,
        cellRenderer: (params: { data?: Row; node?: { rowPinned?: string | null } }) => (params.data && !params.node?.rowPinned && !groupOf(params.data) ? statusMarker(params.data) : null),
      });
    }
    if (navigable) {
      defs.push({
        colId: '$nav', headerName: '', width: 52, pinned: 'right', sortable: false, resizable: false, suppressMovable: true,
        headerComponentParams: { 'aria-label': t('table.navigate') },
        cellRenderer: (params: { data?: Row; node?: { rowPinned?: string | null } }) => (params.data && !params.node?.rowPinned && !groupOf(params.data) ? (
          <ActionIcon className="sk-table__nav" aria-label={t('table.navigate')} onClick={() => latest.current.navigate(params.data!)} data-sk-row-nav>
            <ChevronRight className="sk-icon" />
          </ActionIcon>
        ) : null),
      });
    }
    return defs;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- column definitions depend on visible columns, sort indicator and navigability only
  }, [visible.join('|'), allColumns, navigable, JSON.stringify(sort), intlLocale, timeZone, mode, Boolean(cellMarker), Boolean(statusMarker), gridGrouped, totalIds.join('|'), isTree, frozen, p.enableAutoColumnWidth, p.widthIncludingColumnHeader]);
  const overridesRef = useRef(overrides);
  overridesRef.current = overrides;
  // Tree grids: a node collapsed on the client keeps its row data; redraw the first column's toggles.
  useEffect(() => {
    const api = apiRef.current;
    if (isTree && api && !api.isDestroyed() && visibleColumns[0]) api.refreshCells({ columns: [visibleColumns[0].id], force: true });
  }, [isTree, listRows]); // eslint-disable-line react-hooks/exhaustive-deps

  // Rows loaded through useListQuery (analytical table without grid blocks): their late properties once rendered.
  useEffect(() => {
    if (!apply.active || infinite) return;
    const timer = setTimeout(() => apply.loadLate(apiRef.current, pathOf, replaceRow), 0);
    return () => clearTimeout(timer);
  }, [apply.active, infinite, list.rows]); // eslint-disable-line react-hooks/exhaustive-deps
  /** A row of the grid got its late properties (analytical table): keep `gridRows` in step. */
  const replaceRow = (old: Row, row: Row) => {
    setGridRows((prev) => prev.map((r) => (r === old ? row : r)));
    setSelected((prev) => (prev.includes(old) ? prev.map((r) => (r === old ? row : r)) : prev));
  };
  // Grid datasource: one block per request, first block with $count.
  const datasource = useMemo<IDatasource | null>(() => {
    if (!infinite || !executed) return null;
    return {
      getRows: async (params) => {
        const top = params.endRow - params.startRow;
        const req = apply.blockRequest(params.startRow, top) ?? list.pageRequest(params.startRow, top, params.startRow === 0);
        try {
          const fetched = await queryClient.fetchQuery({
            queryKey: ['smart-kit', 'grid', service.name, JSON.stringify(req), refreshToken],
            queryFn: ({ signal }) => service.dataProvider.query(req, { signal }),
            staleTime: 10_000,
          });
          const res = apply.active ? { ...fetched, rows: apply.withLate(fetched.rows) } : fetched;
          const last = res.count ?? (res.rows.length < top ? params.startRow + res.rows.length : undefined);
          params.successCallback(res.rows, last);
          apply.received(params.startRow, res);
          setTimeout(() => apply.loadLate(apiRef.current, pathOf, replaceRow), 0);
          if (params.startRow === 0) {
            setGridCount(res.count);
            setGridEmpty(res.rows.length === 0);
            setGridError(null);
          }
          setGridRows((prev) => (params.startRow === 0 ? res.rows : [...prev, ...res.rows]));
          const r = restore.current;
          if (r && apiRef.current) {
            const api = apiRef.current;
            api.forEachNode((n) => { if (n.data && r.selectedKeys.includes(keyOf(n.data as Row))) n.setSelected(true); });
            const target = last === undefined ? r.firstRow : Math.min(r.firstRow, last - 1);
            if (target > 0) {
              // Scroll there (this loads the block holding the row); once that block is in, scroll again precisely.
              setTimeout(() => api.ensureIndexVisible(target, 'top'), 0);
              if (params.startRow <= target && target < params.endRow) restore.current = { ...r, firstRow: 0 };
            } else if (params.startRow === 0) restore.current = r.selectedKeys.length ? { ...r, firstRow: 0 } : undefined;
          }
        } catch (e) {
          if (!isAbortError(e)) {
            setGridError(e as Error);
            apply.failed(params.startRow, e as Error);
            params.failCallback();
          }
        }
      },
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- rebuild when the request changes
  }, [infinite, executed, JSON.stringify(list.request), apply.key, refreshToken]);

  useEffect(() => {
    const api = apiRef.current;
    if (!api || !infinite) return;
    if (datasource) api.setGridOption('datasource', datasource);
    else { setGridRows([]); setGridCount(undefined); setGridEmpty(false); }
  }, [datasource, infinite]);

  // Grid totals: a pinned row at the bottom, as high as the most currencies of one total (docs/23).
  // Only once rows are there: no totals row under the loading placeholder or the "no data" text.
  const gridEmptyNow = infinite ? gridEmpty || gridRows.length === 0 : gridGrouped ? groups.rows.length === 0 : list.rows.length === 0;
  const pinnedBottom = useMemo(
    () => (!responsive && executed && measures.length && !gridEmptyNow ? [{ [TOTAL_ROW]: { entry: grand.entry, error: grand.error?.message } }] : undefined),
    [responsive, executed, measures.join('|'), gridEmptyNow, grand.entry, grand.error], // eslint-disable-line react-hooks/exhaustive-deps
  );
  useEffect(() => {
    if (!pinnedBottom) return;
    const lines = Math.max(1, ...measures.map((m) => grand.entry?.values[m]?.length ?? 1));
    const timer = setTimeout(() => {
      const api = apiRef.current;
      const node = api && !api.isDestroyed() ? api.getPinnedBottomRow(0) : undefined;
      const el = sectionRef.current;
      if (!api || !node || !el) return;
      const style = getComputedStyle(el);
      const base = parseFloat(style.getPropertyValue('--sk-row-height')) || node.rowHeight || 0;
      const line = parseFloat(style.getPropertyValue('--sk-total-line-height')) || 0;
      node.setRowHeight(base + (lines - 1) * line);
      api.onRowHeightChanged();
    }, 0);
    return () => clearTimeout(timer);
  }, [pinnedBottom]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveView = () => {
    const api = apiRef.current;
    if (!stateKey || !api || api.isDestroyed()) return;
    stored.write({ selectedKeys: ((api.getSelectedRows() ?? []) as Row[]).map(keyOf), firstRow: mode === 'grid' ? topRowIndex(api) : 0 });
  };
  useEffect(() => () => saveView(), []); // eslint-disable-line react-hooks/exhaustive-deps -- store on unmount

  const [p13n, setP13n] = useState(false);
  // `personalization`: a list of "Column", "Sort", "Group", "Aggregate" limits grouping and totals; "true" or unset allows all.
  const p13nAllows = (part: string) => !p.personalization || p.personalization === 'true' || p.personalization.split(',').map((x) => x.trim()).includes(part);
  const [exporting, setExporting] = useState(false);
  const exportNow = async () => {
    setExporting(true);
    const exportTitle = p.exportFileName ?? p.header ?? ui.headerInfo.typeNamePlural;
    const event = (r: { count: number; truncated: boolean }): Table$BeforeExportEvent => ({
      entitySet: info.entitySet, title: exportTitle, filters, search: effectiveSearch, sort,
      columns: visibleColumns.filter((c) => !c.disableExport).map((c) => c.id), rowCount: r.count, truncated: r.truncated, request: { ...list.request, skip: undefined, top: undefined },
    });
    try {
      const r = await exportRows({
        service, typeName: info.typeName, columns: visibleColumns.filter((c) => !c.disableExport), title: exportTitle, sheetName: p.exportSheetName,
        pageRequest: list.pageRequest, limit: p.exportRequestSize ?? 10_000, locale: intlLocale, timeZone, t,
        before: p.onBeforeExport ? async (x) => (await p.onBeforeExport!(event(x))) !== false : undefined,
      });
      if (!r.cancelled) p.onExported?.(event(r));
    } catch (e) {
      messages?.add([{ id: `export-${Date.now()}`, type: 'error', message: (e as Error).message, source: 'client' }]);
    } finally {
      setExporting(false);
    }
  };

  const title = p.header ?? ui.headerInfo.typeNamePlural;
  // FE Table converter: an AnalyticalTable is searchable only when ApplySupported/Transformations contains search
  const searchable = caps.searchable && !(analytical && !caps.aggregation!.transformations.includes('search'));
  const [hiddenCols, setHiddenCols] = useState<string[]>([]);
  const [fullScreen, setFullScreen] = useState(false);
  const [width, setWidth] = useState(1440);
  useEffect(() => {
    const el = sectionRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth || 1440));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // `rowCount` (sap.ui.table.rowmodes): "Fixed" / "Interactive" exactly that many rows, "Auto" at least that many
  const rowsHeight = p.rowCount ? `calc(var(--sk-header-row-height) + ${p.rowCount} * var(--sk-row-height) + 2px)` : undefined;
  const rowsStyle = !rowsHeight || responsive ? undefined : fixedRows ? { flex: 'none', height: rowsHeight, minHeight: 0 } : mode === 'grid' ? { minHeight: rowsHeight } : undefined;
  const inlineCreate = <InlineCreateRow service={p.service} typeName={info.typeName} fields={createFields(model, info.typeName, lineItem)} onCreate={createChild} onCancel={() => setCreating(false)} />;
  // FE QuickFilter showCounts: `$count` per quick filter, its conditions first
  const quickCounts = useQuickCounts({
    service: p.service, enabled: Boolean(p.quickVariantSelection?.showCounts) && executed && caps.countable, variants: quickVariants, revision: totalsRevision,
    request: (v) => ({ source, select: [], expand: [], orderBy: [], filters: withHiddenFilters(p.query?.filters ?? {}, conditionsAsFilters(v.conditions)), search: effectiveSearch && caps.searchable ? effectiveSearch : undefined, count: false, hiddenFiltersFirst: true }),
  });
  const internal: InternalCtx = {
    p, ctx, title, allColumns, visibleIds: visible, setVisibleIds, setSort, actions, openP13n: () => setP13n(true),
    exportNow: () => void exportNow(), exporting, search, setSearch, searchable,
    copyNow, canCopy: !p.disableCopyToClipboard, copied, width,
    details: { available: responsive && hiddenCols.length > 0, shown: Boolean(own.details), toggle: () => setOwn((x) => ({ ...x, details: !x.details })) },
    fullScreen: { on: fullScreen, toggle: () => setFullScreen((x) => !x) },
    variant: tableVariantsOn ? <span className="sk-table__variant" data-sk-table-variant><VariantManagement variants={tableVariants} content={variantContent} onSelect={(e) => applyVariant(e.content)} headerLevel="H4" supportApplyAutomatically={false} /></span> : undefined,
    quick: quickVariants.length > 1 ? <QuickVariantSwitch variants={quickVariants} value={activeQuick?.key} counts={quickCounts} onChange={setQuickKey} /> : undefined,
    filterInfo: Object.keys(controlFilters).length ? { labels: Object.keys(controlFilters).map(labelOfPath), clear: () => setControlFilters({}) } : undefined,
  };

  const error = infinite ? gridError : gridGrouped ? groups.error : list.error;
  const empty = infinite ? gridEmpty : gridGrouped ? executed && !groups.isLoading && groups.rows.length === 0 && !groups.error : executed && !list.isLoading && list.rows.length === 0 && !list.error;
  const threshold = p.showAllThreshold ?? 200;
  const preview = mode === 'auto' && list.count !== undefined && list.count > threshold;
  const scrollGrowing = mode === 'auto' && Boolean(p.growingScrollToLoad) && !preview;
  const growRef = useRef<HTMLDivElement>(null);
  const latestList = useRef(list);
  latestList.current = list;
  useEffect(() => {
    const el = growRef.current;
    if (!el || !scrollGrowing || typeof IntersectionObserver === 'undefined') return;
    const obs = new IntersectionObserver(([e]) => {
      const l = latestList.current;
      if (e!.isIntersecting && l.hasMore && !l.isFetching) { l.loadMore(); setOwn((s) => ({ ...s, loaded: l.rows.length + growSize })); }
    }, { rootMargin: '0px 0px 120px 0px' });
    obs.observe(el);
    return () => obs.disconnect();
  }, [scrollGrowing, list.rows.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const noDataText = !executed ? t('table.noData.start') : parent ? t('table.noData.empty') : t('table.noData.notFound');
  const noDataMode = p.modeForNoDataMessage ?? 'text';
  const illustrationSize = ({ Dot: 'ExtraSmall', Spot: 'Small', Scene: 'Large' } as Record<string, IllustratedMessageSize>)[noDataMode.slice(19)] ?? (noDataMode.slice(19) as IllustratedMessageSize);
  const noDataContent = p.noData ?? (noDataMode === 'text'
    ? <Text c="dimmed">{noDataText}</Text>
    : <IllustratedMessage illustrationType={!executed ? 'BeforeSearch' : Object.keys(filters).length || effectiveSearch ? 'NoFilterResults' : 'NoData'} illustrationSize={illustrationSize} description={noDataText} />);

  const onSortChanged = (e: SortChangedEvent) => {
    const next = e.api.getColumnState().filter((s) => s.sort).sort((a, b) => (a.sortIndex ?? 0) - (b.sortIndex ?? 0))
      .map((s) => ({ path: (e.api.getColumn(s.colId)?.getColDef().context as { sortPath?: string } | undefined)?.sortPath ?? s.colId, descending: s.sort === 'desc' }));
    if (JSON.stringify(next) !== JSON.stringify(latest.current.sort)) setSort(next);
  };

  const responsiveColumns: MColumn[] = visibleColumns.map((c) => {
    const prop = c.field?.path ? type.properties[c.field.path] : undefined;
    const end = c.align ? c.align === 'End' : Boolean(prop && /Int|Decimal|Double|Single|Byte/.test(prop.edmType) && c.field?.kind === 'field');
    return {
      id: c.id,
      header: c.aiNotice ? <span className="sk-table__header-ai">{c.label}<ColumnAINotice notice={c.aiNotice} label={c.label} /></span> : c.label,
      importance: (c.importance ?? c.field?.importance ?? (c.field?.isSemanticKey ? 'High' : 'Medium')) as Priority,
      hAlign: end ? 'End' : c.align === 'Center' ? 'Center' : undefined,
      cell: (row: Row) => (c.render ? c.render(row) : c.field ? <Field typeName={info.typeName} service={p.service} metaPath={c.field} row={row} formatOptions={c.formatOptions} cell={c.microChartSize !== undefined || c.showMicroChartLabel !== undefined ? { microChartSize: c.microChartSize, showMicroChartLabel: c.showMicroChartLabel } : true} /> : null),
      ...mergeOf(c, (path) => resolvePath(model.entityTypes, info.typeName, path).property?.semanticObject),
      groupValue: c.field ? (row: Row) => fieldValue(valueCtx, c.field!, row).display || groupValueOf(c.field!.path ?? '')(row) : undefined,
    };
  });
  // grouped by a property that is not shown: an invisible column carries the group header
  if (groupColumn && !visibleColumns.some((c) => c.id === groupColumn.id)) {
    responsiveColumns.push({ id: groupColumn.id, header: groupColumn.label, visible: false, cell: () => null, groupValue: groupDisplay });
  }
  const selectedKeys = useMemo(() => selected.map(keyOf), [selected, keyOf]);
  // every text AG Grid reads to screen readers for what this table uses (the rest of its locale keys belong to
  // features that are off)
  const gridLocaleText = useMemo(() => ({
    loadingOoo: t('table.loading'), noRowsToShow: noDataText, ariaRowSelect: t('table.selectRow'), ariaChecked: t('common.yes'), ariaUnchecked: t('common.no'),
    ariaIndeterminate: t('table.aria.indeterminate'), ariaRowDeselect: t('table.aria.deselectRow'), ariaRowToggleSelection: t('table.aria.toggleRow'),
    ariaRowSelectAll: t('table.aria.toggleAll'), ariaRowSelectionDisabled: t('table.aria.selectionDisabled'), ariaHeaderSelection: t('table.aria.headerSelection'),
    ariaSortableColumn: t('table.aria.sortable'), ariaColumn: t('table.aria.column'),
  }), [t, noDataText]);
  const responsiveTable = responsive ? (
    <MTable
      aria-label={title}
      columns={responsiveColumns}
      items={listRows}
      keyOf={keyOf}
      mode={selection === 'None' ? 'None' : selection === 'Single' ? 'SingleSelectLeft' : 'MultiSelect'}
      multiSelectMode={p.enableSelectAll === false ? 'ClearAll' : 'Default'}
      selectedKeys={selectedKeys}
      onSelectionChange={(e) => {
        const keys = new Set(selection === 'Single' ? [] : selectedKeys);
        for (const r of e.listItems) { if (e.selected) keys.add(keyOf(r)); else keys.delete(keyOf(r)); }
        const rows = listRows.filter((r) => keys.has(keyOf(r)) && selectable(r)).slice(0, limit || undefined);
        setSelected(rows);
        p.onSelectionChange?.({ selectedContexts: rows.map((r) => contextOf(pathOf(r), r)) });
      }}
      navigable={navigable}
      onItemPress={(e) => navigate(e.listItem)}
      growing
      growingScrollToLoad
      hasMore={list.hasMore}
      busy={list.isFetching}
      onUpdateStarted={() => list.loadMore()}
      autoPopinMode
      fixedLayout={false}
      sticky={['ColumnHeaders']}
      hiddenInPopin={own.details ? [] : ['None', 'Low', 'Medium', 'High']}
      onPopinChanged={(e) => setHiddenCols([...e.visibleInPopin, ...e.hiddenInPopin].map((c) => c.id))}
      tree={isTree ? { nodeOf: tree.nodeOf, toggle: tree.toggle } : undefined}
      groupBy={groupBy ?? undefined}
      groupSummary={subtotalsOn ? (row) => {
        const failed = Boolean(subtotals.error);
        const e = subtotals.get(getPath(row, groupPath!));
        if (!e && !failed) return undefined;
        return { count: e?.count, cells: totalCells(e, failed) };
      } : undefined}
      totals={measures.length ? { label: totalLabel(grand.error?.message), cells: totalCells(grand.entry, Boolean(grand.error)) } : undefined}
      noData={noDataContent}
      popinLayout={p.popinLayout}
      rowHighlight={rowState}
      changedKeys={new Set(Object.keys(overrides))}
      rowMarker={marker}
    />
  ) : null;

  const grid = responsive ? null : (
    <AgGridReact
      // The row model is fixed when the grid starts: grouping switches between the infinite and the client-side model.
      key={gridGrouped ? 'grouped' : isTree ? 'tree' : 'rows'}
      theme={smartKitGridTheme}
      containerStyle={mode === 'grid' ? { position: 'absolute', inset: 0 } : { width: '100%' }}
      columnDefs={colDefs}
      rowHeight={p.condensedTableLayout ? 32 : undefined}
      {...(isTree
        ? {
            rowData: listRows,
            loading: list.isLoading,
            ...(mode === 'grid' ? {} : { domLayout: 'autoHeight' as const }),
            // Tree order comes from the service (a header click sorts siblings there).
            postSortRows: (params: { nodes: { sourceRowIndex: number }[] }) => { params.nodes.sort((a, b) => a.sourceRowIndex - b.sourceRowIndex); },
          }
        : gridGrouped
        ? {
            rowData: groupedRows ?? [],
            loading: groups.isLoading,
            // Rows stay in the service's order (sorted by the group first); a header click sorts on the service.
            postSortRows: (params: { nodes: { sourceRowIndex: number }[] }) => { params.nodes.sort((a, b) => a.sourceRowIndex - b.sourceRowIndex); },
            getRowHeight: (r: { data?: Row }) => {
              const g = groupOf(r.data);
              const el = sectionRef.current;
              if (!g || !el) return undefined;
              const style = getComputedStyle(el);
              const base = parseFloat(style.getPropertyValue('--sk-row-height')) || 0;
              const line = parseFloat(style.getPropertyValue('--sk-total-line-height')) || 0;
              return base ? base + (latest.current.groupLines(g) - 1) * line : undefined;
            },
          }
        : mode === 'grid'
          ? { rowModelType: 'infinite' as const, cacheBlockSize: p.scrollThreshold ?? 100, maxBlocksInCache: 50, infiniteInitialRowCount: 1 }
          : { rowData: list.rows, domLayout: 'autoHeight' as const })}
      getRowId={(r) => (r.rowPinned ? `${TOTAL_ROW}:${r.rowPinned}` : groupOf(r.data) ? `${GROUP_ROW}:${groupOf(r.data)!.key}${groupOf(r.data)!.bottom ? ':bottom' : ''}` : keyOf(r.data as Row))}
      pinnedBottomRowData={pinnedBottom}
      getRowClass={(r) => (r.node.rowPinned ? 'sk-table__total-row' : groupOf(r.data) ? 'sk-table__group-row' : r.data && rowState(r.data as Row) ? `sk-table__row--${rowState(r.data as Row)}` : undefined)}
      rowSelection={selection === 'None' ? undefined : selection === 'Single'
        ? { mode: 'singleRow', checkboxes: true, enableClickSelection: false, isRowSelectable: (n) => selectable(n.data as Row | undefined), hideDisabledCheckboxes: true }
        : { mode: 'multiRow', checkboxes: true, headerCheckbox: mode === 'auto' && p.enableSelectAll !== false, enableClickSelection: false, isRowSelectable: (n) => selectable(n.data as Row | undefined), hideDisabledCheckboxes: true }}
      selectionColumnDef={{ pinned: 'left', width: 48, resizable: false, suppressHeaderMenuButton: true }}
      suppressCellFocus={false}
      suppressColumnVirtualisation={mode === 'auto'}
      animateRows={false}
      ensureDomOrder
      localeText={gridLocaleText}
      overlayNoRowsTemplate={undefined}
      suppressNoRowsOverlay
      onGridReady={(e: GridReadyEvent) => {
        apiRef.current = e.api;
        // the table's name for assistive technology, as the responsive table has it (its header text)
        if (title) e.api.setGridAriaProperty('label', title);
        if (mode === 'grid' && datasource) e.api.setGridOption('datasource', datasource);
      }}
      onFirstDataRendered={(e) => {
        const r = restore.current;
        if (mode === 'auto' && r) {
          e.api.forEachNode((n) => { if (n.data && r.selectedKeys.includes(keyOf(n.data as Row))) n.setSelected(true); });
          restore.current = undefined;
        }
      }}
      onSelectionChanged={(e) => {
        const nodes = e.api.getSelectedNodes();
        if (limit && nodes.length > limit) { for (const n of nodes.slice(limit)) n.setSelected(false); return; }
        const rows = e.api.getSelectedRows() as Row[];
        setSelected(rows);
        apply.loadSelected(e.api, rows, pathOf, replaceRow);
        p.onSelectionChange?.({ selectedContexts: rows.map((r) => contextOf(pathOf(r), r)) });
        saveView();
      }}
      onBodyScroll={(e) => {
        if (mode === 'grid' && e.direction === 'vertical') page?.contentScrolled(e.top);
        // Grouped grid: the next leaves of a group, or the next groups, once their last rows come into view.
        if (gridGrouped && !groups.isFetching) groups.loadMore(e.api.getLastDisplayedRowIndex());
      }}
      onBodyScrollEnd={() => saveView()}
      onViewportChanged={() => apply.loadLate(apiRef.current, pathOf, replaceRow)}
      onSortChanged={onSortChanged}
      onColumnMoved={(e) => {
        if (!e.finished) return;
        const ids = e.api.getColumnState().map((s) => s.colId).filter((id) => id !== '$nav' && !id.startsWith('ag-Grid'));
        setVisibleIds(ids);
      }}
      onRowDoubleClicked={(e) => { if (navigable && e.data && !e.node.rowPinned && !groupOf(e.data)) navigate(e.data as Row); }}
      onCellKeyDown={(e: CellKeyDownEvent) => {
        const ev = e.event as KeyboardEvent | undefined;
        // Tree tables: "+" expands, "-" collapses the node of the focused row (sap.ui.table.TreeTable).
        // Group rows: "+" / "-" / Enter expand and collapse (sap.ui.table group headers).
        const g = groupOf(e.data);
        if (g && !g.bottom && (ev?.key === '+' || ev?.key === '-' || ev?.key === 'Enter')) {
          if (ev.key === 'Enter' || g.expanded === (ev.key === '-')) latest.current.toggleGroup(g.key);
          return;
        }
        if (isTree && e.data && (ev?.key === '+' || ev?.key === '-')) {
          const node = tree.nodeOf(e.data as Row);
          if (node && node.drillState !== 'leaf' && (node.drillState === 'expanded') === (ev.key === '-')) tree.toggle(e.data as Row);
          return;
        }
        if (ev?.key === 'Enter' && navigable && e.data && !e.node.rowPinned && !groupOf(e.data) && e.column.getColId() !== '$nav') navigate(e.data as Row);
      }}
    />
  );

  return (
    <TableCtx.Provider value={internal}>
      <section ref={sectionRef} className={['sk-table', `sk-table--${mode}`, fixedRows ? 'sk-table--fixed-rows' : '', p.className].filter(Boolean).join(' ')} data-sk-fullscreen={fullScreen || undefined}
        style={fullScreen ? { position: 'fixed', inset: 0, zIndex: 300, background: 'var(--sk-color-surface)', padding: 'var(--sk-space-4)', display: 'flex', flexDirection: 'column', overflow: 'auto' } : fixedRows ? { flex: 'none', minHeight: 0 } : undefined} aria-label={title} data-sk-table={info.entitySet} aria-busy={p.busy || list.isFetching || undefined}>
        {p.children ?? <ToolbarPart />}
        <FilterInfoPart />
        {error ? (
          <Alert color="red" variant="light" className="sk-table__error" role="alert">{t('table.error', { message: error.message })}</Alert>
        ) : null}
        {creating && createMode === 'inline' && parent && !p.creationMode?.createAtEnd ? inlineCreate : null}
        <div className="sk-table__body" style={rowsStyle} data-sk-row-count={p.rowCount}>
          {grid}
          {responsiveTable}
          {(!executed || empty) && !error && !responsive ? <div className="sk-table__nodata" data-sk-nodata>{noDataContent}</div> : null}
          {!executed && responsive ? <div className="sk-table__nodata sk-rtable__nodata" data-sk-nodata><Text c="dimmed">{noDataText}</Text></div> : null}
          {p.showOverlay ? <div className="sk-table__overlay" data-sk-overlay><Text>{t('page.overlay')}</Text></div> : null}
          {p.busy || (list.isFetching && mode === 'auto' && list.rows.length === 0) ? <div className="sk-table__busy" role="status" aria-label={t('table.loading')} data-sk-busy /> : null}
        </div>
        {creating && createMode === 'inline' && parent && p.creationMode?.createAtEnd ? inlineCreate : null}
        {preview ? (
          <div className="sk-table__show-all">
            <Anchor component="button" type="button" onClick={() => (p.onShowAll ? p.onShowAll() : parent && navigation?.toTable?.(parent.path, parent.navigation, service.name))} data-sk-show-all>
              {t('table.showAll', { count: list.count! })}
            </Anchor>
          </div>
        ) : null}
        {scrollGrowing ? <div ref={growRef} className="sk-table__grow-sentinel" aria-hidden data-sk-grow-sentinel /> : null}
        {mode === 'auto' && list.hasMore && !preview && !scrollGrowing ? (
          <Button variant="subtle" fullWidth className="sk-table__more" loading={list.isFetching} onClick={() => { list.loadMore(); setOwn((s) => ({ ...s, loaded: list.rows.length + growSize })); }} data-sk-more>
            {list.count !== undefined ? t('table.moreCount', { loaded: list.rows.length, count: list.count }) : t('table.more')}
          </Button>
        ) : null}
      </section>
      <TableP13nDialog
        opened={p13n}
        columns={allColumns}
        visible={visible}
        sort={baseSort}
        sortable={p13nProps}
        groupable={canGroupHere && p13nAllows('Group') ? groupable.map((c) => ({ id: c.id, label: c.label })) : undefined}
        groupBy={groupBy}
        totalable={p13nAllows('Aggregate') ? totalable.filter((c) => visible.includes(c.id)).map((c) => ({ id: c.id, label: c.label })) : []}
        totals={totalIds}
        onOk={(ids, s, g, tot) => { setVisibleIds(ids); setSort(s); if (g !== undefined) setGroupBy(g); if (tot) setTotals(tot); setP13n(false); }}
        onCancel={() => setP13n(false)}
      />
      {runner.dialogs}
      {massEditRows ? (
        <Suspense fallback={null}><MassEditDialog
          opened type={type} typeName={info.typeName} service={p.service} rows={massEditRows} customContent={p.massEdit?.customContent}
          columns={visibleColumns.map((c) => c.field)} visibleFields={p.massEdit?.visibleFields} ignoredFields={p.massEdit?.ignoredFields}
          onClose={() => setMassEditRows(null)}
          onApply={async (changes) => {
            const out: Message[] = [];
            let done = 0;
            if (strategy.kind === 'direct' && service.dataProvider.batch) {
              // direct save with $batch: the selected rows change in one change set (all or none)
              const results = await writeAll(service.dataProvider, massEditRows.map((row) => ({ kind: 'update' as const, path: pathOf(row), patch: changes, etag: row['@odata.etag'] as string | undefined })), { atomic: true });
              for (const r of results) {
                if (r.ok) { out.push(...(r.messages ?? [])); done++; }
                else if (!(r.error instanceof RolledBackError)) out.push(...messagesFromError(r.error));
              }
            } else for (const row of massEditRows) {
              try {
                const session = await strategy.begin(pathOf(row), row);
                for (const [k, v] of Object.entries(changes)) session.set(k, v);
                const r = await session.save();
                out.push(...(r.messages ?? []));
                done++;
              } catch (e) { out.push(...messagesFromError(e)); }
            }
            if (done) out.unshift({ id: `mass-edit-${Date.now()}`, type: 'success', message: t('table.massEdit.done'), source: 'client' });
            messages?.add(out);
            setMassEditRows(null);
            ctx.refresh();
          }}
        /></Suspense>
      ) : null}
      {askNewObject ? <NewObjectDialog opened service={p.service} typeName={info.typeName} fields={newObjectFields} onContinue={createDraft} onCancel={() => setAskNewObject(false)} /> : null}
      {canCreate && !newPage && (createMode === 'dialog' || !parent) ? (
        <CreateDialog
          opened={creating}
          onClose={() => setCreating(false)}
          title={t('create.title', { type: ui.headerInfo.typeName })}
          service={p.service}
          typeName={info.typeName}
          fields={dialogFields}
          onCreate={parent ? createChild : createRoot}
        />
      ) : null}
      <Modal opened={Boolean(confirmDelete)} onClose={() => setConfirmDelete(null)} title={t('delete.title')} data-sk-delete-dialog>
        <Stack>
          {confirmDelete ? deleteTexts(confirmDelete).map((x) => <Text key={x}>{x}</Text>) : null}
          <Group justify="flex-end">
            <Button color="red" onClick={() => confirmDelete && void deleteNow(confirmDelete.filter(isDeletable))} data-sk-delete-confirm>{t('actions.delete')}</Button>
            <Button variant="default" onClick={() => setConfirmDelete(null)}>{t('common.cancel')}</Button>
          </Group>
        </Stack>
      </Modal>
    </TableCtx.Provider>
  );
}

/** sap.fe.macros.Table: annotation-driven table (`contextPath`, `metaPath`, docs/30 §5.2). */
export function Table(p: $TableSettings) {
  return <TableCore {...p} ref={p.ref as Ref<TreeTable> | undefined} />;
}

/** sap.fe.macros.TreeTable: the recursive hierarchy of the entity type (Aggregation.RecursiveHierarchy, docs/26 §3.10). */
export function TreeTable(p: $TreeTableSettings) {
  const { type: _type, ...rest } = p;
  return <TableCore {...rest} tree />;
}

/** Parts for a custom toolbar (`children`); they work inside `Table` and `TreeTable`. */
Table.Toolbar = ToolbarPart;
Table.Title = TitlePart;
Table.Actions = ActionsPart;
Table.Settings = SettingsPart;
Table.Export = ExportPart;
Table.Copy = CopyPart;
Table.Details = DetailsPart;
Table.Search = SearchPart;
