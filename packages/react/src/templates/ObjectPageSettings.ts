/**
 * Settings of the object page template = the manifest settings of sap.fe.templates.ObjectPage (SAPUI5 1.154,
 * docs/26c §3.1, §3.3, §4, §8; FE source `core/converters/ManifestSettings.ts`, `templates/ObjectPage/Component.ts`).
 * Names, nesting, values and defaults are those of the manifest. Where FE names an extension (fragment, controller
 * function), the React form is the same key with a render function or handler (docs/30 §5.3, category react-idiom).
 * Settings that need SAP infrastructure or are not implemented yet are registered in
 * tools/ui5-alignment/deviations.op5.json (kind manifest-missing).
 */
import type { ReactNode } from 'react';
import type { Row } from '@rhfan2019/smart-kit-core';
import type { PopinLayout } from '../m/library';
import type { Context } from '../v4/fe/macros/Table';

export type { Context };

/** Position of a custom element (sap.fe.core.converters.helpers.ConfigurableObject Position). */
export interface Position {
  /** Key of the element the custom element is placed next to; without it: before the first ("Before") or after the last element. */
  anchor?: string;
  placement: 'After' | 'Before' | 'End';
}

/** Event of a header, footer or sub-section action (FE: the extension function gets the page context). */
export interface ObjectPage$ActionPressEvent {
  /** The object of the page. */
  bindingContext: Context;
}

/** A header, footer or sub-section action (ManifestAction). */
export interface ManifestAction {
  /** Button text. */
  text?: string;
  /** Handler (FE: the name of an extension function). */
  press?(e: ObjectPage$ActionPressEvent): void;
  /** Shown; a function of the object stands for a binding expression. @defaultValue true */
  visible?: boolean | ((row: Row | undefined) => boolean);
  /** Enabled; a function of the object stands for a binding expression. @defaultValue true */
  enabled?: boolean | ((row: Row | undefined) => boolean);
  /** Position among the actions (keys such as "EditAction", "DeleteAction", "DataFieldForAction::Namespace.action"). */
  position?: Position;
  /** Keys of the actions shown in a menu button (the action becomes a menu). */
  menu?: string[];
}

/** Event of a table action (the selected rows). */
export interface ObjectPage$TableActionPressEvent {
  selectedContexts: Context[];
}

/** An action of a sub-object table (`controlConfiguration › <nav>/@UI.LineItem › actions`). */
export interface TableManifestAction {
  text?: string;
  /** Handler (FE: the name of an extension function, called with the selected contexts). */
  press?(e: ObjectPage$TableActionPressEvent): void;
  /** @defaultValue true */
  visible?: boolean;
  /** @defaultValue true */
  enabled?: boolean;
  position?: Position;
  /** Enabled only with selected rows. */
  requiresSelection?: boolean;
  /** Enabled with one ("single") or at least one ("multi") selected row. */
  enableOnSelect?: 'single' | 'multi';
  /** Keys of the actions shown in a menu button. */
  menu?: string[];
}

/** A custom column, or the override of an annotation column (key "DataField::Path"). */
export interface TableManifestColumn {
  /** Column header. */
  header?: string;
  /** Cell content (FE: the fragment name of the template). */
  template?(row: Row): ReactNode;
  /** Properties the column shows: they are selected and exported. */
  properties?: string[];
  position?: Position;
  /** CSS width. */
  width?: string;
  importance?: 'High' | 'Medium' | 'Low' | 'None';
  horizontalAlign?: 'Begin' | 'Center' | 'End';
  /** Not exported. */
  disableExport?: boolean;
}

/** Creation of sub-objects (`tableSettings › creationMode`). */
export interface TableCreationModeConfiguration {
  /**
   * NewPage: create and open the sub-object page; Inline / InlineCreationRows: a new row in the table; CreationDialog:
   * a dialog. FE default NewPage; without a route to the sub-object page (smart-kit: no `navigation` entry and
   * NavigationAdapter.hasObjectPage false) Inline. @defaultValue "NewPage"
   */
  name?: 'NewPage' | 'Inline' | 'InlineCreationRows' | 'CreationDialog' | 'External' | 'AddViaValueHelp' | 'Sync' | 'Async' | 'Deferred' | 'CreationRow';
}

/** `tableSettings` of a sub-object table (TableManifestSettingsConfiguration). */
export interface TableManifestSettingsConfiguration {
  /** Table type; default by the annotations (analytical, tree), else ResponsiveTable. */
  type?: 'ResponsiveTable' | 'GridTable' | 'AnalyticalTable' | 'TreeTable';
  /** Auto: Multi when an action needs a selection (object page: only while editing), else None. @defaultValue "Auto" */
  selectionMode?: 'Auto' | 'None' | 'Single' | 'Multi' | 'ForceSingle' | 'ForceMulti';
  creationMode?: TableCreationModeConfiguration;
  /** Object page: equals `enablePaste` (true). @defaultValue true */
  enableExport?: boolean;
  exportFileName?: string;
  exportSheetName?: string;
  exportRequestSize?: number;
  disableCopyToClipboard?: boolean;
  /** Only on phones. @defaultValue false */
  enableFullScreen?: boolean;
  /** false: no personalization; or which panels. Default Sort, Column, Filter (+ Group, Aggregate by type). */
  personalization?: boolean | { sort?: boolean; column?: boolean; filter?: boolean; group?: boolean; aggregate?: boolean };
  /** Default `UI.HeaderInfo/TypeNamePlural` of the target (smart-kit: the facet label). */
  header?: string;
  /** @defaultValue true */
  headerVisible?: boolean;
  /** Non-responsive tables. Object page: Fixed. @defaultValue "Fixed" */
  rowCountMode?: 'Auto' | 'Fixed' | 'Interactive';
  /** @defaultValue 200 */
  selectionLimit?: number;
  frozenColumnCount?: number;
  /** @defaultValue false */
  disableColumnFreeze?: boolean;
  /** @defaultValue false */
  widthIncludingColumnHeader?: boolean;
  /** @defaultValue false */
  condensedTableLayout?: boolean;
  /** Responsive tables. @defaultValue "Block" */
  popinLayout?: PopinLayout;
  /** Rows per request (object page navigation tables: 10). */
  threshold?: number;
  /** Non-responsive tables. @defaultValue 300 */
  scrollThreshold?: number;
  /** Search field (default by SearchRestrictions). */
  isSearchable?: boolean;
  /** Read only also while editing. */
  readOnly?: boolean;
  /** Comma-separated properties whose columns are left out. */
  ignoredFields?: string;
}

/** `controlConfiguration › <nav>/@com.sap.vocabularies.UI.v1.LineItem` (TableManifestConfiguration). */
export interface TableManifestConfiguration {
  tableSettings?: TableManifestSettingsConfiguration;
  /** Custom and overridden columns by key. */
  columns?: Record<string, TableManifestColumn>;
  /** Custom and overridden actions by key. */
  actions?: Record<string, TableManifestAction>;
}

/** Side content of a sub-section (ManifestSideContent); shown with the instance method `showSideContent`. */
export interface ManifestSideContent {
  /** Content (FE: the fragment name). */
  template(row: Row | undefined): ReactNode;
  /** Main and side content take half of the width each. */
  equalSplit?: boolean;
}

/** A custom sub-section, or the override of an annotation sub-section (ManifestSubSection). */
export interface ManifestSubSection {
  title?: string;
  /** Content (FE: the fragment name). */
  template?(row: Row | undefined): ReactNode;
  position?: Position;
  /** @defaultValue true */
  visible?: boolean | ((row: Row | undefined) => boolean);
  /** Toolbar actions of the sub-section. */
  actions?: Record<string, ManifestAction>;
  sideContent?: ManifestSideContent;
  /** The content is rendered only when scrolled near. @defaultValue false */
  enableLazyLoading?: boolean;
  /** false: behind "Show More". @defaultValue true */
  isPartOfPreview?: boolean;
  /**
   * Layout blocks (sap.uxap blocks with 1–3 columns, `more`: behind "Show More"); smart-kit addition — in FE they are
   * part of the fragment.
   */
  blocks?: { id: string; columns: 1 | 2 | 3; more?: boolean; content: ReactNode }[];
}

/** A custom section, or the override of an annotation section (ManifestSection). */
export interface ManifestSection {
  title?: string;
  /** Content of a section without sub-sections (FE: the fragment name). */
  template?(row: Row | undefined): ReactNode;
  position?: Position;
  /** @defaultValue true */
  visible?: boolean | ((row: Row | undefined) => boolean);
  subSections?: Record<string, ManifestSubSection>;
  /** Actions of a section without sub-sections. */
  actions?: Record<string, ManifestAction>;
  /** false: behind "Show More". @defaultValue true */
  isPartOfPreview?: boolean;
  /** Message strip at the top of the section (OP-17); smart-kit addition. */
  messageStrip?: ReactNode;
}

/** A custom header facet (ManifestHeaderFacet). */
export interface ManifestHeaderFacet {
  /** Facet title. */
  title?: string;
  subTitle?: string;
  /** Content (FE: the fragment name). */
  template(row: Row | undefined): ReactNode;
  /** Content in the editable header section while editing (FE: the fragment name of templateEdit). */
  templateEdit?(row: Row | undefined): ReactNode;
  /** Position among the header facets (keys: the facet ids). */
  position?: Position;
  /** @defaultValue true */
  visible?: boolean | ((row: Row | undefined) => boolean);
}

/** Navigation target (NavigationTargetConfiguration). */
export interface NavigationTargetConfiguration {
  /**
   * Route of the target page. smart-kit has no router: the rows navigate with NavigationAdapter.toObject, which maps
   * the entity path to the host's route; the name is kept for the correspondence with the manifest.
   */
  route?: string;
}

/** `navigation › <navigation property>` (NavigationSettingsConfiguration). */
export interface NavigationSettingsConfiguration {
  /** Row press of the sub-object table. */
  detail?: NavigationTargetConfiguration;
}

/** `content › header`. */
export interface ObjectPageHeaderContent {
  /** Shows the header (title and content). @defaultValue true */
  visible?: boolean;
  /** Shows the anchor bar (with sectionLayout "Tabs": the tab bar); also the title click and the pin. @defaultValue true */
  anchorBarVisible?: boolean;
  /** Custom header facets by key. */
  facets?: Record<string, ManifestHeaderFacet>;
  /** Custom header actions by key. */
  actions?: Record<string, ManifestAction>;
}

/** `content` of the object page. */
export interface ObjectPageContent {
  header?: ObjectPageHeaderContent;
  body?: {
    /** Custom sections and overrides of annotation sections by key (the UI.Facets ID). */
    sections?: Record<string, ManifestSection>;
  };
  footer?: {
    /** Custom footer actions by key ("SaveAction", "CancelAction" and the determining actions are anchors). */
    actions?: Record<string, ManifestAction>;
  };
}

/** Manifest settings of the object page (ObjectPageManifestSettings + BaseManifestSettings). */
export interface ObjectPageManifestSettings {
  /** Entity set of the page (FE: `settings › entitySet`). */
  entitySet?: string;
  /** Entity set path, "/Set" or "/Set/_Nav" (default `/${entitySet}`). */
  contextPath?: string;
  /** "Page": all sections on one page with an anchor bar; "Tabs": one section per tab. @defaultValue "Page" */
  sectionLayout?: 'Page' | 'Tabs';
  /** While editing, the header facets are edited in a "Header" section and the header content is hidden. @defaultValue true */
  editableHeaderContent?: boolean;
  content?: ObjectPageContent;
  /** Configuration of the sub-object tables by annotation path, e.g. "_Item/@com.sap.vocabularies.UI.v1.LineItem". */
  controlConfiguration?: Record<string, TableManifestConfiguration>;
  /** Navigation of the sub-object tables by navigation property. */
  navigation?: Record<string, NavigationSettingsConfiguration>;
  /** Opens the page in edit mode. @defaultValue false */
  openInEditMode?: boolean;
  /** Sub-sections render their content only when scrolled near. @defaultValue false */
  enableLazyLoading?: boolean;
  /** Tables without data show a text instead of an illustrated message. @defaultValue false */
  useTextForNoDataMessages?: boolean;
  /** "Control": variant management per table; "None": none ("Page" is not allowed on object pages). @defaultValue "None" */
  variantManagement?: 'None' | 'Control';
  /** Further properties read with the object (e.g. for custom content). @defaultValue [] */
  additionalProperties?: string[];
}
