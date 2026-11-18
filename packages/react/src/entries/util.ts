'use client';

/** `@rhfan2019/smart-kit/util`: extension points and page state. */
export { applyExtensions, type ExtendEntry, type ExtendPosition } from '../util/extend';
export { usePageState } from '../util/usePageState';
// helpers that used to be in /controls (stage 1, ADR-033 §7)
export { messageTypeOf, type PreventableEvent } from '../controls/types';
export { RESTRICTED_FILE_NAME_CHARACTERS } from '../controls/process/UploadSetwithTable';
export type { DateLike } from '../controls/process/shared';
export { toDates, dynamicDateValueTypes, DEFAULT_STANDARD_OPTIONS } from '../controls/dialogs/DynamicDateRange';
export { viewSettingsFilterString } from '../controls/dialogs/ViewSettingsDialog';
// helpers of the building blocks (stage 2, ADR-033 §7)
export { getPath, fieldValue, resolveRef, type FieldValue, type ValueContext } from '../field/values';
export type { FieldRenderer, FieldRenderProps, RendererRegistry } from '../field/renderers';
export { conditionText, parseConditionText, relativeDateText, type ConditionTextOptions } from '../filter/conditionText';
export { filterSummaryText } from '../filter/FilterSummary';
export { hiddenByImportance } from '../table/ResponsiveTable';
export { niceTicks } from '../chart/SimpleChart';
export { MICRO_COMPARISON_MAX } from '../chart/MicroChart';
export { linkify } from '../object/HeaderFacet';
export { draftState, type DraftState } from '../object/DraftIndicator';
export { fclArrows, type FclArrow } from '../layout/FlexibleColumnLayout';
export { isActionAvailable, actionPaths } from '../actions/useActionRunner';
export { isEditable, validate, fieldErrors, createFields, createWith } from '../edit/editing';
