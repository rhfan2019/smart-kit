/**
 * Local annotations of the demo (the overlay layer of docs/04 §3, like the annotation.xml that SAP Fiori tools
 * generate in an app): views of the purchase order list by order type. The service is not changed — the views are
 * configured here and shown with `<SmartListReport views={{ mode, ids }} />`.
 */
import type { Locale } from '@rhfan2019/smart-kit';

const TEXTS: Record<Locale, Record<string, string>> = {
  en: { NB: 'Standard Orders', FO: 'Framework Orders', UB: 'Stock Transport Orders' },
  zh: { NB: '标准订单', FO: '框架订单', UB: '库存转储订单' },
};

/** Qualifiers of the views, in display order. */
export const ORDER_TYPE_VIEWS = ['TypeNB', 'TypeFO', 'TypeUB'];

const view = (code: string, text: string) => `
    <Annotation Term="UI.SelectionPresentationVariant" Qualifier="Type${code}">
      <Record Type="UI.SelectionPresentationVariantType">
        <PropertyValue Property="Text" String="${text}"/>
        <PropertyValue Property="SelectionVariant">
          <Record Type="UI.SelectionVariantType">
            <PropertyValue Property="SelectOptions">
              <Collection>
                <Record Type="UI.SelectOptionType">
                  <PropertyValue Property="PropertyName" PropertyPath="PurchaseOrderType"/>
                  <PropertyValue Property="Ranges">
                    <Collection>
                      <Record Type="UI.SelectionRangeType">
                        <PropertyValue Property="Sign" EnumMember="UI.SelectionRangeSignType/I"/>
                        <PropertyValue Property="Option" EnumMember="UI.SelectionRangeOptionType/EQ"/>
                        <PropertyValue Property="Low" String="${code}"/>
                      </Record>
                    </Collection>
                  </PropertyValue>
                </Record>
              </Collection>
            </PropertyValue>
          </Record>
        </PropertyValue>
        <PropertyValue Property="PresentationVariant">
          <Record Type="UI.PresentationVariantType">
            <PropertyValue Property="SortOrder">
              <Collection>
                <Record Type="Common.SortOrderType">
                  <PropertyValue Property="Property" PropertyPath="OrderDate"/>
                  <PropertyValue Property="Descending" Bool="true"/>
                </Record>
              </Collection>
            </PropertyValue>
            <PropertyValue Property="Visualizations"><Collection><AnnotationPath>@UI.LineItem</AnnotationPath></Collection></PropertyValue>
          </Record>
        </PropertyValue>
      </Record>
    </Annotation>`;

/** Overlay for the purchasing services (both use the namespace "Purchasing"). */
export function purchasingOverlay(locale: Locale): string {
  const t = TEXTS[locale];
  return `<?xml version="1.0" encoding="utf-8"?>
<edmx:Edmx Version="4.0" xmlns:edmx="http://docs.oasis-open.org/odata/ns/edmx">
  <edmx:Reference Uri="https://sap.github.io/odata-vocabularies/vocabularies/UI.xml"><edmx:Include Namespace="com.sap.vocabularies.UI.v1" Alias="UI"/></edmx:Reference>
  <edmx:Reference Uri="https://sap.github.io/odata-vocabularies/vocabularies/Common.xml"><edmx:Include Namespace="com.sap.vocabularies.Common.v1" Alias="Common"/></edmx:Reference>
  <edmx:DataServices>
    <Schema xmlns="http://docs.oasis-open.org/odata/ns/edm" Namespace="local.demo">
      <Annotations Target="Purchasing.PurchaseOrder">${['NB', 'FO', 'UB'].map((c) => view(c, t[c]!)).join('')}
      </Annotations>
    </Schema>
  </edmx:DataServices>
</edmx:Edmx>`;
}
