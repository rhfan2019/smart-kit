/**
 * Card (sap.f.Card): a container with a header and a content area, optionally a footer (docs/20 CD-01).
 * Sizes follow the SAPUI5 integration card (Horizon); colours come from the theme tokens.
 */
import { useCallback, useId, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { CardContext, type CardContextValue, type CardCounter, type CardHeaderDefaults } from './CardContext';

export interface CardProps {
  /** Header (`Header` or `NumericHeader`). */
  header?: ReactNode;
  /** Position of the header (sap.f.cards.HeaderPosition); default "Top". */
  headerPosition?: 'Top' | 'Bottom';
  /** Content (`ListContent`, `TableContent`, …, or any React content: the Component card). */
  children?: ReactNode;
  /** Footer, e.g. buttons (the integration card's actions strip). */
  footer?: ReactNode;
  /** CSS width; default: the width of the container (CD-08). */
  width?: string;
  /** CSS height; default: the height of the content. */
  height?: string;
  /** Extra CSS class on the root element. */
  className?: string;
  /** Inline style, e.g. `{ width: 400 }` (cards fill their container otherwise). */
  style?: CSSProperties;
  /** Accessible description of the card type, e.g. "List card". */
  'aria-roledescription'?: string;
}

export function Card(p: CardProps) {
  const titleId = useId();
  const [counter, setCounterState] = useState<CardCounter | undefined>();
  const [headerPress, setPress] = useState<(() => void) | undefined>();
  const setCounter = useCallback((c: CardCounter | undefined) => setCounterState(c), []);
  const setHeaderPress = useCallback((fn: (() => void) | undefined) => setPress(() => fn), []);
  const [headerDefaults, setDefaults] = useState<CardHeaderDefaults | undefined>();
  const setHeaderDefaults = useCallback((d: CardHeaderDefaults | undefined) => setDefaults(d), []);
  const ctx = useMemo<CardContextValue>(
    () => ({ counter, setCounter, headerPress, setHeaderPress, headerDefaults, setHeaderDefaults, titleId }),
    [counter, setCounter, headerPress, setHeaderPress, headerDefaults, setHeaderDefaults, titleId],
  );
  const bottom = p.headerPosition === 'Bottom';
  return (
    <CardContext.Provider value={ctx}>
      <section
        className={['sk-card', bottom && 'sk-card--header-bottom', p.className].filter(Boolean).join(' ')}
        style={{ ...p.style, ...(p.width ? { width: p.width } : {}), ...(p.height ? { height: p.height } : {}) }}
        aria-labelledby={p.header ? titleId : undefined}
        aria-roledescription={p['aria-roledescription']}
      >
        {!bottom && p.header}
        {p.children !== undefined && p.children !== null && <div className="sk-card__content">{p.children}</div>}
        {p.footer && <div className="sk-card__footer">{p.footer}</div>}
        {bottom && p.header}
      </section>
    </CardContext.Provider>
  );
}
