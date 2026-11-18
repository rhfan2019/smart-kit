/**
 * `contextPath` / `metaPath` of the chart building blocks (docs/30 §5.2): the entity set path ("/Orders", "/Orders/_Items")
 * and the annotation path ("@com.sap.vocabularies.UI.v1.Chart#Q", alias "@UI.Chart#Q", optionally after a navigation:
 * "_Items/@UI.Chart#Q").
 */
import type { ChartModel, MetaModel } from '@rhfan2019/smart-kit-core';

const UI_NAMESPACE = 'com.sap.vocabularies.UI.v1.';

/** Splits an annotation path into navigation, term (without the UI namespace or alias) and qualifier. */
export function splitMetaPath(metaPath: string): { navigation: string; term: string; qualifier: string } {
  const at = metaPath.indexOf('@');
  const navigation = at > 0 ? metaPath.slice(0, at).replace(/\/$/, '') : '';
  const annotation = at >= 0 ? metaPath.slice(at + 1) : metaPath;
  const [termPart, qualifier = ''] = annotation.split('#');
  const term = termPart!.startsWith(UI_NAMESPACE) ? termPart!.slice(UI_NAMESPACE.length) : termPart!.replace(/^UI\./, '');
  return { navigation, term, qualifier };
}

/** Entity set and entity type of a context path ("/Orders" or "/Orders/_Items"); undefined when it does not resolve. */
export function resolveContextPath(model: MetaModel, contextPath: string): { entitySet: string; typeName: string; navigation: string } | undefined {
  const [set, ...navs] = contextPath.replace(/^\//, '').split('/').filter(Boolean);
  const es = set ? model.entitySets[set] : undefined;
  if (!es) return undefined;
  let typeName = es.typeName;
  for (const n of navs) {
    const nav = model.entityTypes[typeName]?.navigations[n];
    if (!nav) return undefined;
    typeName = nav.targetType;
  }
  return { entitySet: es.name, typeName, navigation: navs.join('/') };
}

/**
 * The UI.Chart a metaPath points to, relative to the entity type `typeName`: a UI.Chart, or a UI.PresentationVariant /
 * UI.SelectionPresentationVariant whose visualizations contain one (as sap.fe.macros.Chart accepts). A navigation
 * before the annotation is kept in `ChartModel.navigation` (micro charts over a collection).
 */
export function resolveChartMetaPath(model: MetaModel, typeName: string, metaPath: string): ChartModel | undefined {
  const { navigation, term, qualifier } = splitMetaPath(metaPath);
  let target = typeName;
  for (const n of navigation ? navigation.split('/') : []) {
    const nav = model.entityTypes[target]?.navigations[n];
    if (!nav) return undefined;
    target = nav.targetType;
  }
  const ui = model.ui[target];
  if (!ui) return undefined;
  let chart: ChartModel | undefined;
  if (term === 'Chart') chart = ui.charts[qualifier];
  else if (term === 'SelectionPresentationVariant') chart = ui.views.find((v) => v.id === qualifier)?.chart;
  else if (term === 'PresentationVariant') {
    const q = ui.presentationVariants[qualifier]?.chartQualifier;
    chart = q !== undefined ? ui.charts[q] : undefined;
  }
  return chart && navigation ? { ...chart, navigation } : chart;
}
