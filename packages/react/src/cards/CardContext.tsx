/**
 * Card ↔ header ↔ content wiring (docs/20). The content reports how many items it shows and how many exist (header
 * counter "5 of 40", CD-03) and where the header navigates by default (the parent app, CD-05).
 */
import type { NavigationAdapter } from '@rhfan2019/smart-kit-core';
import type { TitleLevel } from '../controls/types';
import { createContext, useContext, useEffect } from 'react';

export interface CardCounter {
  visible: number;
  total?: number;
}

/** Header texts the content derives from annotations (UI.HeaderInfo), used when the header leaves them out. */
export interface CardHeaderDefaults {
  title?: string;
  subtitle?: string;
  iconSrc?: string;
  iconInitials?: string;
}

export interface CardContextValue {
  counter?: CardCounter;
  setCounter(c: CardCounter | undefined): void;
  /** Default press of the header (the content's "show all" target). */
  headerPress?: () => void;
  setHeaderPress(fn: (() => void) | undefined): void;
  headerDefaults?: CardHeaderDefaults;
  setHeaderDefaults(d: CardHeaderDefaults | undefined): void;
  /** Id of the header title (aria-labelledby of the card). */
  titleId: string;
  /** Heading level of the header title (the card's `headingLevel`). */
  headingLevel?: TitleLevel;
}

export const CardContext = createContext<CardContextValue | null>(null);

export const useCardContext = () => useContext(CardContext);

/** Reports header defaults (title, subtitle, avatar) derived by the content. */
export function useReportHeaderDefaults(d: CardHeaderDefaults | undefined) {
  const set = useCardContext()?.setHeaderDefaults;
  const key = JSON.stringify(d ?? null);
  useEffect(() => {
    set?.(d);
  }, [set, key]); // eslint-disable-line react-hooks/exhaustive-deps
}

/** Reports the content's counter and default header press to the enclosing Card (no-op outside a Card). */
export function useReportToCard(counter: CardCounter | undefined, headerPress: (() => void) | undefined) {
  const ctx = useCardContext();
  const setCounter = ctx?.setCounter;
  const setHeaderPress = ctx?.setHeaderPress;
  const visible = counter?.visible;
  const total = counter?.total;
  useEffect(() => {
    setCounter?.(visible === undefined ? undefined : { visible, total });
  }, [setCounter, visible, total]);
  useEffect(() => {
    // `headerPress` must be stable (useCallback): it is state of the Card.
    setHeaderPress?.(headerPress);
    return () => setHeaderPress?.(undefined);
  }, [setHeaderPress, headerPress]);
}

/** Whether the header can open the list page of an entity set (an adapter with `href` names the pages it has). */
export function hasListPage(navigation: NavigationAdapter | undefined, entitySet: string, service: string): navigation is NavigationAdapter {
  if (!navigation) return false;
  return navigation.href ? navigation.href({ kind: 'list', entitySet, service }) !== undefined : true;
}
