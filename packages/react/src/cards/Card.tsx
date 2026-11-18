/**
 * Card (sap.f.Card): a container with a header and a content area, optionally a footer (docs/20 CD-01).
 * Sizes follow the SAPUI5 integration card (Horizon); colours come from the theme tokens.
 */
import { useCallback, useId, useImperativeHandle, useMemo, useState, type CSSProperties, type KeyboardEvent, type MouseEvent, type ReactNode, type Ref } from 'react';
import type { TitleLevel } from '../controls/types';
import { CardContext, type CardContextValue, type CardCounter, type CardHeaderDefaults } from './CardContext';

/** sap.f.cards.HeaderPosition */
export type HeaderPosition = 'Top' | 'Bottom';
/** sap.f.cards.SemanticRole */
export type SemanticRole = 'Region' | 'ListItem';

export interface $CardSettings {
  /** Header (`Header` or `NumericHeader`). */
  header?: ReactNode;
  /** Position of the header. @defaultValue 'Top' */
  headerPosition?: HeaderPosition;
  /** Content (`ListContent`, `TableContent`, …, or any React content: the Component card); the same as `children`. */
  content?: ReactNode;
  /** The content as JSX children (used when `content` is not given). */
  children?: ReactNode;
  /** Footer, e.g. buttons (the integration card's actions strip). */
  footer?: ReactNode;
  /** CSS width (the width of the container). @defaultValue '100%' */
  width?: string;
  /** CSS height (the height of the content). @defaultValue 'auto' */
  height?: string;
  /** Accessibility role: a region, or an item of a list (then `onPress` makes the whole card interactive). @defaultValue 'Region' */
  semanticRole?: SemanticRole;
  /** Heading level of the header title (aria-level). @defaultValue 'H3' */
  headingLevel?: TitleLevel;
  /** Press of the whole card; only with `semanticRole` "ListItem" (sap.f.CardBase#press). */
  onPress?(): void;
  /** Extra CSS class on the root element. */
  className?: string;
  /** Inline style, e.g. `{ width: 400 }`; the `width` / `height` props win over the style's. */
  style?: CSSProperties;
  /** Accessible description of the card type, e.g. "List card". */
  'aria-roledescription'?: string;
  ref?: Ref<Card>;
}

/** Instance methods of Card. */
export interface Card {
  /**
   * The accessibility role the card has as an item of a sap.f.GridContainer (set by the container through the restricted
   * setGridItemRole). smart-kit has no GridContainer, so this is `null`, as for a SAPUI5 card outside a grid container.
   */
  getGridItemRole(): string | null;
}

/** Whether an event comes from an interactive element inside the card (its own press then wins). */
const fromInner = (e: { target: EventTarget; currentTarget: EventTarget }) => {
  const el = e.target instanceof Element ? e.target.closest('a, button, input, select, textarea, [role="button"], [tabindex]') : null;
  return el !== null && el !== e.currentTarget;
};

export function Card(p: $CardSettings) {
  const titleId = useId();
  useImperativeHandle(p.ref, () => ({ getGridItemRole: () => null }), []);
  const [counter, setCounterState] = useState<CardCounter | undefined>();
  const [headerPress, setPress] = useState<(() => void) | undefined>();
  const setCounter = useCallback((c: CardCounter | undefined) => setCounterState(c), []);
  const setHeaderPress = useCallback((fn: (() => void) | undefined) => setPress(() => fn), []);
  const [headerDefaults, setDefaults] = useState<CardHeaderDefaults | undefined>();
  const setHeaderDefaults = useCallback((d: CardHeaderDefaults | undefined) => setDefaults(d), []);
  const headingLevel = p.headingLevel ?? 'H3';
  const ctx = useMemo<CardContextValue>(
    () => ({ counter, setCounter, headerPress, setHeaderPress, headerDefaults, setHeaderDefaults, titleId, headingLevel }),
    [counter, setCounter, headerPress, setHeaderPress, headerDefaults, setHeaderDefaults, titleId, headingLevel],
  );
  const bottom = p.headerPosition === 'Bottom';
  const listItem = p.semanticRole === 'ListItem';
  const { onPress } = p;
  const interactive = listItem && Boolean(onPress);
  const press = interactive
    ? {
        tabIndex: 0,
        onClick: (e: MouseEvent) => { if (!fromInner(e)) onPress!(); },
        onKeyDown: (e: KeyboardEvent) => {
          if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) { e.preventDefault(); onPress!(); }
        },
      }
    : {};
  const content = p.content ?? p.children;
  return (
    <CardContext.Provider value={ctx}>
      <section
        className={['sk-card', bottom && 'sk-card--header-bottom', interactive && 'sk-card--interactive', p.className].filter(Boolean).join(' ')}
        style={{ width: '100%', height: 'auto', ...p.style, ...(p.width ? { width: p.width } : {}), ...(p.height ? { height: p.height } : {}) }}
        role={listItem ? 'listitem' : undefined}
        aria-labelledby={p.header ? titleId : undefined}
        aria-roledescription={p['aria-roledescription']}
        {...press}
      >
        {!bottom && p.header}
        {content !== undefined && content !== null && <div className="sk-card__content">{content}</div>}
        {p.footer && <div className="sk-card__footer">{p.footer}</div>}
        {bottom && p.header}
      </section>
    </CardContext.Provider>
  );
}
