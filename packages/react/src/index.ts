/** Public API of @rhfan2019/smart-kit. Everything exported here is listed in docs/api.md (AC-Q-03). */
export { SmartKitProvider, useSmartKit, useService, useMetaModel, useText, MissingProviderError } from './context/SmartKitProvider';
export type { SmartKitProviderProps, SmartKitContextValue, ServiceConfig, ServiceHandle, EntitySetHandle } from './context/SmartKitProvider';
export { createText, MESSAGES, INTL_LOCALE, type Locale, type TextFn, type TextParams } from './i18n/text';
export type { Messages, MessageKey } from './i18n/messages.en';

export { smartKitMantineTheme, smartKitCssVariablesResolver } from './theme/mantine';
export { smartKitGridTheme } from './theme/agGrid';
export { readToken, useThemeTokens } from './theme/tokens';

export { SmartField, CriticalityIcon, type SmartFieldProps } from './field/SmartField';
export { getPath, fieldValue, resolveRef, type FieldValue, type ValueContext } from './field/values';
export type { FieldRenderer, FieldRenderProps, RendererRegistry } from './field/renderers';

export { applyExtensions, type ExtendEntry, type ExtendPosition } from './util/extend';
export { usePageState } from './util/usePageState';

export { DynamicPage, useDynamicPage, type DynamicPageProps } from './page/DynamicPage';

export { useFilterState, type FilterStateApi, type UseFilterStateOptions, type FilterSnapshot, type AppliedFilter } from './filter/useFilterState';
export { SmartFilterBar, useFilterBarContext, type SmartFilterBarProps, type FilterFieldItem } from './filter/SmartFilterBar';
export { ConditionInput, type ConditionInputProps } from './filter/ConditionInput';
export { ValueHelpDialog, type ValueHelpDialogProps } from './filter/ValueHelpDialog';
export { AdaptFiltersDialog, type AdaptFiltersDialogProps } from './filter/AdaptFiltersDialog';
export { FilterSummary, filterSummaryText, type FilterSummaryProps } from './filter/FilterSummary';
export { parseConditionText, conditionText } from './filter/conditionText';
export { useValueList } from './filter/useValueList';

export { useVariants, type VariantsApi, type UseVariantsOptions } from './variants/useVariants';
export { SmartVariantManagement, type SmartVariantManagementProps } from './variants/SmartVariantManagement';

export { SmartTable, useTableContext, type SmartTableProps, type ColumnItem, type ActionItem, type ActionGroup, type TableExtendEntry, type TableContextValue, type TableQuery } from './table/SmartTable';
export { TableP13nDialog, type TableP13nDialogProps } from './table/TableP13nDialog';
export { useListQuery, type ListQueryOptions, type ListQueryResult } from './table/useListQuery';

export { useObject, useObjectTitle, type ObjectResult, type UseObjectOptions } from './object/useObject';
export { useSectionScrollSpy } from './object/useSectionScrollSpy';
export { ObjectPageLayout, type ObjectPageLayoutProps, type SectionItem, type SubSectionItem, type BlockItem } from './object/ObjectPageLayout';
export { HeaderFacet, linkify, type HeaderFacetProps } from './object/HeaderFacet';
export { AnchorBar, type AnchorBarProps, type AnchorItem } from './object/AnchorBar';
export { SmartForm, type SmartFormProps, type FormFieldItem } from './object/SmartForm';

export { SmartListReport, type SmartListReportProps, type ListContentItem } from './templates/SmartListReport';
export { SmartObjectPage, type SmartObjectPageProps } from './templates/SmartObjectPage';

// ---- phase 2
export { MicroChart, SimpleChart, niceTicks, MICRO_COMPARISON_MAX, type MicroChartKind, type MicroChartPoint, type MicroChartProps, type MicroChartCriticality, type ChartDatum, type SimpleChartProps } from './chart';
export { MessageProvider, MessageButton, MessageIcon, useMessages, type MessagesApi } from './messages/MessageContext';
export { useActionRunner, isActionAvailable, actionPaths, type ActionRunner, type ActionTarget, type ActionResult } from './actions/useActionRunner';
export { useEditStrategy, isEditable, validate, fieldErrors, createFields, createWith, CreateDialog, type CreateDialogProps } from './edit/editing';
export { FieldEditor, type FieldEditorProps } from './field/FieldEditor';
export { QuickViewLink } from './field/QuickView';
export { DraftMarker, draftState, type DraftState } from './object/DraftMarker';
export { GenericTag, type GenericTagProps } from './object/GenericTag';
export { OverflowActions, type OverflowActionsProps, type ToolbarAction } from './page/OverflowActions';
export { ShareMenu, type ShareMenuProps } from './page/ShareMenu';
export { ColumnContext, useColumn, type ColumnContextValue } from './page/columnContext';
export { ResponsiveTable, hiddenByImportance, type ResponsiveTableProps, type ResponsiveColumn } from './table/ResponsiveTable';
export { ChartView, type ChartViewProps } from './list/ChartView';
export { FlexibleColumnLayout, type FlexibleColumnLayoutProps, type FclLayout, type FclPaging } from './layout/FlexibleColumnLayout';
