/**
 * Accessible landmark settings of the pages (ADR-033): sap.ui.core.AccessibleLandmarkRole and the elements given to the
 * `landmarkInfo` aggregation of sap.f.DynamicPage (DynamicPageAccessibleLandmarkInfo), sap.uxap.ObjectPageLayout
 * (ObjectPageAccessibleLandmarkInfo) and sap.f.FlexibleColumnLayout (FlexibleColumnLayoutAccessibleLandmarkInfo).
 * The elements render nothing; the page reads their properties (as UI5's renderers do) and writes the ARIA role and
 * label on its containers.
 */
import { createContext, isValidElement, type ReactNode } from 'react';

/** sap.ui.core.AccessibleLandmarkRole: the ARIA landmark role of a container (None: no landmark). */
export type AccessibleLandmarkRole = 'None' | 'Banner' | 'Main' | 'Region' | 'Navigation' | 'Search' | 'Complementary' | 'Form' | 'ContentInfo';
export const AccessibleLandmarkRole = {
  None: 'None', Banner: 'Banner', Main: 'Main', Region: 'Region', Navigation: 'Navigation', Search: 'Search',
  Complementary: 'Complementary', Form: 'Form', ContentInfo: 'ContentInfo',
} as const;

export interface $DynamicPageAccessibleLandmarkInfoSettings {
  /** Landmark role of the root container. @defaultValue 'None' */
  rootRole?: AccessibleLandmarkRole;
  /** Label of the root container's landmark. */
  rootLabel?: string;
  /** Landmark role of the content container. @defaultValue 'None' */
  contentRole?: AccessibleLandmarkRole;
  /** Label of the content container's landmark. */
  contentLabel?: string;
  /** Landmark role of the header container (title and pinned header content). @defaultValue 'None' */
  headerRole?: AccessibleLandmarkRole;
  /** Label of the header container's landmark. */
  headerLabel?: string;
  /** Landmark role of the footer container. @defaultValue 'None' */
  footerRole?: AccessibleLandmarkRole;
  /** Label of the footer container's landmark. */
  footerLabel?: string;
  /** Label of the header content region; without it "Expanded header". */
  headerContentLabel?: string;
}

/** sap.f.DynamicPageAccessibleLandmarkInfo: give it to DynamicPage's `landmarkInfo`; it renders nothing itself. */
export function DynamicPageAccessibleLandmarkInfo(_p: $DynamicPageAccessibleLandmarkInfoSettings): ReactNode {
  return null;
}

export interface $ObjectPageAccessibleLandmarkInfoSettings {
  /** Landmark role of the root container. @defaultValue 'Main' */
  rootRole?: AccessibleLandmarkRole;
  /** Label of the root container's landmark. */
  rootLabel?: string;
  /** Landmark role of the content container (the sections). @defaultValue 'None' */
  contentRole?: AccessibleLandmarkRole;
  /** Label of the content container's landmark. */
  contentLabel?: string;
  /** Landmark role of the navigation container (anchor bar or tab bar). @defaultValue 'Navigation' */
  navigationRole?: AccessibleLandmarkRole;
  /** Label of the navigation container's landmark. */
  navigationLabel?: string;
  /** Landmark role of the header container (title and pinned header content). @defaultValue 'Banner' */
  headerRole?: AccessibleLandmarkRole;
  /** Label of the header container's landmark. */
  headerLabel?: string;
  /** Landmark role of the footer container. @defaultValue 'Region' */
  footerRole?: AccessibleLandmarkRole;
  /** Label of the footer container's landmark. */
  footerLabel?: string;
  /** Label of the header content region; without it "Expanded header". */
  headerContentLabel?: string;
}

/** sap.uxap.ObjectPageAccessibleLandmarkInfo: give it to ObjectPageLayout's `landmarkInfo`; it renders nothing itself. */
export function ObjectPageAccessibleLandmarkInfo(_p: $ObjectPageAccessibleLandmarkInfoSettings): ReactNode {
  return null;
}

export interface $FlexibleColumnLayoutAccessibleLandmarkInfoSettings {
  /** Label of the first column's region; without it "First column". */
  firstColumnLabel?: string;
  /** Label of the middle column's region; without it "Middle column". */
  middleColumnLabel?: string;
  /** Label of the last column's region; without it "Last column". */
  lastColumnLabel?: string;
  /** Label of the arrow that makes the first column smaller (separator arrows); without it a predefined text. */
  firstColumnBackArrowLabel?: string;
  /** Label of the arrow that makes the first column larger; without it a predefined text. */
  middleColumnForwardArrowLabel?: string;
  /** Label of the arrow that makes the last column larger or shows it; without it a predefined text. */
  middleColumnBackArrowLabel?: string;
  /** Label of the arrow that makes the last column smaller; without it a predefined text. */
  lastColumnForwardArrowLabel?: string;
}

/** sap.f.FlexibleColumnLayoutAccessibleLandmarkInfo: give it to FlexibleColumnLayout's `landmarkInfo`; it renders nothing itself. */
export function FlexibleColumnLayoutAccessibleLandmarkInfo(_p: $FlexibleColumnLayoutAccessibleLandmarkInfoSettings): ReactNode {
  return null;
}

/** The properties of a landmark info element given to `landmarkInfo` (undefined without one). */
export function landmarkProps<T>(node: ReactNode): T | undefined {
  return isValidElement(node) ? (node.props as T) : undefined;
}

/** Role and label of one container (UI5 `_formatLandmarkInfo`): role None writes neither. */
export interface FormattedLandmark {
  role?: string;
  label?: string;
}

/** UI5 `_formatLandmarkInfo(oLandmarkInfo, sPartName)`: the lower-case role and the label; None clears both. */
export function formatLandmark(role: AccessibleLandmarkRole | undefined, label: string | undefined): FormattedLandmark {
  if (!role || role === 'None') return { role: undefined, label: undefined };
  return { role: role.toLowerCase(), label: label || undefined };
}

/** The ARIA attributes and tags of the DynamicPage containers. */
export interface PageLandmarks {
  root: { tag: 'article' | 'div'; role?: string; label?: string; roleDescription?: string };
  header: { tag: 'header' | 'div'; role?: string; label?: string };
  headerContentLabel?: string;
  content: FormattedLandmark;
  footer: { tag: 'footer' | 'div'; role?: string; label?: string };
}

/**
 * Landmarks of a DynamicPage from its `landmarkInfo` (sap.f.DynamicPageRenderer): the root is an article with the
 * role description "Dynamic Page"; header and footer are header / footer elements unless a role other than None is
 * set; without a landmark info (or with a header role) the header is labelled with the title text.
 */
export function dynamicPageLandmarks(info: $DynamicPageAccessibleLandmarkInfoSettings | undefined, titleText: string | undefined, roleDescription: string): PageLandmarks {
  const role = (r: AccessibleLandmarkRole | undefined) => r ?? 'None';
  const header = info ? formatLandmark(role(info.headerRole), info.headerLabel) : {};
  if (!info || header.role) header.label = header.label || titleText;
  return {
    root: { tag: 'article', roleDescription, ...(info ? formatLandmark(role(info.rootRole), info.rootLabel) : {}) },
    header: { tag: info && role(info.headerRole) !== 'None' ? 'div' : 'header', ...header },
    headerContentLabel: info?.headerContentLabel || undefined,
    content: info ? formatLandmark(role(info.contentRole), info.contentLabel) : {},
    footer: { tag: info && role(info.footerRole) !== 'None' ? 'div' : 'footer', ...(info ? formatLandmark(role(info.footerRole), info.footerLabel) : {}) },
  };
}

/** Texts of the ObjectPageLayout's default labels (sap.uxap messagebundle). */
export interface ObjectPageLandmarkTexts {
  /** ROOT_ARIA_LABEL_WITHOUT_TITLE + ROOT_ROLE_DESCRIPTION ("Object details Object Page"). */
  root: string;
  /** HEADER_ARIA_LABEL_WITH_TITLE / _WITHOUT_TITLE + HEADER_ROLE_DESCRIPTION. */
  header: string;
  /** FOOTER_ROLE_DESCRIPTION. */
  footer: string;
  /** NAVIGATION_ROLE_DESCRIPTION ("Sections"). */
  navigation: string;
}

/**
 * Landmarks of an ObjectPageLayout (sap.uxap.ObjectPageLayoutRenderer, ObjectPageLayoutABHelper): without a landmark
 * info the root is `main`, the header (a header element) `banner` and the footer `region`, each with its default label;
 * with one, the info's roles (defaults Main, Banner, Region, Navigation) and labels apply.
 */
export function objectPageLandmarks(info: $ObjectPageAccessibleLandmarkInfoSettings | undefined, texts: ObjectPageLandmarkTexts): PageLandmarks & { navigation?: FormattedLandmark } {
  // the UI5 defaults of the info's roles
  const i = info ? {
    ...info,
    rootRole: info.rootRole ?? 'Main', navigationRole: info.navigationRole ?? 'Navigation', headerRole: info.headerRole ?? 'Banner',
    footerRole: info.footerRole ?? 'Region', contentRole: info.contentRole ?? 'None',
  } satisfies $ObjectPageAccessibleLandmarkInfoSettings : undefined;
  const part = (r: AccessibleLandmarkRole | undefined, label: string | undefined, fallbackRole: string, fallbackLabel: string): FormattedLandmark => {
    if (!i) return { role: fallbackRole, label: fallbackLabel };
    const f = formatLandmark(r, label);
    return { role: f.role, label: f.label ?? (r !== 'None' ? fallbackLabel : undefined) };
  };
  const navigation = i ? formatLandmark(i.navigationRole, i.navigationLabel) : undefined;
  if (navigation && i?.navigationRole !== 'None') navigation.label = navigation.label ?? texts.navigation;
  return {
    root: { tag: 'div', ...part(i?.rootRole, i?.rootLabel, 'main', texts.root) },
    header: { tag: i && i.headerRole !== 'None' ? 'div' : 'header', ...part(i?.headerRole, i?.headerLabel, 'banner', texts.header) },
    headerContentLabel: i?.headerContentLabel || undefined,
    content: i ? formatLandmark(i.contentRole, i.contentLabel) : {},
    footer: { tag: i && i.footerRole !== 'None' ? 'div' : 'footer', ...part(i?.footerRole, i?.footerLabel, 'region', texts.footer) },
    navigation,
  };
}

/**
 * Landmarks an ObjectPageLayout gives to the DynamicPage it renders (instead of the DynamicPage's own). The
 * DynamicPage clears it for its content, so that nested pages use their own.
 */
export const PageLandmarkOverride = createContext<PageLandmarks | null>(null);
