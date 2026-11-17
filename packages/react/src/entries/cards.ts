'use client';

/**
 * `@rhfan2019/smart-kit/cards`: Fiori cards (docs/20, ADR-028). Names follow SAPUI5: the container `Card` and the
 * headers (sap.f.Card, sap.f.cards.*), the annotation-driven contents (sap.ui.integration.cards.*Content).
 */
export { Card, type CardProps } from '../cards/Card';
export {
  Header, NumericHeader, NumericSideIndicator,
  type HeaderProps, type NumericHeaderProps, type NumericSideIndicatorProps, type ValueColor, type DeviationIndicator,
} from '../cards/Header';
export { ListContent, type ListContentProps } from '../cards/ListContent';
export { TableContent, type TableContentProps } from '../cards/TableContent';
export { ObjectContent, type ObjectContentProps } from '../cards/ObjectContent';
export { AnalyticalContent, type AnalyticalContentProps } from '../cards/AnalyticalContent';
export { TimelineContent, type TimelineContentProps } from '../cards/TimelineContent';
export { CalendarContent, type CalendarContentProps, type CalendarSpecialDate, type CalendarLegendItem } from '../cards/CalendarContent';
export type { CardDataProps } from '../cards/useCardList';
export type { CardAnnotationSettings } from '../cards/annotations';
export type { EventItemPaths } from '../cards/events';
