/** Default derivation for missing UI annotations. See docs/04-model-spec.md §5. */
import { humanize, pluralize } from './labels';
import type {
  ColumnModel,
  EntityTypeModel,
  EntityUi,
  FieldModel,
  HeaderFacetModel,
  HeaderInfoModel,
  InitialCondition,
  PresentationModel,
  PropertyModel,
  SectionModel,
  SubSectionModel,
} from './types';

/** Id of the derived "General Information" section; its label is supplied by the UI layer (i18n). */
export const DERIVED_GENERAL_SECTION = 'GeneralInformation';

const NON_DISPLAYABLE = /^(Edm\.Stream|Edm\.Binary|Edm\.Geography.*|Edm\.Geometry.*|Edm\.Untyped)$/;
const MAX_COLUMNS = 8;
const MAX_SELECTION_FIELDS = 6;
const FORM_GROUP_SIZE = 6;

function isDisplayable(p: PropertyModel): boolean {
  return !p.hidden && !NON_DISPLAYABLE.test(p.edmType) && !p.edmType.startsWith('Collection(') && p.edmType.startsWith('Edm.');
}

/** Properties that are only shown as part of another field (text and unit of measure). */
function companions(et: EntityTypeModel): Set<string> {
  const out = new Set<string>();
  for (const p of Object.values(et.properties)) {
    if (p.text && !p.text.includes('/')) out.add(p.text);
    if (p.unit && 'path' in p.unit && !p.unit.path.includes('/')) out.add(p.unit.path);
  }
  return out;
}

function fieldFor(p: PropertyModel, semanticKey: string[]): FieldModel {
  return { id: `DataField::${p.name}`, kind: 'field', path: p.name, label: p.label, criticality: p.criticality, criticalityIcon: true, isSemanticKey: semanticKey.includes(p.name) };
}

export function deriveColumns(et: EntityTypeModel, _types: Record<string, EntityTypeModel>, semanticKey: string[] = []): ColumnModel[] {
  const skip = companions(et);
  const ordered = [...et.keys, ...et.propertyOrder.filter((n) => !et.keys.includes(n))];
  return ordered
    .map((n) => et.properties[n]!)
    .filter((p) => p && isDisplayable(p) && !skip.has(p.name))
    .slice(0, MAX_COLUMNS)
    .map((p) => fieldFor(p, semanticKey));
}

function deriveSelectionFields(et: EntityTypeModel): string[] {
  const ok = (p: PropertyModel | undefined): p is PropertyModel => Boolean(p) && isDisplayable(p!) && !p!.hiddenFilter;
  const keys = et.keys.filter((k) => ok(et.properties[k]));
  const withValueList = et.propertyOrder.filter((n) => !et.keys.includes(n) && ok(et.properties[n]) && et.properties[n]!.valueList);
  if (withValueList.length) return [...keys, ...withValueList].slice(0, MAX_SELECTION_FIELDS);
  const strings = et.propertyOrder.filter((n) => !et.keys.includes(n) && ok(et.properties[n]) && et.properties[n]!.edmType === 'Edm.String').slice(0, 3);
  return [...keys, ...strings].slice(0, MAX_SELECTION_FIELDS);
}

function deriveHeaderInfo(et: EntityTypeModel, semanticKey: string[]): HeaderInfoModel {
  const typeName = humanize(et.name);
  const strings = et.propertyOrder.filter((n) => et.properties[n]!.edmType === 'Edm.String' && !et.properties[n]!.hidden);
  const named = strings.find((n) => /^(Name|Title)$/i.test(n)) ?? strings.find((n) => /(Name|Title)$/.test(n)) ?? strings.find((n) => /Description$/.test(n));
  const title = semanticKey[0] ?? named ?? et.keys[0];
  const description = named && named !== title ? named : undefined;
  return { typeName, typeNamePlural: pluralize(typeName), title, description };
}

function deriveSections(et: EntityTypeModel, tableFor: (navigation: string) => SubSectionModel['content'] | undefined, semanticKey: string[]): SectionModel[] {
  const fields = et.propertyOrder.map((n) => et.properties[n]!).filter(isDisplayable).map((p) => fieldFor(p, semanticKey));
  const groups = [];
  for (let i = 0; i < fields.length; i += FORM_GROUP_SIZE) {
    groups.push({ id: `${DERIVED_GENERAL_SECTION}::Group${groups.length + 1}`, fields: fields.slice(i, i + FORM_GROUP_SIZE) });
  }
  const sections: SectionModel[] = [];
  if (groups.length) {
    sections.push({
      id: DERIVED_GENERAL_SECTION,
      label: '',
      subSections: [{ id: DERIVED_GENERAL_SECTION, label: '', partOfPreview: true, content: { kind: 'form', groups } }],
    });
  }
  for (const nav of Object.values(et.navigations)) {
    if (!nav.collection) continue;
    const content = tableFor(nav.name);
    if (!content) continue;
    const id = `${nav.name}::LineItem`;
    const label = humanize(nav.name);
    sections.push({ id, label, subSections: [{ id, label, partOfPreview: true, content }] });
  }
  return sections;
}

export interface PartialUi {
  headerInfo?: HeaderInfoModel;
  lineItem?: ColumnModel[];
  selectionFields?: string[];
  presentation: PresentationModel;
  selectionVariant: InitialCondition[];
  sections?: SectionModel[];
  headerFacets: HeaderFacetModel[];
  semanticKey: string[];
}

export function deriveUi(
  et: EntityTypeModel,
  types: Record<string, EntityTypeModel>,
  p: PartialUi,
  tableFor: (navigation: string) => SubSectionModel['content'] | undefined,
): Omit<EntityUi, 'actions' | 'objectActions' | 'charts' | 'views' | 'quickView'> {
  const headerInfo = p.headerInfo ?? deriveHeaderInfo(et, p.semanticKey);
  if (p.headerInfo && !p.headerInfo.title) headerInfo.title = deriveHeaderInfo(et, p.semanticKey).title;
  return {
    headerInfo,
    lineItem: p.lineItem ?? deriveColumns(et, types, p.semanticKey),
    selectionFields: p.selectionFields ?? deriveSelectionFields(et),
    presentation: p.presentation,
    selectionVariant: p.selectionVariant,
    sections: p.sections ?? deriveSections(et, tableFor, p.semanticKey),
    headerFacets: p.headerFacets,
    semanticKey: p.semanticKey,
    derived: { lineItem: !p.lineItem, selectionFields: !p.selectionFields, headerInfo: !p.headerInfo, sections: !p.sections },
  };
}
