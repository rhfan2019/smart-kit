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
import type { $ManifestColumnSettings } from './ListReport';
import type { Context, Table$RowPressEvent, Table$SelectionChangeEvent } from '../v4/fe/macros/Table';

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

/** sap.m.OverflowToolbarPriority of a toolbar action. */
export type OverflowToolbarPriority = 'AlwaysOverflow' | 'Disappear' | 'High' | 'Low' | 'NeverOverflow';

/** `… › overflowGroups › <group>` (FE OverflowGroupManifestConfiguration). */
export interface OverflowGroupConfiguration {
  /** A separator before the first action of the group (FE addSeparators). */
  showSeparator?: boolean;
}

/**
 * A custom action of a section or sub-section toolbar (ManifestAction, FE SubSection getFacetActions →
 * FormActionButtons); the base of the header and footer actions.
 */
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
  /**
   * With `menu`: the key of the menu action run by the menu button itself, which becomes a split button (FE
   * DefaultActionHandler getButtonMode "Split" / ActionFactory createMenuButton `defaultAction`).
   */
  defaultAction?: string;
  /**
   * Overflow priority in the toolbar (sap.m.OverflowToolbarLayoutData). Not set: "Low" in the header (FE
   * Actions.fragment.xml), the toolbar's default (High) in the footer and in sections.
   */
  priority?: OverflowToolbarPriority;
  /** Overflow group (used when there is no `overflowGroup`; FE getActionsFromManifest: `overflowGroup ?? group ?? 0`). */
  group?: number;
  /** Overflow group: the actions of a group move into the overflow together; `overflowGroups` adds separators. */
  overflowGroup?: number;
  /**
   * The primary action (FE ActionUtilities applyManifestPrimaryActionEmphasis): in the header and the footer it is
   * emphasized, shown first and never in the overflow (header: while no footer is shown and no action with a
   * criticality is visible; footer: while no action with a criticality is visible); a menu only with `defaultAction`.
   * As in FE without effect in section and sub-section toolbars (FormActionButtons: Transparent buttons).
   */
  isPrimaryAction?: boolean;
  /**
   * Custom content placed in the header toolbar instead of a button (FE Actions.fragment.xml CustomFragment; FE names a
   * fragment, here it is a render function, react-idiom). As in FE without effect in the footer and in sections, which
   * show the action as a button (FooterContent getManifestButton, FormActionButtons).
   */
  template?(): ReactNode;
  /** As in FE without effect outside table toolbars: these toolbars have no selection (FE reads it only for tables). */
  requiresSelection?: boolean;
  /** As in FE without effect outside table toolbars: these toolbars have no selection (FE reads it only for tables). */
  enableOnSelect?: 'multi' | 'single';
  /** As in FE without effect for custom actions: only annotation actions (UI.DataFieldForAction/Determining) go to the footer. */
  determining?: boolean;
}

/** `afterExecution` of an action (FE ActionAfterExecutionConfiguration). */
export interface ActionAfterExecutionConfiguration {
  /**
   * false: no navigation to the object the action returns. Default: an annotation action that returns another object of
   * the page's entity set navigates to it (FE EditFlow invokeAction `isNavigable`).
   */
  navigateToInstance?: boolean;
  /** true: as `navigateToInstance` false on the object page (FE: the scrolling applies only to table actions). */
  enableAutoScroll?: boolean;
}

/**
 * A header or footer action (ManifestAction). With the key of an annotation action ("DataFieldForAction::Namespace.action")
 * it overrides that action: `text`, `visible`, `enabled`, `position`, `priority`, `group`, `overflowGroup`, `menu`,
 * `isPrimaryAction`, `defaultValuesFunction` and `afterExecution` (FE getActionOverrideConfig).
 */
export interface HeaderFooterManifestAction extends ManifestAction {
  /**
   * Annotation actions: default values of the parameter dialog, by parameter name; they take precedence over the
   * other defaults (FE OperationParameters getManifestFunctionValues). FE names an extension function called with the
   * contexts, here it is the function itself (react-idiom).
   */
  defaultValuesFunction?(e: { contexts: Context[] }): Row | Promise<Row>;
  /** Annotation actions: what happens after the action (FE EditFlow invokeAction). */
  afterExecution?: ActionAfterExecutionConfiguration;
  /** As in FE without effect in the header and the footer: only sub-section actions move into a form (`facetName`). */
  inline?: boolean;
  /** As in FE without effect in the header and the footer: the form a sub-section action moves into (with `inline`). */
  facetName?: string;
}

/** Event of a table action (the selected rows). */
export interface ObjectPage$TableActionPressEvent {
  selectedContexts: Context[];
}

/** An action of a sub-object table (`controlConfiguration › <nav>/@UI.LineItem › actions`, as the list report's). */
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
  /** With `menu`: the key of the action run by the menu button itself (a split button, FE ActionsTemplating getMenuButton). */
  defaultAction?: string;
  /** Overflow priority in the table toolbar (sap.m.OverflowToolbarPriority). */
  priority?: OverflowToolbarPriority;
  /** Overflow group (used when there is no `overflowGroup`). */
  group?: number;
  /** Overflow group: the actions of a group move into the overflow together; `overflowGroups` adds separators. */
  overflowGroup?: number;
  /**
   * Accepted as in FE, without effect in the table toolbar: FE 1.154 emphasizes manifest primary actions only in the
   * page header and footer (applyManifestPrimaryActionEmphasis); the table toolbar keeps its Transparent buttons.
   */
  isPrimaryAction?: boolean;
  /**
   * Custom content placed in the table toolbar instead of a button (FE ActionsTemplating getCustomToolbarContent; FE
   * names a fragment, here it is a render function, react-idiom).
   */
  template?(): ReactNode;
}

/**
 * A custom column, or the override of an annotation column (key "DataField::Path"): the same settings as the list
 * report's table (FE CustomDefinedTableColumn / CustomDefinedTableColumnForOverride, ./tableManifest).
 */
export type TableManifestColumn = $ManifestColumnSettings;

/** Creation of sub-objects (`tableSettings › creationMode`). */
export interface TableCreationModeConfiguration {
  /**
   * NewPage: create and open the sub-object page; Inline / InlineCreationRows: a new row in the table; CreationDialog:
   * a dialog. FE default NewPage; without a route to the sub-object page (smart-kit: no `navigation` entry and
   * NavigationAdapter.hasObjectPage false) Inline. @defaultValue "NewPage"
   */
  name?: 'NewPage' | 'Inline' | 'InlineCreationRows' | 'CreationDialog' | 'External' | 'AddViaValueHelp' | 'Sync' | 'Async' | 'Deferred' | 'CreationRow';
  /** "CreationDialog": the comma-separated properties the dialog asks. */
  creationFields?: string;
  /** "Inline": the new row is created at the end of the table instead of the top (FE: default false for Inline). */
  createAtEnd?: boolean;
}

/** `tableSettings` of a sub-object table (TableManifestSettingsConfiguration). */
export interface TableManifestSettingsConfiguration {
  /** Table type; default by the annotations (analytical, tree), else ResponsiveTable. */
  type?: 'ResponsiveTable' | 'GridTable' | 'AnalyticalTable' | 'TreeTable';
  /** Tree tables: leaves cannot be selected. @defaultValue false */
  disableLeafSelection?: boolean;
  /** Tree tables: qualifier of Aggregation.RecursiveHierarchy (default: the type's first hierarchy). */
  hierarchyQualifier?: string;
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
  /** Grid tables: the rows shown (FE: GridTable 5, TreeTable / AnalyticalTable 10). */
  rowCount?: number;
  /** Responsive tables: the "select all" check box. */
  selectAll?: boolean;
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
  /** Ctrl+V on the table creates rows from the pasted lines while editing (object page: true). */
  enablePaste?: boolean;
  /** Pasted values also fill computed properties. */
  enablePastingOfComputedProperties?: boolean;
  /** "Edit" of the selected rows in one dialog; an object limits the fields (comma-separated) and sets the grouping. @defaultValue false */
  enableMassEdit?: boolean | {
    visibleFields?: string;
    ignoredFields?: string;
    /** @defaultValue "ChangeSet" */
    operationGroupingMode?: 'ChangeSet' | 'Isolated';
    /** Further content of the dialog (FE: a fragment name; react-idiom). */
    customFragment?(): ReactNode;
  };
  /** Quick filters: a segmented button (≤ 3) or a select (> 3) of selection variants in the table toolbar. */
  quickVariantSelection?: {
    /** Annotation paths of UI.SelectionVariant (or UI.SelectionPresentationVariant) annotations of the sub-object. */
    paths: { annotationPath: string }[];
    /** Counts in the texts. */
    showCounts?: boolean;
    /** Hides the table title. @defaultValue false */
    hideTableTitle?: boolean;
  };
  /** Analytical tables: how the leaves are read. */
  analyticalConfiguration?: {
    /** The leaves are aggregated by the shown properties. @defaultValue false */
    aggregationOnLeafLevel?: boolean;
  };
  /** Further properties read with the rows. */
  additionalProperties?: string[];
  /** A row was pressed (FE names an extension function; react-idiom). Default: navigation to the sub-object page. */
  rowPress?(e: Table$RowPressEvent): void;
  /** The selection changed (FE names an extension function; react-idiom). */
  selectionChange?(e: Table$SelectionChangeEvent): void;
}

/** `controlConfiguration › <nav>/@com.sap.vocabularies.UI.v1.LineItem` (TableManifestConfiguration). */
export interface TableManifestConfiguration {
  tableSettings?: TableManifestSettingsConfiguration;
  /** Custom and overridden columns by key. */
  columns?: Record<string, TableManifestColumn>;
  /** Custom and overridden actions by key. */
  actions?: Record<string, TableManifestAction>;
  /** Separators of the toolbar actions' overflow groups, by group number. */
  overflowGroups?: Record<string, OverflowGroupConfiguration>;
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
  /** Separators of the toolbar actions' overflow groups, by group number. */
  overflowGroups?: Record<string, OverflowGroupConfiguration>;
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
  /** Separators of the toolbar actions' overflow groups, by group number (FE SubSection getFacetActions). */
  overflowGroups?: Record<string, OverflowGroupConfiguration>;
  /** false: behind "Show More". @defaultValue true */
  isPartOfPreview?: boolean;
  /**
   * An annotation section: a form container whose only field is a multi-line text shows it without its label
   * (FE ObjectPageConverter getUseSingleTextAreaFieldAsNotes). @defaultValue false
   */
  useSingleTextAreaFieldAsNotes?: boolean;
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
  actions?: Record<string, HeaderFooterManifestAction>;
  /** Separators of the header actions' overflow groups, by group number (FE addSeparators). */
  overflowGroups?: Record<string, OverflowGroupConfiguration>;
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
    actions?: Record<string, HeaderFooterManifestAction>;
    /** Separators of the footer actions' overflow groups, by group number (FE addSeparators). */
    overflowGroups?: Record<string, OverflowGroupConfiguration>;
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
  /** Overflow priority of the share button in the header toolbar (FE Actions.fragment.xml macro:Share). @defaultValue "High" */
  shareOverflowPriority?: OverflowToolbarPriority;
}
