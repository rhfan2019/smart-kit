import { buildModel } from '@rhfan2019/smart-kit-core';
import { describe, expect, it } from 'vitest';
import { applyLabels, mergeMetadata, MetadataDocuments } from '../src/index';
import { metadataSource } from './fixture';

const edmx = (refs: string, schema: string) =>
  `<?xml version="1.0"?><edmx:Edmx Version="4.0" xmlns:edmx="http://docs.oasis-open.org/odata/ns/edmx">${refs}<edmx:DataServices><Schema Namespace="S" xmlns="http://docs.oasis-open.org/odata/ns/edm">${schema}</Schema></edmx:DataServices></edmx:Edmx>`;
const COMMON = '<edmx:Reference Uri="c"><edmx:Include Namespace="com.sap.vocabularies.Common.v1" Alias="Common"/></edmx:Reference>';
const UI = '<edmx:Reference Uri="u"><edmx:Include Namespace="com.sap.vocabularies.UI.v1" Alias="UI"/></edmx:Reference>';
const generated = edmx(
  COMMON,
  `<EntityType Name="T"><Key><PropertyRef Name="K"/></Key><Property Name="K" Type="Edm.String" Nullable="false"/><Property Name="A" Type="Edm.String"/></EntityType>
   <EntityContainer Name="C"><EntitySet Name="Ts" EntityType="S.T"/></EntityContainer>
   <Annotations Target="S.T/K"><Annotation Term="Common.Label" String="Key from comment"/></Annotations>
   <Annotations Target="S.T/A"><Annotation Term="Common.Label" String="A from comment"/></Annotations>`,
);

describe('$metadata: generated CSDL + hand-written annotations', () => {
  it('adds the references and annotations; a hand-written annotation replaces the generated one', () => {
    const hand = edmx(COMMON + UI, `<Annotations Target="S.T/A"><Annotation Term="Common.Label" String="{{label:A}}"/><Annotation Term="UI.Hidden" Bool="true"/></Annotations>`);
    const merged = mergeMetadata({ csdl: generated, annotations: [hand] });
    expect(merged.match(/Namespace="com.sap.vocabularies.Common.v1"/g)).toHaveLength(1);
    expect(merged).toContain('Namespace="com.sap.vocabularies.UI.v1"');
    expect(merged).toContain('String="Key from comment"');
    expect(merged).not.toContain('A from comment');
    const docs = new MetadataDocuments({ csdl: generated, annotations: [hand], labels: { en: { A: 'Amount & more' }, zh: { A: '金额' } } });
    expect(docs.xml('en')).toContain('String="Amount &amp; more"');
    expect(docs.xml(docs.language('zh-CN,zh;q=0.9'))).toContain('String="金额"');
    expect(docs.language('fr')).toBe('en');
    const model = buildModel(docs.xml('zh'));
    expect(model.entityTypes['S.T']!.properties.A!.label).toBe('金额');
    expect(model.entityTypes['S.T']!.properties.A!.hidden).toBe(true);
  });

  it('refuses conflicting aliases and missing labels', () => {
    const clash = edmx('<edmx:Reference Uri="x"><edmx:Include Namespace="Other.Vocabulary" Alias="Common"/></edmx:Reference>', '');
    expect(() => mergeMetadata({ csdl: generated, annotations: [clash] })).toThrow(/alias "Common"/);
    expect(() => applyLabels('{{label:B}}', {}, 'en')).toThrow(/miss the keys: B/);
    expect(() => new MetadataDocuments({ csdl: generated, annotations: [edmx('', '<Annotations Target="S.T"><Annotation Term="Common.Label" String="{{label:X}}"/></Annotations>')] })).toThrow(/no label bundles/);
  });

  it('builds the purchasing model of apps/pg-server with the UI annotations of the test service', () => {
    const docs = new MetadataDocuments(metadataSource());
    const model = buildModel(docs.xml('en'));
    expect(Object.keys(model.entitySets).sort()).toEqual(['ItemHistory', 'Materials', 'OrderStatuses', 'Plants', 'PricingConditions', 'PurchaseOrderItems', 'PurchaseOrderTypes', 'PurchaseOrders', 'Suppliers']);
    expect(model.entitySets.PurchaseOrders!.capabilities).toMatchObject({ searchable: true, updatable: false, insertable: false, deletable: false });
    expect(model.entityTypes['Purchasing.PurchaseOrder']!.etag).toBe('Version');
    expect(model.ui['Purchasing.PurchaseOrder']!.lineItem.length).toBeGreaterThan(5);
    expect(buildModel(docs.xml('zh')).entityTypes['Purchasing.PurchaseOrder']!.properties.NetAmount!.label).toBe('净值');
  });
});
