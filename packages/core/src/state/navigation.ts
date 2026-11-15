/** Navigation adapter injected by the host application. The library never touches the URL. */
import type { EntityPath } from '../query/entityPath';

export type NavigationTarget = { kind: 'object'; path: EntityPath } | { kind: 'list'; entitySet: string };

export interface NavigationAdapter {
  /** Opens the object page (or sub-object page) of `path`. */
  toObject(path: EntityPath): void;
  /** Goes to the list page of `entitySet`. */
  toList(entitySet: string): void;
  /** Link address for <a href>; undefined renders a button only. */
  href?(target: NavigationTarget): string | undefined;
  /** Whether an object page exists for rows of `entitySet` (controls navigation indicators). */
  hasObjectPage?(entitySet: string): boolean;
}
