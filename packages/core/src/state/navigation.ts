/** Navigation adapter injected by the host application. The library never touches the URL (NAV-06). */
import type { EntityPath } from '../query/entityPath';

export type NavigationTarget = { kind: 'object'; path: EntityPath; service?: string } | { kind: 'list'; entitySet: string; service?: string };

export interface NavigationAdapter {
  /** Opens the object page (or sub-object page) of `path` of `service`. */
  toObject(path: EntityPath, service?: string): void;
  /** Goes to the list page of `entitySet`. */
  toList(entitySet: string, service?: string): void;
  /**
   * Opens the object page in create mode for a new object of `entitySet` (the host renders `ObjectPage` with `create`).
   * With it, "Create" of a list without draft whose creation mode is "NewPage" (the list report's default) goes to that
   * page, so creating and editing share one page; without it such a list creates with a dialog. FE 1.154 has NewPage
   * only with drafts or sticky sessions (kit-extension, DV-FE-04).
   */
  toCreate?(entitySet: string, service?: string): void;
  /** Link address for <a href>; undefined renders a button only. */
  href?(target: NavigationTarget): string | undefined;
  /** Whether an object page exists for rows of `entitySet` (controls navigation indicators). */
  hasObjectPage?(entitySet: string, service?: string): boolean;
  /** Opens a page with the whole table of a collection navigation ("Show All (x)", OP Tables). */
  toTable?(parent: EntityPath, navigation: string, service?: string): void;
  /**
   * Navigation targets of a semantic object (D42: what the Fiori launchpad resolves in Fiori elements, the host gives
   * here). Used by `Common.SemanticObject` smart links (the popover lists the targets; one target is a direct link) and by
   * `UI.DataFieldWithIntentBasedNavigation` (the target of `action`). No targets (or no method): the value is plain text.
   */
  semanticTargets?(request: SemanticTargetRequest): SemanticTarget[] | undefined;
}

/** What a semantic link asks the host for (NavigationAdapter.semanticTargets). */
export interface SemanticTargetRequest {
  semanticObject: string;
  /** The intent's action (DataFieldWithIntentBasedNavigation/Action); undefined: all actions of the semantic object. */
  action?: string;
  /** The row the value belongs to (the host maps its values to parameters of the target). */
  row: Record<string, unknown>;
  /** The property shown (Common.SemanticObject) or the DataField's value path. */
  path?: string;
  service?: string;
}

/** A navigation target of a semantic link. */
export interface SemanticTarget {
  /** Link text in the popover, e.g. "Display Partner". */
  text: string;
  /** Link address. */
  href: string;
  /** The action, e.g. "display" (matched against DataFieldWithIntentBasedNavigation/Action). */
  action?: string;
  /** Optional sub-title of the link in the popover. */
  description?: string;
}
