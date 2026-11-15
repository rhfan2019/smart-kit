/** Navigation adapter injected by the host application. The library never touches the URL (NAV-06). */
import type { EntityPath } from '../query/entityPath';

export type NavigationTarget = { kind: 'object'; path: EntityPath; service?: string } | { kind: 'list'; entitySet: string; service?: string };

export interface NavigationAdapter {
  /** Opens the object page (or sub-object page) of `path` of `service`. */
  toObject(path: EntityPath, service?: string): void;
  /** Goes to the list page of `entitySet`. */
  toList(entitySet: string, service?: string): void;
  /** Link address for <a href>; undefined renders a button only. */
  href?(target: NavigationTarget): string | undefined;
  /** Whether an object page exists for rows of `entitySet` (controls navigation indicators). */
  hasObjectPage?(entitySet: string, service?: string): boolean;
  /** Opens a page with the whole table of a collection navigation ("Show All (x)", OP Tables). */
  toTable?(parent: EntityPath, navigation: string, service?: string): void;
}
