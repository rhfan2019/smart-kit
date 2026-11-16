/**
 * Stage 1.5 validation of the edit seam (docs/05-data-provider.md §6). The validated direct-save strategy became
 * part of @rhfan2019/smart-kit-core in phase 2 (ADR-018); this module re-exports it so the stage 1.5 test keeps
 * running against the productized code.
 */
export { ConcurrencyError, DirectEditStrategy } from '../../packages/core/src';
