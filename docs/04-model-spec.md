# 04 规范化模型

> 状态：现行 · 2026-11-14。代码在 `packages/core/src/csdl`、`packages/core/src/model`。

## 1. 处理流程

```text
$metadata（XML 或 JSON）           ┐
注解文件 1..n（XML 或 JSON）       ├─ CSDL JSON 先转成 CSDL XML（csdlJsonToXml）
本地覆盖层（XML、JSON 文本或对象） ┘
        │
        ▼ @sap-ux/edmx-parser  parse()：每份文件各解析一次
        ▼ @sap-ux/edmx-parser  merge(服务, 文件1, …, 覆盖层)：按顺序合并
        ▼ @sap-ux/annotation-converter  convert()：别名展开，注解解析成类型化对象，路径解析到目标
        ▼ buildModel：转成本库的规范化模型（实体集、属性、导航、能力、UI 描述）
        ▼ derive：对缺失项推导默认值
MetaModel（带 MODEL_VERSION）
```

依赖许可和版本见 `adr/008-csdl-parser.md`。

## 2. 解析

- **输入**：字符串，按第一个非空白字符判断格式（`<` 是 XML，`{` 是 JSON）。也可以直接传入 CSDL JSON 对象。
- **CSDL XML**：直接交给 `@sap-ux/edmx-parser` 的 `parse()`。它基于 `xml-js`，不依赖 DOM。
- **CSDL JSON**：`csdlJsonToXml()` 按 OASIS《CSDL JSON》与《CSDL XML》的对应关系，把它生成 XML 文本。覆盖：
  - `$Reference`（`$Include`、`$Alias`）；
  - Schema、`EntityType`、`ComplexType`、`EnumType`、属性和导航属性的各个特性；
  - `EntityContainer`、`EntitySet`、`$NavigationPropertyBinding`、`Singleton`、`Action`、`Function`、`ActionImport`、`FunctionImport`；
  - 元素上的注解和 `$Annotations`；
  - 注解表达式：常量、`$Path`、`$PropertyPath`、`$NavigationPropertyPath`、`$AnnotationPath`、`$EnumMember`、`@type` 记录、数组集合、`$Apply`、`$If`。

  测试用"同一个服务的 XML 和 JSON 两种 `$metadata` 得到相同模型"来保证转换正确（ANN-70）。
- **`edmx:Reference`**：只用于别名展开，不下载外部词汇表。

## 3. 注解合并

- **层级**：服务自带 → 注解文件（按列出顺序）→ 本地覆盖层。后者覆盖前者，由 `merge()` 的参数顺序保证。
- **粒度**：同一个「目标 + 术语 + 限定符」，后出现的整条替换先出现的，不做字段级合并。这与 SAPUI5《Additional Annotation Files》描述的行为一致：注解按整条替换，即 PUT 语义。由测试 ANN-71 固定下来；如果上游行为改变，测试会失败。
- **别名**：每份文件可以用自己的别名（例如覆盖层用 `UI`，服务用 `SAP__UI`），转换器按各文件的 `Reference` 展开成完整命名空间后再比较。
- **删除**：一期不支持用覆盖层删除注解。要隐藏某项，用对应的注解（例如 `UI.Hidden`）或积木的 `extend` 扩展点。

## 4. 模型

```ts
interface MetaModel {
  version: 1;                       // MODEL_VERSION
  namespace: string;                // 主命名空间
  entitySets: Record<string, EntitySetModel>;
  entityTypes: Record<string, EntityTypeModel>;   // 键为完整名
  annotations: AnnotationIndex;     // 合并后的原始注解，供高级用法
  warnings: ModelWarning[];         // 例如遇到草稿、无法解析的表达式
}
interface EntitySetModel {
  name: string;
  type: EntityTypeModel;
  navigationBindings: Record<string, string>;   // 导航路径 → 目标实体集
  capabilities: CapabilityModel;
  ui: EntityUi;                     // 合并了实体集和实体类型上的 UI 注解（实体集优先）
}
interface EntityTypeModel {
  name: string; fullName: string;
  keys: string[];
  properties: Record<string, PropertyModel>;
  navigations: Record<string, NavigationModel>;
  etag?: string;                    // Core.OptimisticConcurrency 或 Version 属性
}
interface PropertyModel {
  name: string;
  edmType: EdmType;                 // 'Edm.String' | 'Edm.Decimal' | ...
  nullable: boolean; maxLength?: number; precision?: number; scale?: number | 'variable';
  label: string;                    // Common.Label，缺省时由属性名推导
  text?: PathRef;                   // Common.Text
  textArrangement?: 'TextFirst' | 'TextLast' | 'TextOnly' | 'TextSeparate';
  unit?: ValueRef;                  // Measures.Unit / ISOCurrency（路径或常量），以及 isCurrency 标记
  valueList?: ValueListModel;  fixedValues: boolean;
  criticality?: ValueRef;           // UI.Criticality
  hidden: boolean; hiddenFilter: boolean;
  computed: boolean; immutable: boolean;
  isImageUrl: boolean; multiLine: boolean; isDigitSequence: boolean;
  filterable: boolean; sortable: boolean; requiredInFilter: boolean;
  filterExpression?: 'SingleValue' | 'MultiValue' | 'SingleRange' | 'MultiRange' | 'SearchExpression' | 'MultiRangeOrSearchExpression';
}
interface EntityUi {
  headerInfo: HeaderInfoModel;
  lineItem: ColumnModel[];          // 已过滤掉 Hidden 字段和一期不支持的记录类型
  selectionFields: string[];
  presentation: { sortOrder: { property: string; descending: boolean }[]; requestAtLeast: string[] };
  selectionVariant: InitialCondition[];
  facets: SectionModel[];           // 对象页区块
  headerFacets: HeaderFacetModel[];
  fieldGroups: Record<string, FieldModel[]>;    // 按限定符
  dataPoints: Record<string, DataPointModel>;
  semanticKey: string[];
  derived: { lineItem: boolean; selectionFields: boolean; headerInfo: boolean; facets: boolean };  // 哪些是推导出来的
}
```

完整定义见 `packages/core/src/model/types.ts`，本文与代码不一致时以代码为准，同时修正本文。

## 5. 默认值推导

推导只在对应注解**缺失**时发生，而且会在 `ui.derived` 里标记出来。

| 项 | 规则 |
| --- | --- |
| 标签 | `Common.Label`；缺省时把属性名拆成单词：`OrderDate` 拆成 "Order Date"，`unit_price` 拆成 "Unit Price" |
| 列（`LineItem`） | 主键，加上按声明顺序排列的基本类型属性。排除：`Edm.Stream`、`Edm.Binary`、`Edm.Geography*`、`UI.Hidden`、`Common.Text` 指向的文本属性（它会随代码显示）、作为单位或币种的属性。最多 8 列 |
| 筛选字段 | 主键（可筛选时），加上有 `ValueList` 的属性；如果都没有，取前 3 个可筛选的字符串属性。最多 6 个 |
| 页头（`HeaderInfo`） | `TypeName` 和 `TypeNamePlural` 由实体类型名推导（复数加 s）。`Title` 按顺序取：`Common.SemanticKey`；名字为 `Name`、`*Name`、`Title`、`Description` 的字符串属性；第一个主键 |
| 区块（`Facets`） | 一个 id 为 `GeneralInformation` 的区块，标题用库文案"常规信息 / General Information"，内容是全部基本类型属性的表单，按每组 6 个字段分组。另外，每个集合导航生成一个区块，内容是子表，子表的列按目标实体推导 |
| 能力 | `Filterable`、`Sortable`、`Countable`、`TopSupported`、`SkipSupported` 默认都是 true。`Searchable` 默认 **false**：OData 标准没有说服务一定支持 `$search`，只有显式声明了才显示搜索框 |
| 必填筛选 | 只来自 `FilterRestrictions/RequiredProperties` |

## 6. id 规则

| 对象 | id |
| --- | --- |
| 列 | `DataField::<路径>`，路径里的 `/` 换成 `::`；`DataFieldForAnnotation` 用 `DataFieldForAnnotation::<注解路径>`；记录里有 `ID` 时优先用它 |
| 筛选字段 | 属性路径 |
| 区块和子区块 | Facet 的 `ID`；没有时用标签生成（`Label` 去掉空格），再没有时用目标生成（`FieldGroup::Qualifier`、`导航::LineItem`） |
| 页头 Facet | 同区块 |
| 表单字段 | 同列 |
| 动作（自定义） | 使用者给定 |

同一容器内 id 重复时，在后面加 `::2`、`::3`，并写一条模型警告。

## 7. 校验

`buildModel` 不抛异常，问题都写进 `warnings`：

- 注解指向不存在的属性或导航：忽略这条记录，写警告。
- 一期不支持的记录类型（例如 `DataFieldForAction`）：忽略，写警告，级别为 `info`。
- 服务启用了草稿（`Common.DraftRoot`）：写警告"一期不支持草稿"。
- `ValueList` 的 `CollectionPath` 在服务里不存在：忽略这个值帮助，写警告。

只有 `$metadata` 本身无法解析（不是合法的 XML 或 JSON，或缺少 `EntityContainer`）时才抛出 `ModelError`。

## 8. 覆盖层格式示例

```xml
<!-- local-annotations.xml，参照 Fiori tools 生成在本地的 annotation.xml -->
<edmx:Edmx xmlns:edmx="http://docs.oasis-open.org/odata/ns/edmx" Version="4.0">
  <edmx:Reference Uri="https://sap.github.io/odata-vocabularies/vocabularies/UI.xml">
    <edmx:Include Namespace="com.sap.vocabularies.UI.v1" Alias="UI"/>
  </edmx:Reference>
  <edmx:DataServices>
    <Schema xmlns="http://docs.oasis-open.org/odata/ns/edm" Namespace="local">
      <Annotations Target="NorthwindModel.Product">
        <Annotation Term="UI.SelectionFields">
          <Collection><PropertyPath>CategoryID</PropertyPath><PropertyPath>UnitPrice</PropertyPath></Collection>
        </Annotation>
      </Annotations>
    </Schema>
  </edmx:DataServices>
</edmx:Edmx>
```

等价的 CSDL JSON 对象：

```ts
{ $Annotations: { 'NorthwindModel.Product': { '@com.sap.vocabularies.UI.v1.SelectionFields': [{ $PropertyPath: 'CategoryID' }, { $PropertyPath: 'UnitPrice' }] } } }
```

JSON 对象里也可以写 `$Reference` 来声明别名，写法同 CSDL JSON。
