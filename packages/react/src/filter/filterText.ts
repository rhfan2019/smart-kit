/** Texts of the filter fields: the app's texts, then the DynamicDateRange texts for the semantic date operators. */
import { useControlText } from '../controls/context';
import { TEXTS } from '../controls/dialogs/texts';
import type { TextFn } from '../i18n/text';

export function useFilterText(): TextFn {
  return useControlText(TEXTS);
}
