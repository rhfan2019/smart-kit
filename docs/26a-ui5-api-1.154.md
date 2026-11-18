# 26a SAPUI5 1.154 的控件 API（核实用）

> 2026-11-17 从 SAPUI5 1.154.0 的官方 API 描述文件生成（`https://ui5.sap.com/1.154.0/test-resources/<库>/designtime/api.json`，库：sap.m、sap.ui.core、sap.ui.unified、sap.suite.ui.commons、sap.suite.ui.microchart（阶段 6 补，九个微图表控件及其元素和枚举，不含 Interactive*Chart）、sap.ui.comp、sap.ui.table；阶段 6 还补了 sap.m.p13n（Popup 和面板）、sap.m.QuickView 一族、sap.m.Table 和 sap.f / sap.uxap 的 AccessibleLandmarkInfo，见文末）。只列公开、未废弃的属性（名字:类型=默认值）、聚合、事件（参数）、非 get/set 方法；枚举只列值，标 (dep) 的已废弃。默认值有疑问时以源码（`resources/<库>/<控件>-dbg.js`）为准，见 `26` 第 6 节。
>
> 阶段 6 实现的成员（之前登记为偏差，`check:ui5` 已无未登记项）：sap.m.Button / ToggleButton / OverflowToolbarButton 的徽标（BadgeEnabler，0 不显示）；ExpandableText `hasLabelableHTMLElement`；sap.ui.unified.Currency `getFormattedValue`、`getCurrencySymbol`；sap.f.Card `getGridItemRole`；ProcessFlow `getNode`、`getLane`、`setFocusToLabel`；Timeline 的过滤和分组方法；ViewSettingsDialog 的过滤方法；DynamicDateRange 的方法和 DynamicDateOption `getGroup`；UploadSetwithTable `getDefaultFileUploader`；FeedListItem 按 FormattedText 渲染、`disableStyleAttribute`；sap.m.Table 的 `showUnread`、`modeAnimationOn`、`growingDirection`、`keyboardMode`、`itemActionCount` / `itemActionPress`、`contextMenu` / `beforeOpenContextMenu`、`swipeContent` / `swipeDirection` / `swipe`、`getSwipedItem`、`swipeOut`；DynamicPage、ObjectPageLayout、FlexibleColumnLayout 的 `landmarkInfo`，FCL 的 `autoFocus`、`columnsDistributionChange`；sap.m.p13n、sap.m.QuickView 一族和九个微图表（文末）。还没做的见 `tools/ui5-alignment/deviations.json`（如 UploadSetwithTable 的 `cloudFilePicker*`，D42）。

```text
### sap.m.MessageToast (namespace) extends 
  methods: static show(sMessage, mOptions?)
  show.mOptions: duration=3000; width='15em'; my='CenterBottom'; at='CenterBottom'; of=window; offset='0 0'; collision='fit fit'; onClose=None; autoClose=True; animationTimingFunction='ease'; animationDuration=1000; closeOnBrowserNavigation=True
### sap.m.MessageBox (namespace) extends 
  methods: static alert(vMessage, mOptions?), static confirm(vMessage, mOptions?), static error(vMessage, mOptions?), static information(vMessage, mOptions?), static show(vMessage, mOptions?), static success(vMessage, mOptions?), static warning(vMessage, mOptions?)
  alert.mOptions: onClose=-; title='Alert'; actions=sap.m.MessageBox.Action.OK; emphasizedAction=sap.m.MessageBox.Action.OK; id=-; styleClass=-; initialFocus=-; textDirection=-; verticalScrolling=-; horizontalScrolling=-; details=-; contentWidth=-; closeOnNavigation=True; dependentOn=-
  confirm.mOptions: onClose=-; title='Confirmation'; actions=sap.m.MessageBox.Action.OK; emphasizedAction=sap.m.MessageBox.Action.OK; id=-; styleClass=-; initialFocus=-; textDirection=-; verticalScrolling=-; horizontalScrolling=-; details=-; contentWidth=-; closeOnNavigation=True; dependentOn=-
  error.mOptions: onClose=-; title='Error'; actions=sap.m.MessageBox.Action.OK; emphasizedAction=sap.m.MessageBox.Action.OK; id=-; styleClass=-; initialFocus=-; textDirection=-; verticalScrolling=-; horizontalScrolling=-; details=-; contentWidth=-; closeOnNavigation=True; dependentOn=-
  information.mOptions: onClose=-; title='Information'; actions=sap.m.MessageBox.Action.OK; emphasizedAction=sap.m.MessageBox.Action.OK; id=-; styleClass=-; initialFocus=-; textDirection=-; verticalScrolling=-; horizontalScrolling=-; details=-; contentWidth=-; closeOnNavigation=True; dependentOn=-
  show.mOptions: icon=-; title=-; actions=sap.m.MessageBox.Action.OK; emphasizedAction=sap.m.MessageBox.Action.OK; onClose=-; id=-; styleClass=-; initialFocus=-; textDirection=-; verticalScrolling=-; horizontalScrolling=-; details=-; contentWidth=-; closeOnNavigation=True; dependentOn=-
  success.mOptions: onClose=-; title='Success'; actions=sap.m.MessageBox.Action.OK; emphasizedAction=sap.m.MessageBox.Action.OK; id=-; styleClass=-; initialFocus=-; textDirection=-; verticalScrolling=-; horizontalScrolling=-; details=-; contentWidth=-; closeOnNavigation=True; dependentOn=-
  warning.mOptions: onClose=-; title='Warning'; actions=sap.m.MessageBox.Action.OK; emphasizedAction=sap.m.MessageBox.Action.OK; id=-; styleClass=-; initialFocus=-; textDirection=-; verticalScrolling=-; horizontalScrolling=-; details=-; contentWidth=-; closeOnNavigation=True; dependentOn=-
### sap.m.MessageBox.Action (enum) extends 
  values: ABORT, CANCEL, CLOSE, DELETE, IGNORE, NO, OK, RETRY, YES
### sap.m.MessageBox.Icon (enum) extends 
  values: ERROR, INFORMATION, NONE, QUESTION, SUCCESS, WARNING
### sap.m.MessageStrip (class) extends sap.ui.core.Control
  props: text:string=""; type:module:sap/ui/core/message/MessageType="Information"; colorSet:m.MessageStripColorSet="Default"; colorScheme:int=1; customIcon:core.URI=""; showIcon:boolean=false; showCloseButton:boolean=false; enableFormattedText:boolean=false
  aggs: link:m.Link[0..1]; controls:m.Link[0..n]; _formattedText:m.FormattedText[0..1]; _text:m.Text[0..1]; _closeButton:m.Button[0..1]
  defaultAgg: link
  event close: 
  methods: close()
### sap.m.MessageStripColorSet (enum) extends 
  values: ColorSet1, ColorSet2, Default
### sap.m.MessageView (class) extends sap.ui.core.Control
  props: asyncDescriptionHandler:function=null; asyncURLHandler:function=null; groupItems:boolean=false; showDetailsPageHeader:boolean=true
  aggs: items:m.MessageItem[0..n]; headerButton:m.Button[0..1]; _navContainer:m.NavContainer[0..1]
  defaultAgg: items
  event itemSelect: item:m.MessageItem, messageTypeFilter:module:sap/ui/core/message/MessageType
  event listSelect: messageTypeFilter:module:sap/ui/core/message/MessageType
  event longtextLoaded: 
  event urlValidated: 
  event activeTitlePress: item:m.MessageItem
  event onClose: 
  methods: _makeAutomaticBinding(), navigateBack(), setupCustomHeader()
### sap.m.MessageItem (class) extends sap.ui.core.Item
  props: type:module:sap/ui/core/message/MessageType="Error"; title:string=""; subtitle:string=null; description:string=""; markupDescription:boolean=false; longtextUrl:core.URI=null; counter:int=null; groupName:string=""; activeTitle:boolean=false
  aggs: link:m.Link[0..1]
  defaultAgg: link
### sap.m.MessagePopover (class) extends sap.ui.core.Control
  props: asyncDescriptionHandler:function=null; asyncURLHandler:function=null; placement:m.VerticalPlacementType="Vertical"; initiallyExpanded:boolean=true; groupItems:boolean=false
  aggs: items:m.MessageItem[0..n]; headerButton:m.Button[0..1]
  defaultAgg: items
  event afterOpen: openBy:core.Control
  event afterClose: openBy:core.Control
  event beforeOpen: openBy:core.Control
  event beforeClose: openBy:core.Control
  event itemSelect: item:m.MessageItem, messageTypeFilter:module:sap/ui/core/message/MessageType
  event listSelect: messageTypeFilter:module:sap/ui/core/message/MessageType
  event longtextLoaded: 
  event urlValidated: 
  event activeTitlePress: item:m.MessageItem
  methods: close(), isOpen(), navigateBack(), openBy(oControl), toggle(oControl)
### sap.m.VerticalPlacementType (enum) extends 
  values: Bottom, Top, Vertical
### sap.ui.core.ValueState (enum) extends 
  values: Error, Information, None, Success, Warning
### sap.ui.core.MessageType (enum, deprecated) extends 
  values: Error, Information, None, Success, Warning
### sap.ui.core.IndicationColor (enum) extends 
  values: Indication01, Indication02, Indication03, Indication04, Indication05, Indication06, Indication07, Indication08, Indication09, Indication10, Indication11, Indication12, Indication13, Indication14, Indication15, Indication16, Indication17, Indication18, Indication19, Indication20
### sap.ui.core.Popup.Dock (enum) extends 
  values: BeginBottom, BeginCenter, BeginTop, CenterBottom, CenterCenter, CenterTop, EndBottom, EndCenter, EndTop, LeftBottom, LeftCenter, LeftTop, RightBottom, RightCenter, RightTop
### sap.m.EmptyIndicatorMode (enum) extends 
  values: Auto, Off, On
### sap.m.ReactiveAreaMode (enum) extends 
  values: Inline, Overlay
### sap.m.ObjectStatus (class) extends sap.ui.core.Control
  props: title:string=null; text:string=null; active:boolean=false; reactiveAreaMode:m.ReactiveAreaMode="Inline"; state:string="sap.ui.core.ValueState.None"; inverted:boolean=false; icon:core.URI=null; iconDensityAware:boolean=true; textDirection:core.TextDirection="Inherit"; emptyIndicatorMode:m.EmptyIndicatorMode="Off"; stateAnnouncementText:string=null
  assoc: ariaDescribedBy, ariaLabelledBy
  event press: 
### sap.m.ObjectIdentifier (class) extends sap.ui.core.Control
  props: title:string=null; text:string=null; visible:boolean=true; titleActive:boolean=false; reactiveAreaMode:m.ReactiveAreaMode="Inline"; textDirection:core.TextDirection="Inherit"; emptyIndicatorMode:m.EmptyIndicatorMode="Off"
  aggs: _titleControl:core.Control[0..1]; _textControl:core.Control[0..1]
  assoc: ariaLabelledBy
  event titlePress: domRef:object
### sap.m.ObjectNumber (class) extends sap.ui.core.Control
  props: number:string=null; emphasized:boolean=true; state:core.ValueState="None"; unit:string=null; textDirection:core.TextDirection="Inherit"; textAlign:core.TextAlign="Begin"; active:boolean=false; reactiveAreaMode:m.ReactiveAreaMode="Inline"; inverted:boolean=false; displayMode:m.ObjectNumberDisplayMode="Default"; maxPrecision:int=null; useSymbol:boolean=true; emptyIndicatorMode:m.EmptyIndicatorMode="Off"
  assoc: ariaLabelledBy, ariaDescribedBy
  event press: 
  methods: init()
### sap.m.ObjectNumberDisplayMode (enum) extends 
  values: Currency, Default, Unit
### sap.m.ObjectMarker (class) extends sap.ui.core.Control
  props: type:m.ObjectMarkerType=null; reactiveAreaMode:m.ReactiveAreaMode="Inline"; visibility:m.ObjectMarkerVisibility=null; additionalInfo:string=""
  aggs: _innerControl:core.Control[0..1]
  assoc: ariaDescribedBy, ariaLabelledBy
  event press: type:m.ObjectMarkerType
### sap.m.ObjectMarkerType (enum) extends 
  values: Draft, Favorite, Flagged, Locked, LockedBy, Unsaved, UnsavedBy
### sap.m.ObjectMarkerVisibility (enum) extends 
  values: IconAndText, IconOnly, TextOnly
### sap.m.Button (class) extends sap.ui.core.Control
  props: text:string=""; type:m.ButtonType="Default"; width:core.CSSSize=null; enabled:boolean=true; icon:core.URI=""; iconFirst:boolean=true; activeIcon:core.URI=null; iconDensityAware:boolean=true; textDirection:core.TextDirection="Inherit"; ariaHasPopup:core.aria.HasPopup="None"; accessibleRole:m.ButtonAccessibleRole="Default"; highlightAccKeysRef:boolean=false; accesskey:string=""; badgeStyle:m.BadgeStyle="Default"
  assoc: ariaDescribedBy, ariaLabelledBy
  event press: 
  methods: _getToolbarInteractive()
### sap.m.ToggleButton (class) extends sap.m.Button
  props: pressed:boolean=false
  event press: pressed:boolean
  methods: _getToolbarInteractive()
### sap.m.ButtonType (enum) extends 
  values: Accept, Attention, Back, Critical, Default, Emphasized, Ghost, Negative, Neutral, Reject, Success, Transparent, Unstyled, Up
### sap.m.IllustratedMessage (class) extends sap.ui.core.Control
  props: description:string=""; enableDefaultTitleAndDescription:boolean=true; enableFormattedText:boolean=false; enableVerticalResponsiveness:boolean=false; illustrationSize:m.IllustratedMessageSize="Auto"; illustrationType:string="sap.m.IllustratedMessageType.NoSearchResults"; src:core.URI=""; title:string=""; ariaTitleLevel:core.TitleLevel="Auto"; decorative:boolean=false
  aggs: additionalContent:core.Control[0..n]; _formattedText:m.FormattedText[0..1]; _illustration:m.Illustration[0..1]; _text:m.Text[0..1]; _title:m.Title[0..1]
  assoc: illustrationAriaLabelledBy, illustrationAriaDescribedBy
### sap.m.IllustratedMessageType (enum) extends 
  values: Achievement, AddColumn (dep), AddDimensions, AddingColumns, AddPeople (dep), AddPeopleToCalendar, BalloonSky (dep), BeforeSearch, Connection (dep), DragFilesToUpload, EmptyCalendar (dep), EmptyList (dep), EmptyPlanningCalendar, ErrorScreen (dep), FilteringColumns, FilterTable (dep), GroupingColumns, GroupTable (dep), KeyTask, NewMail, NoActivities, NoChartData, NoColumnsSet, NoData, NoDimensionsSet (dep), NoEntries, NoFilterResults, NoMail, NoMailV1 (dep), NoNotifications, NoSavedItems, NoSavedItemsV1 (dep), NoSearchResults, NoTasks, NoTasksV1 (dep), PageNotFound, ReceiveAppreciation, ReloadScreen (dep), ResizeColumn (dep), ResizingColumns, SearchEarth (dep), SearchFolder (dep), SignOut, SimpleBalloon (dep), SimpleBell (dep), SimpleCalendar (dep), SimpleCheckMark (dep), SimpleConnection (dep), SimpleEmptyDoc (dep), SimpleEmptyList (dep), SimpleError (dep), SimpleMagnifier (dep), SimpleMail (dep), SimpleNoSavedItems (dep), SimpleNotFoundMagnifier (dep), SimpleReload (dep), SimpleTask (dep), SleepingBell (dep), SortColumn (dep), SortingColumns, SuccessBalloon (dep), SuccessCheckMark (dep), SuccessHighFive (dep), SuccessScreen (dep), Survey, Tent (dep), UnableToLoad, UnableToLoadImage, UnableToUpload, UploadCollection (dep), UploadToCloud, UserHasSignedUp
### sap.m.IllustratedMessageSize (enum) extends 
  values: Auto, Base, Dialog (dep), Dot (dep), ExtraSmall, Large, Medium, Scene (dep), Small, Spot (dep)
### sap.m.BusyIndicator (class) extends sap.ui.core.Control
  props: text:string=""; textDirection:core.TextDirection="Inherit"; customIcon:core.URI=""; customIconRotationSpeed:int=1000; customIconDensityAware:boolean=true; customIconWidth:core.CSSSize="44px"; customIconHeight:core.CSSSize="44px"; size:core.CSSSize="1rem"
  assoc: ariaLabelledBy
### sap.m.BusyDialog (class) extends sap.ui.core.Control
  props: text:string=""; title:string=""; customIcon:core.URI=""; customIconRotationSpeed:int=1000; customIconDensityAware:boolean=true; customIconWidth:core.CSSSize="44px"; customIconHeight:core.CSSSize="44px"; cancelButtonText:string=""; showCancelButton:boolean=false; titleAlignment:m.TitleAlignment="Auto"
  assoc: ariaLabelledBy
  event close: cancelPressed:boolean
  methods: close(isClosedFromUserInteraction?), open()
### sap.m.TitleAlignment (enum) extends 
  values: Auto, Center, None, Start
### sap.ui.unified.Currency (class) extends sap.ui.core.Control
  props: value:float=0; stringValue:string=null; currency:string=null; maxPrecision:int=null; useSymbol:boolean=true; emptyIndicatorMode:m.EmptyIndicatorMode="Off"
  methods: init()
### sap.m.ExpandableText (class) extends sap.ui.core.Control
  props: text:string=""; textDirection:core.TextDirection="Inherit"; wrappingType:m.WrappingType="Normal"; textAlign:core.TextAlign="Begin"; renderWhitespace:boolean=false; overflowMode:m.ExpandableTextOverflowMode="InPlace"; maxCharacters:int=100; expanded:boolean=false; emptyIndicatorMode:m.EmptyIndicatorMode="Off"
  aggs: _showMoreLink:m.Link[0..1]; _ariaLabelledBy:core.InvisibleText[0..1]
  methods: hasLabelableHTMLElement()
### sap.m.ExpandableTextOverflowMode (enum) extends 
  values: InPlace, Popover
### sap.m.Toolbar (class) extends sap.ui.core.Control
  props: width:core.CSSSize=null; active:boolean=false; enabled:boolean=true; height:core.CSSSize=""; design:m.ToolbarDesign="Auto"; style:m.ToolbarStyle="Standard"; ariaHasPopup:string=null
  aggs: content:core.Control[0..n]; _activeButton:m.Button[0..1]
  defaultAgg: content
  assoc: ariaLabelledBy
  event press: srcControl:core.Control
  methods: _applyContextClassFor(), _applyTag(), applyTagAndContextClassFor(), isContextSensitive()
### sap.m.OverflowToolbar (class) extends sap.m.Toolbar
  props: asyncMode:boolean=false
  aggs: _overflowButton:m.ToggleButton[0..1]; _popover:m.Popover[0..1]
  methods: _getVisibleAndNonOverflowContent(), _moveControlInSuitableCollection(oControl, sPriority), _removeContentFromControlsCollections(oControl), closeOverflow()
### sap.m.OverflowToolbarLayoutData (class) extends sap.m.ToolbarLayoutData
  props: priority:m.OverflowToolbarPriority="High"; group:int=0; closeOverflowOnInteraction:boolean=true
### sap.m.OverflowToolbarPriority (enum) extends 
  values: Always (dep), AlwaysOverflow, Disappear, High, Low, Never (dep), NeverOverflow
### sap.m.ToolbarSpacer (class) extends sap.ui.core.Control
  props: width:core.CSSSize=""
### sap.m.ToolbarDesign (enum) extends 
  values: Auto, Info, Solid, Transparent
### sap.m.ToolbarStyle (enum) extends 
  values: Clear, Standard
### sap.suite.ui.commons.ProcessFlow (class) extends sap.ui.core.Control
  props: foldedCorners:boolean=false; scrollable:boolean=true; wheelZoomable:boolean=true; showLabels:boolean=false
  aggs: _connections:sap.suite.ui.commons.ProcessFlowConnection[0..n]; nodes:sap.suite.ui.commons.ProcessFlowNode[0..n]; lanes:sap.suite.ui.commons.ProcessFlowLaneHeader[0..n]; ariaProperties:sap.suite.ui.commons.AriaProperties[0..1]
  defaultAgg: lanes
  event nodePress: oEvent:object
  event labelPress: oEvent:object
  event headerPress: oEvent:object
  event onError: oEvent:object
  methods: applyNodeDisplayState(), optimizeLayout(isOptimized), updateModel(), updateNodesOnly(), zoomIn(), zoomOut()
### sap.suite.ui.commons.ProcessFlowLaneHeader (class) extends sap.ui.core.Control
  props: text:string=null; iconSrc:core.URI=null; position:int=null; laneId:string=null; state:object=null; zoomLevel:sap.suite.ui.commons.ProcessFlowZoomLevel=null
  event press: oEvent:object
### sap.suite.ui.commons.ProcessFlowNode (class) extends sap.ui.core.Control
  props: title:string=null; laneId:string=null; nodeId:string=null; state:sap.suite.ui.commons.ProcessFlowNodeState="Neutral"; type:sap.suite.ui.commons.ProcessFlowNodeType="Single"; children:any[]=null; titleAbbreviation:string=null; stateText:string=null; texts:string[]=null; highlighted:boolean=false; focused:boolean=false; tag:object=null; selected:boolean=false
  aggs: zoomLevelOneContent:core.Control[0..1]; zoomLevelTwoContent:core.Control[0..1]; zoomLevelThreeContent:core.Control[0..1]; zoomLevelFourContent:core.Control[0..1]; ariaProperties:sap.suite.ui.commons.AriaProperties[0..1]
  assoc: parents
### sap.suite.ui.commons.ProcessFlowNodeState (enum) extends 
  values: Critical, Negative, Neutral, Planned, PlannedNegative, Positive
### sap.suite.ui.commons.ProcessFlowZoomLevel (enum) extends 
  values: Four, One, Three, Two
### sap.suite.ui.commons.ProcessFlowConnectionLabel (class) extends sap.m.Button
  props: priority:int=0; state:sap.suite.ui.commons.ProcessFlowConnectionLabelState="Neutral"
### sap.suite.ui.commons.MicroProcessFlow (class) extends sap.ui.core.Control
  props: ariaLabel:string=null; renderType:sap.suite.ui.commons.MicroProcessFlowRenderType="Wrap"; width:core.CSSSize=""
  aggs: content:sap.suite.ui.commons.MicroProcessFlowItem[0..n]
### sap.suite.ui.commons.MicroProcessFlowItem (class) extends sap.ui.core.Control
  props: key:string=null; icon:string=null; title:string=null; state:core.ValueState="Standard"; showIntermediary:boolean=false; stepWidth:core.CSSSize=null; showSeparator:boolean=true
  aggs: customControl:core.Control[0..1]; intermediary:core.Control[0..1]
  event press (preventable): item:object
### sap.suite.ui.commons.MicroProcessFlowRenderType (enum) extends 
  values: NoWrap, Scrolling, ScrollingWithResizer, Wrap
### sap.suite.ui.commons.Timeline (class) extends sap.ui.core.Control
  props: alignment:sap.suite.ui.commons.TimelineAlignment="Right"; axisOrientation:sap.suite.ui.commons.TimelineAxisOrientation="Vertical"; enableBusyIndicator:boolean=true; enableDoubleSided:boolean=false; enableModelFilter:boolean=true; enableScroll:boolean=true; enableSocial:boolean=false; filterTitle:string=null; forceGrowing:boolean=false; groupBy:string=null; groupByType:sap.suite.ui.commons.TimelineGroupType="None"; growingThreshold:int=5; height:core.CSSSize=""; lazyLoading:boolean=false; noDataText:string=null; showHeaderBar:boolean=true; showIcons:boolean=true; showItemFilter:boolean=true; showSearch:boolean=true; showSort:boolean=true; showTimeFilter:boolean=true; sort:boolean=true; dateTimePath:string=""; sortOldestFirst:boolean=false; textHeight:string=""; width:core.CSSSize="100%"
  aggs: content:sap.suite.ui.commons.TimelineItem[0..n]; customFilter:core.Control[0..1]; filterList:sap.suite.ui.commons.TimelineFilterListItem[0..n]
  defaultAgg: content
  assoc: ariaLabelledBy
  event customMessageClosed: 
  event filterOpen: 
  event filterSelectionChange: type:sap.suite.ui.commons.TimelineFilterType, searchTerm:string, selectedItem:string, selectedItems:object, timeKeys:object, clear:boolean
  event grow: 
  event itemFiltering: item:sap.suite.ui.commons.TimelineItem, reasons:object, dataKeys:object, timeKeys:object, searchTerm:string
  event select: selectedItem:sap.suite.ui.commons.TimelineItem, userAction:boolean
  methods: adjustUI(), exit(), reset(), resetTimeLimits()
### sap.suite.ui.commons.TimelineItem (class) extends sap.ui.core.Control
  props: dateTime:any=null; filterValue:string=null; icon:string=null; iconDisplayShape:m.AvatarShape="Circle"; iconInitials:string=""; iconSize:m.AvatarSize="XS"; iconTooltip:string=null; useIconTooltip:boolean=true; maxCharacters:int=null; replyCount:int=null; status:string=null; title:string=null; text:string=null; userName:string=null; userNameClickable:boolean=false; userPicture:core.URI=null
  aggs: customAction:core.CustomData[0..n]; customReply:core.Control[0..1]; embeddedControl:core.Control[0..1]; replyList:m.List[0..1]
  defaultAgg: embeddedControl
  assoc: ariaLabelledBy
  event userNameClicked: uiElement:core.Control
  event select: 
  event press: 
  event replyPost: value:string
  event replyListOpen: 
  event customActionClicked: value:string, key:string, linkObj:m.Link
### sap.suite.ui.commons.TimelineAxisOrientation (enum) extends 
  values: Horizontal, Vertical
### sap.suite.ui.commons.TimelineGroupType (enum) extends 
  values: Day, Month, None, Quarter, Week, Year
### sap.suite.ui.commons.TimelineAlignment (enum) extends 
  values: Bottom, Left, Right, Top
### sap.m.FeedInput (class) extends sap.ui.core.Control
  props: enabled:boolean=true; rows:int=2; showExceededText:boolean=false; maxLength:int=0; growing:boolean=false; growingMaxLines:int=0; placeholder:string="Post something here"; value:string=null; icon:core.URI=null; iconDisplayShape:m.AvatarShape="Circle"; iconInitials:string=""; iconSize:m.AvatarSize="M"; showIcon:boolean=true; buttonTooltip:core.TooltipBase|string="Submit"
  aggs: _avatar:m.Avatar[0..1]; actions:core.Control[0..n]
  event post: value:string
### sap.m.FeedListItem (class) extends sap.m.ListItemBase
  props: icon:core.URI=null; iconDisplayShape:m.AvatarShape="Circle"; iconInitials:string=""; iconSize:m.AvatarSize="S"; activeIcon:core.URI=null; sender:string=null; text:string=null; moreLabel:string=null; lessLabel:string=null; info:string=null; timestamp:string=null; senderActive:boolean=true; iconActive:boolean=true; showIcon:boolean=true; convertLinksToAnchorTags:m.LinkConversion="None"; convertedLinksDefaultTarget:string="_blank"; maxCharacters:int=null; disableStyleAttribute:boolean=false
  aggs: _text:m.FormattedText[0..1]; _menu:m.Menu[0..1]; _actionButton:m.Button[0..1]; _avatar:m.Avatar[0..1]
  event senderPress: domRef:string, getDomRef:function
  event iconPress: domRef:string, getDomRef:function
### sap.m.ListItemBase (class) extends sap.ui.core.Control
  props: type:m.ListType="Inactive"; visible:boolean=true; unread:boolean=false; selected:boolean=false; counter:int=null; highlight:string="None"; highlightText:string=""; navigated:boolean=false
  aggs: actions:m.ListItemActionBase[0..n]
  defaultAgg: actions
  assoc: ariaLabelledBy
  event press: 
  event detailPress: 
### sap.m.ListItemActionBase (class) extends sap.ui.core.Element
  props: icon:core.URI=""; text:string=""; visible:boolean=true
### sap.m.FeedListItemAction (class) extends sap.m.ListItemActionBase
  props: key:string=""; enabled:boolean=true
  event press: 
### sap.m.AvatarSize (enum) extends 
  values: Custom, L, M, S, XL, XS
### sap.m.AvatarShape (enum) extends 
  values: Circle, Square
### sap.m.upload.UploadSet (class, deprecated) extends sap.ui.core.Control
  props: fileTypes:string[]=null; maxFileNameLength:int=null; maxFileSize:float=null; mediaTypes:string[]=null; dragDropText:string=null; dragDropDescription:string=null; instantUpload:boolean=true; showIcons:boolean=true; terminationEnabled:boolean=true; uploadEnabled:boolean=true; uploadUrl:string=null; uploadButtonInvisible:boolean=false; sameFilenameAllowed:boolean=false; httpRequestMethod:m.upload.UploaderHttpRequestMethod="Post"; multiple:boolean=false; mode:m.ListMode="MultiSelect"; cloudFilePickerEnabled:boolean=false; cloudFilePickerServiceUrl:core.URI=""; cloudFilePickerButtonText:string=""; directory:boolean=false
  aggs: items:m.upload.UploadSetItem[0..n]; incompleteItems:m.upload.UploadSetItem[0..n]; headerFields:core.Item[0..n]; toolbar:m.OverflowToolbar[0..1]; uploader:m.upload.Uploader[0..1]; illustratedMessage:m.IllustratedMessage[0..1]
  defaultAgg: items
  event afterItemAdded: item:m.upload.UploadSetItem
  event fileRenamed: item:m.upload.UploadSetItem
  event afterItemRemoved: item:m.upload.UploadSetItem
  event afterItemEdited: item:m.upload.UploadSetItem
  event beforeItemAdded (preventable): item:m.upload.UploadSetItem
  event beforeItemRemoved (preventable): item:m.upload.UploadSetItem
  event beforeItemEdited (preventable): item:m.upload.UploadSetItem
  event beforeUploadStarts (preventable): item:m.upload.UploadSetItem
  event uploadCompleted: item:m.upload.UploadSetItem, response:string, readyState:int, status:int, responseXML:string, headers:object
  event beforeUploadTermination (preventable): item:m.upload.UploadSetItem
  event uploadTerminated: item:m.upload.UploadSetItem
  event fileTypeMismatch: item:m.upload.UploadSetItem
  event fileNameLengthExceeded: item:m.upload.UploadSetItem
  event fileSizeExceeded: item:m.upload.UploadSetItem, fileSize:float
  event mediaTypeMismatch: item:m.upload.UploadSetItem
  event selectionChanged: items:m.upload.UploadSetItem[]
  event itemDragStart: 
  event itemDrop: 
  methods: openFileDialog(item), registerUploaderEvents(oUploader), selectAll(), upload(), uploadItem(oItem)
### sap.m.upload.UploadSetItem (class, deprecated) extends sap.ui.core.Element
  props: enabledRemove:boolean=true; enabledEdit:boolean=true; fileName:string=null; mediaType:string=null; thumbnailUrl:string=null; uploadState:m.UploadState=null; url:string=null; visibleRemove:boolean=true; visibleEdit:boolean=true; uploadUrl:string=null; selected:boolean=false
  aggs: attributes:m.ObjectAttribute[0..n]; markers:m.ObjectMarker[0..n]; statuses:m.ObjectStatus[0..n]; markersAsStatus:m.ObjectStatus[0..n]; headerFields:core.Item[0..n]
  defaultAgg: attributes
  event openPressed (preventable): item:m.upload.UploadSetItem
  event removePressed (preventable): item:m.upload.UploadSetItem
  methods: download(bAskForLocation), isRestricted()
### sap.m.plugins.UploadSetwithTable (class) extends sap.ui.core.Element
  props: fileTypes:string[]=null; maxFileNameLength:int=null; maxFileSize:float=null; mediaTypes:string[]=null; uploadUrl:string=null; httpRequestMethod:m.upload.UploaderHttpRequestMethod="Post"; multiple:boolean=false; uploadButtonInvisible:boolean=false; uploadEnabled:boolean=true; itemValidationHandler:function=null; directory:boolean=false; cloudFilePickerEnabled:boolean=false; cloudFilePickerServiceUrl:core.URI=""; cloudFilePickerButtonText:string=""; fileNameValidationConfig:m.plugins.UploadSetwithTable.FilenameValidationConfig=null
  aggs: uploader:m.upload.UploaderTableItem[0..1]; headerFields:core.Item[0..n]; rowConfiguration:m.upload.UploadItemConfiguration[0..1]; noDataIllustration:m.IllustratedMessage[0..1]
  defaultAgg: rowConfiguration
  assoc: previewDialog, actions
  event itemRenamed: item:m.upload.UploadItem
  event itemRenameCanceled: item:m.upload.UploadItem
  event beforeUploadStarts (preventable): item:m.upload.UploadItem
  event uploadCompleted: item:m.upload.UploadItem, response:string, readyState:string, status:string, responseXML:string, responseText:string, headers:object
  event fileTypeMismatch: item:m.upload.UploadItem
  event fileNameLengthExceeded: item:m.upload.UploadItem
  event fileSizeExceeded: item:m.upload.UploadItem
  event mediaTypeMismatch: item:m.upload.UploadItem
  event beforeInitiatingItemUpload: item:m.upload.UploadItem
  event onActivated: oPlugin:m.plugins.UploadSetwithTable
  event onDeactivated: control:core.Control
  methods: download(oBindingContext, bAskForLocation), fileSelectionHandler(), static findOn(oElement), openFilePreview(oBindingContext), registerUploaderEvents(oUploader), renameItem(oBindingContext), uploadItemViaUrl(sName, sUrl, oPromise), uploadItemWithoutFile(oPromise)
### sap.m.upload.UploadItem (class) extends sap.ui.core.Element
  props: fileName:string=null; mediaType:string=null; url:string=null; uploadUrl:string=null; uploadState:m.UploadState=null; previewable:boolean=true; fileSize:float=0; isTrustedSource:boolean=false; isDirectory:boolean=false
  aggs: headerFields:core.Item[0..n]
  event uploadProgress: loaded:int, total:int
  event uploadTerminated: item:m.upload.UploadItem
  methods: download(bAskForLocation), isRestricted(), terminateUpload()
### sap.m.UploadState (enum) extends 
  values: Complete, Error, Ready, Uploading
### sap.m.upload.UploaderHttpRequestMethod (enum) extends 
  values: Post, Put
### sap.m.ObjectAttribute (class) extends sap.ui.core.Control
  props: title:string=null; text:string=null; active:boolean=null; reactiveAreaMode:m.ReactiveAreaMode="Inline"; textDirection:core.TextDirection="Inherit"; ariaHasPopup:core.aria.HasPopup="None"
  aggs: customContent:core.Control[0..1]; _textControl:core.Control[0..1]
  event press: domRef:string
### sap.m.DynamicDateRange (class) extends sap.ui.core.Control
  props: value:object=null; width:core.CSSSize=null; enabled:boolean=true; valueState:core.ValueState="None"; name:string=null; placeholder:string=null; editable:boolean=true; valueStateText:string=null; required:boolean=false; enableGroupHeaders:boolean=true; formatter:object=null; standardOptions:string[]=["DATE", "TODAY", "YESTERDAY", "TOMORROW", "FIRSTDAYWEEK", "LASTDAYWEEK", "FIRSTDAYMONTH", "LASTDAYMONTH", "FIRSTDAYQUARTER", "LASTDAYQUARTER", "FIRSTDAYYEAR", "LASTDAYYEAR", "DATERANGE", "DATETIMERANGE", "FROM", "TO", "FROMDATETIME", "TODATETIME", "YEARTODATE", "DATETOYEAR", "LASTMINUTES", "LASTHOURS", "LASTDAYS", "LASTWEEKS", "LASTMONTHS", "LASTQUARTERS", "LASTYEARS", "LASTMINUTESINCLUDED", "LASTHOURSINCLUDED", "LASTDAYSINCLUDED", "LASTWEEKSINCLUDED", "LASTMONTHSINCLUDED", "LASTQUARTERSINCLUDED", "LASTYEARSINCLUDED", "NEXTMINUTES", "NEXTHOURS", "NEXTDAYS", "NEXTWEEKS", "NEXTMONTHS", "NEXTQUARTERS", "NEXTYEARS", "NEXTMINUTESINCLUDED", "NEXTHOURSINCLUDED", "NEXTDAYSINCLUDED", "NEXTWEEKSINCLUDED", "NEXTMONTHSINCLUDED", "NEXTQUARTERSINCLUDED", "NEXTYEARSINCLUDED", "TODAYFROMTO", "THISWEEK", "LASTWEEK", "NEXTWEEK", "SPECIFICMONTH", "SPECIFICMONTHINYEAR", "THISMONTH", "LASTMONTH", "NEXTMONTH", "THISQUARTER", "LASTQUARTER", "NEXTQUARTER", "QUARTER1", "QUARTER2", "QUARTER3", "QUARTER4", "THISYEAR", "LASTYEAR", "NEXTYEAR", "DATETIME"]; hideInput:boolean=false; calendarWeekNumbering:module:sap/base/i18n/date/CalendarWeekNumbering=null; showClearIcon:boolean=false
  aggs: customOptions:m.DynamicDateOption[0..n]; _input:m.Input[0..1]; _popup:m.ResponsivePopover[0..1]
  assoc: ariaLabelledBy, ariaDescribedBy
  event change: value:object, valid:boolean
  methods: open(oDomRef), openBy(oDomRef), toDates(oValue), static toDates(oValue, sCalendarWeekNumbering)
### sap.m.StandardDynamicDateRangeKeys (enum) extends 
  values: DATE, DATERANGE, DATETIME, DATETIMERANGE, DATETOYEAR, FIRSTDAYMONTH, FIRSTDAYQUARTER, FIRSTDAYWEEK, FIRSTDAYYEAR, FROM, FROMDATETIME, LASTDAYMONTH, LASTDAYQUARTER, LASTDAYS, LASTDAYSINCLUDED, LASTDAYWEEK, LASTDAYYEAR, LASTHOURS, LASTHOURSINCLUDED, LASTMINUTES, LASTMINUTESINCLUDED, LASTMONTH, LASTMONTHS, LASTMONTHSINCLUDED, LASTQUARTER, LASTQUARTERS, LASTQUARTERSINCLUDED, LASTWEEK, LASTWEEKS, LASTWEEKSINCLUDED, LASTYEAR, LASTYEARS, LASTYEARSINCLUDED, NEXTDAYS, NEXTDAYSINCLUDED, NEXTHOURS, NEXTHOURSINCLUDED, NEXTMINUTES, NEXTMINUTESINCLUDED, NEXTMONTH, NEXTMONTHS, NEXTMONTHSINCLUDED, NEXTQUARTER, NEXTQUARTERS, NEXTQUARTERSINCLUDED, NEXTWEEK, NEXTWEEKS, NEXTWEEKSINCLUDED, NEXTYEAR, NEXTYEARS, NEXTYEARSINCLUDED, QUARTER1, QUARTER2, QUARTER3, QUARTER4, SPECIFICMONTH, SPECIFICMONTHINYEAR, THISMONTH, THISQUARTER, THISWEEK, THISYEAR, TO, TODATETIME, TODAY, TODAYFROMTO, TOMORROW, YEARTODATE, YESTERDAY
### sap.m.DynamicDateOption (class) extends sap.ui.core.Element
  props: key:string=null; valueTypes:string[]=null
  methods: createValueHelpUI(oControl, fnControlsUpdated), enhanceFormattedValue(), format(oValue), parse(sValue), toDates(oValue, sCalendarWeekNumbering), validateValueHelpUI(oControl)
### sap.m.SelectDialogBase (class) extends sap.ui.core.Control
  props: initialFocus:m.SelectDialogInitialFocus="List"
  event updateStarted: reason:string, actual:int, total:int
  event updateFinished: reason:string, actual:int, total:int
  event selectionChange: listItem:m.ListItemBase, listItems:m.ListItemBase[], selected:boolean, selectAll:boolean
### sap.m.SelectDialog (class) extends sap.m.SelectDialogBase
  props: title:string=null; noDataText:string=null; multiSelect:boolean=false; growingThreshold:int=null; growing:boolean=true; contentWidth:core.CSSSize=null; rememberSelections:boolean=false; contentHeight:core.CSSSize=null; showClearButton:boolean=false; confirmButtonText:string=null; draggable:boolean=false; resizable:boolean=false; titleAlignment:m.TitleAlignment="Auto"; searchPlaceholder:string=null
  aggs: items:m.ListItemBase[0..n]; _dialog:core.Control[0..1]
  defaultAgg: items
  event confirm: selectedItem:m.StandardListItem, selectedItems:m.StandardListItem[], selectedContexts:object[]
  event search: value:string, itemsBinding:any, clearButtonPressed:boolean
  event liveChange: value:string, itemsBinding:any
  event cancel: 
  methods: clearSelection(), hasStyleClass(), invalidate(), onAfterRendering(), open(sSearchValue), toggleStyleClass(sStyleClass, bAdd?)
### sap.m.TableSelectDialog (class) extends sap.m.SelectDialogBase
  props: title:string=null; noDataText:string=null; multiSelect:boolean=false; growing:boolean=true; growingThreshold:int=null; contentWidth:core.CSSSize=null; rememberSelections:boolean=false; contentHeight:core.CSSSize=null; showClearButton:boolean=false; confirmButtonText:string=null; draggable:boolean=false; resizable:boolean=false; titleAlignment:m.TitleAlignment="Auto"; searchPlaceholder:string=null
  aggs: items:m.ColumnListItem[0..n]; _dialog:core.Control[0..1]; columns:m.Column[0..n]
  defaultAgg: items
  event confirm: selectedItem:m.StandardListItem, selectedItems:m.StandardListItem[], selectedContexts:object[]
  event search: value:string, itemsBinding:any, clearButtonPressed:boolean
  event liveChange: value:string, itemsBinding:any
  event cancel: 
  methods: hasStyleClass(), invalidate(), onAfterRendering(), open(sSearchValue), toggleStyleClass(sStyleClass, bAdd?)
### sap.m.SelectDialogInitialFocus (enum) extends 
  values: List, SearchField
### sap.m.StandardListItem (class) extends sap.m.ListItemBase
  props: title:string=null; description:string=null; icon:core.URI=null; iconInset:boolean=true; iconDensityAware:boolean=true; activeIcon:core.URI=null; info:string=null; infoState:core.ValueState="None"; infoIcon:core.URI=null; adaptTitleSize:boolean=true; titleTextDirection:core.TextDirection="Inherit"; infoTextDirection:core.TextDirection="Inherit"; wrapping:boolean=false; infoStateInverted:boolean=false; wrapCharLimit:int=0
  aggs: avatar:m.Avatar[0..1]; _infoStatus:m.ObjectStatus[0..1]
### sap.m.Column (class) extends sap.ui.core.Element
  props: width:core.CSSSize=null; hAlign:core.TextAlign="Begin"; vAlign:core.VerticalAlign="Inherit"; styleClass:string=null; visible:boolean=true; minScreenWidth:string=null; demandPopin:boolean=false; popinDisplay:m.PopinDisplay="Block"; mergeDuplicates:boolean=false; mergeFunctionName:string="getText"; sortIndicator:core.SortOrder="None"; importance:core.Priority="None"; autoPopinWidth:float=8
  aggs: header:core.Control[0..1]; footer:core.Control[0..1]; _action:core.Control[0..1]
  defaultAgg: header
  assoc: headerMenu
  methods: clearLastValue(), isHidden(), isPopin(), onItemsRemoved()
### sap.m.ColumnListItem (class) extends sap.m.ListItemBase
  props: vAlign:core.VerticalAlign="Inherit"
  aggs: cells:core.Control[0..n]
  defaultAgg: cells
  methods: $Popin(), hasPopin()
### sap.m.ListType (enum) extends 
  values: Active, Detail, DetailAndActive, Inactive, Navigation
### sap.m.ViewSettingsDialog (class) extends sap.ui.core.Control
  props: title:string=null; sortDescending:boolean=false; groupDescending:boolean=false; filterSearchOperator:m.StringFilterOperator="StartsWith"; titleAlignment:m.TitleAlignment="Auto"
  aggs: sortItems:m.ViewSettingsItem[0..n]; groupItems:m.ViewSettingsItem[0..n]; filterItems:m.ViewSettingsItem[0..n]; presetFilterItems:m.ViewSettingsItem[0..n]; customTabs:m.ViewSettingsCustomTab[0..n]
  assoc: selectedSortItem, selectedGroupItem, selectedPresetFilterItem
  event confirm: sortItem:m.ViewSettingsItem, sortDescending:boolean, groupItem:m.ViewSettingsItem, groupDescending:boolean, presetFilterItem:m.ViewSettingsItem, filterItems:m.ViewSettingsItem[], filterKeys:object, filterCompoundKeys:object, filterString:string
  event cancel: 
  event resetFilters: 
  event reset: 
  event filterDetailPageOpened: parentFilterItem:m.ViewSettingsFilterItem
  event beforeClose (preventable): 
  methods: clearFilters(), hasStyleClass(), open(sPageId?), toggleStyleClass(sStyleClass, bAdd?)
### sap.m.ViewSettingsItem (class) extends sap.ui.core.Item
  props: selected:boolean=false; wrapping:boolean=false
  event itemPropertyChanged: changedItem:m.ViewSettingsItem, propertyKey:string, propertyValue:any
### sap.m.ViewSettingsFilterItem (class) extends sap.m.ViewSettingsItem
  props: multiSelect:boolean=true
  aggs: items:m.ViewSettingsItem[0..n]
  event filterDetailItemsAggregationChange: 
### sap.m.Wizard (class) extends sap.ui.core.Control
  props: width:core.CSSSize="auto"; height:core.CSSSize="100%"; showNextButton:boolean=true; finishButtonText:string="Review"; enableBranching:boolean=false; backgroundDesign:m.PageBackgroundDesign="Standard"; renderMode:m.WizardRenderMode="Scroll"; stepTitleLevel:core.TitleLevel="H3"
  aggs: steps:m.WizardStep[0..n]; _progressNavigator:core.Control[0..1]; _nextButton:m.Button[0..1]
  defaultAgg: steps
  assoc: currentStep
  event stepActivate: index:int
  event navigationChange: step:m.WizardStep
  event complete: 
  methods: discardProgress(oStep, bPreserveNextStep), goToStep(oStep, bFocusFirstStepElement), invalidateStep(oStep), nextStep(), previousStep(), validateStep(oStep)
### sap.m.WizardStep (class) extends sap.ui.core.Control
  props: title:string=""; icon:core.URI=""; validated:boolean=true; optional:boolean=false; _titleLevel:core.TitleLevel="H3"
  aggs: content:core.Control[0..n]; _nextButton:m.Button[0..1]
  defaultAgg: content
  assoc: subsequentSteps, nextStep
  event complete: 
  event activate: 
  methods: _getNumberInvisibleText(), _setNumberInvisibleText(iNumber)
### sap.m.WizardRenderMode (enum) extends 
  values: Page, Scroll
### sap.m.PageBackgroundDesign (enum) extends 
  values: List, Solid, Standard, Transparent
### sap.m.IconTabBar (class) extends sap.ui.core.Control
  props: expandable:boolean=true; expanded:boolean=true; selectedKey:string=null; upperCase:boolean=false; stretchContentHeight:boolean=false; applyContentPadding:boolean=true; backgroundDesign:m.BackgroundDesign="Solid"; headerMode:m.IconTabHeaderMode="Standard"; headerBackgroundDesign:m.BackgroundDesign="Solid"; enableTabReordering:boolean=false; maxNestingLevel:int=0; tabDensityMode:m.IconTabDensityMode="Cozy"; ariaTexts:object=null; tabsOverflowMode:m.TabsOverflowMode="End"
  aggs: items:m.IconTab[0..n]; content:core.Control[0..n]; _header:m.IconTabHeader[0..1]
  event select: item:m.IconTabFilter, key:string, previousKey:string, selectedItem:m.IconTabFilter, selectedKey:string
  event expand: expand:boolean, collapse:boolean
### sap.m.IconTabFilter (class) extends sap.ui.core.Item
  props: count:string=""; showAll:boolean=false; icon:core.URI=""; iconColor:core.IconColor="Default"; iconDensityAware:boolean=true; visible:boolean=true; design:m.IconTabFilterDesign="Vertical"; interactionMode:m.IconTabFilterInteractionMode="Auto"
  aggs: content:core.Control[0..n]; items:m.IconTab[0..n]; _expandIcon:core.Icon[0..1]; _expandButtonBadge:core.Control[0..1]
  defaultAgg: content
  methods: render(oRM, iVisibleIndex, iVisibleItemsCount), renderInSelectList(oRM, oSelectList, iIndexInSet, iSetSize, fPaddingValue)
### sap.m.IconTabSeparator (class) extends sap.ui.core.Element
  props: icon:core.URI=""; visible:boolean=true; iconDensityAware:boolean=true
  methods: render(oRM), renderInSelectList(oRM, oSelectList, iIndexInSet, iSetSize, fPaddingValue)
### sap.m.IconTabFilterDesign (enum) extends 
  values: Horizontal, Vertical
### sap.m.IconTabFilterInteractionMode (enum) extends 
  values: Auto, Select, SelectLeavesOnly
### sap.m.IconTabHeaderMode (enum) extends 
  values: Inline, Standard
### sap.m.IconTabDensityMode (enum) extends 
  values: Compact, Cozy, Inherit
### sap.m.TabsOverflowMode (enum) extends 
  values: End, StartAndEnd
### sap.ui.core.IconColor (enum) extends 
  values: Contrast, Critical, Default, Marker, Negative, Neutral, NonInteractive, Positive, Tile
### sap.m.BackgroundDesign (enum) extends 
  values: Solid, Translucent, Transparent
### sap.ui.comp.smarttable.TableType (enum) extends 
  values: AnalyticalTable, ResponsiveTable, Table, TreeTable
### sap.ui.table.TreeTable (class) extends sap.ui.table.Table
  props: useGroupMode:boolean=false; groupHeaderProperty:string=null
  event toggleOpenState: rowIndex:int, rowContext:object, expanded:boolean
  methods: collapse(vRowIndex), collapseAll(), expand(vRowIndex), expandToLevel(iLevel), isExpanded(iRowIndex), selectAll()
### sap.m.upload.UploadItemConfiguration (class) extends sap.ui.core.Element
  props: fileNamePath:string=null; mediaTypePath:string=null; urlPath:string=null; uploadUrlPath:string=null; previewablePath:string=null; fileSizePath:string=null; isTrustedSourcePath:string=null; isDirectoryPath:string=null
### sap.m.upload.UploaderTableItem (class) extends sap.ui.core.Element
  props: uploadUrl:string=null; downloadUrl:string=null; httpRequestMethod:m.upload.UploaderHttpRequestMethod="Post"; useMultipart:boolean=false
  event uploadStarted: item:any
  event uploadProgressed: item:any, loaded:int, total:int
  event uploadCompleted: item:any, responseXHR:object
  event uploadTerminated: item:m.upload.UploadItem
  methods: download(oItem, aHeaderFields, bAskForLocation), terminateItem(oItem), static uploadFile(oFile, sUrl, aHeaderFields?), uploadItem(oItem, aHeaderFields?)
### sap.m.UploadSetwithTableActionPlaceHolder (enum) extends 
  values: CloudFilePickerButtonPlaceholder, PersonalizationSettingsPlaceholder (dep), UploadButtonPlaceholder, VariantManagementPlaceholder (dep)
### sap.m.plugins.UploadSetwithTable.FilenameValidationConfig (typedef) extends 
### sap.m.upload.Uploader (class, deprecated) extends sap.ui.core.Element
  props: uploadUrl:string=null; downloadUrl:string=null; httpRequestMethod:m.upload.UploaderHttpRequestMethod="Post"; useMultipart:boolean=false
  event uploadStarted: item:m.upload.UploadSetItem
  event uploadProgressed: item:m.upload.UploadSetItem, loaded:int, total:int
  event uploadCompleted: item:m.upload.UploadSetItem, responseXHR:object
  event uploadAborted: item:m.upload.UploadSetItem
  methods: downloadItem(oItem, aHeaderFields, bAskForLocation), terminateItem(oItem), static uploadFile(oFile, sUrl, aHeaderFields?), uploadItem(oItem, aHeaderFields?)
### sap.m.upload.FilePreviewDialog (class) extends sap.ui.core.Element
  props: showCarouselArrows:boolean=true; maxFileSizeforPreview:float=null; customPageContentHandler:function=null
  aggs: additionalFooterButtons:m.Button[0..n]
  defaultAgg: additionalFooterButtons
### sap.m.upload.ActionsPlaceholder (class) extends sap.ui.core.Control
  props: placeholderFor:m.UploadSetwithTableActionPlaceHolder=null
  aggs: _actionButton:core.Control[0..1]
### sap.m.plugins.UploadSetwithTable.FilenameValidationConfig (typedef)
  fields: mode ('include' | 'exclude' | 'override'), characters (default restricted set: \:/*?"<>|[]{}@#$)
### sap.m.plugins.UploadSetwithTable.ItemInfo (typedef, argument of itemValidationHandler)
  fields: oItem (UploadItem), iTotalItemsForUpload, oSource
# sap.suite.ui.microchart (stage 6: smart-kit suite/ui/microchart/*; size is sap.m.Size: XS, S, M, L, Responsive, Auto)
### sap.suite.ui.microchart.AreaMicroChart (class) extends sap.ui.core.Control
  props: size:sap.m.Size="Auto"; width:core.CSSSize=null; height:core.CSSSize=null; maxXValue:float=null; minXValue:float=null; maxYValue:float=null; minYValue:float=null; view:sap.suite.ui.microchart.AreaMicroChartViewType="Normal"; colorPalette:string[]=[]; showLabel:boolean=true; hideOnNoData:boolean=false
  aggs: chart:sap.suite.ui.microchart.AreaMicroChartItem[0..1]; maxThreshold:sap.suite.ui.microchart.AreaMicroChartItem[0..1]; innerMaxThreshold:sap.suite.ui.microchart.AreaMicroChartItem[0..1]; innerMinThreshold:sap.suite.ui.microchart.AreaMicroChartItem[0..1]; minThreshold:sap.suite.ui.microchart.AreaMicroChartItem[0..1]; target:sap.suite.ui.microchart.AreaMicroChartItem[0..1]; firstXLabel:sap.suite.ui.microchart.AreaMicroChartLabel[0..1]; firstYLabel:sap.suite.ui.microchart.AreaMicroChartLabel[0..1]; lastXLabel:sap.suite.ui.microchart.AreaMicroChartLabel[0..1]; lastYLabel:sap.suite.ui.microchart.AreaMicroChartLabel[0..1]; maxLabel:sap.suite.ui.microchart.AreaMicroChartLabel[0..1]; minLabel:sap.suite.ui.microchart.AreaMicroChartLabel[0..1]; lines:sap.suite.ui.microchart.AreaMicroChartItem[0..n]
  defaultAgg: lines
  event press: oEvent:object
### sap.suite.ui.microchart.AreaMicroChartItem (class) extends sap.ui.core.Element
  props: color:sap.suite.ui.microchart.MicroChartColorType|sap.m.ValueCSSColor="sap.suite.ui.microchart.MicroChartColorType.Neutral"; title:string=null
  aggs: points:sap.suite.ui.microchart.AreaMicroChartPoint[0..n]
  defaultAgg: points
### sap.suite.ui.microchart.AreaMicroChartLabel (class) extends sap.ui.core.Element
  props: color:sap.suite.ui.microchart.MicroChartColorType|sap.m.ValueCSSColor="sap.suite.ui.microchart.MicroChartColorType.Neutral"; label:string=""
### sap.suite.ui.microchart.AreaMicroChartPoint (class) extends sap.ui.core.Element
  props: x:float=null; y:float=null
  methods: getXValue(), getYValue()
### sap.suite.ui.microchart.AreaMicroChartViewType (enum) extends 
  values: Normal, Wide
### sap.suite.ui.microchart.BulletMicroChart (class) extends sap.ui.core.Control
  props: size:sap.m.Size="Auto"; mode:sap.suite.ui.microchart.BulletMicroChartModeType="Actual"; scale:string=""; forecastValue:float=null; targetValue:float=null; minValue:float=null; maxValue:float=null; showActualValue:boolean=true; showDeltaValue:boolean=true; showActualValueInDeltaMode:boolean=false; showTargetValue:boolean=true; showValueMarker:boolean=false; showThresholds:boolean=true; actualValueLabel:string=""; deltaValueLabel:string=""; targetValueLabel:string=""; width:core.CSSSize=null; height:core.CSSSize=null; scaleColor:sap.suite.ui.microchart.CommonBackgroundType="MediumLight"; hideOnNoData:boolean=false; smallRangeAllowed:boolean=false
  aggs: actual:sap.suite.ui.microchart.BulletMicroChartData[0..1]; thresholds:sap.suite.ui.microchart.BulletMicroChartData[0..n]
  defaultAgg: actual
  event press: oEvent:object
### sap.suite.ui.microchart.BulletMicroChartData (class) extends sap.ui.core.Element
  props: value:float="0"; color:sap.m.ValueColor="Neutral"
### sap.suite.ui.microchart.BulletMicroChartModeType (enum) extends 
  values: Actual, Delta
### sap.suite.ui.microchart.ColumnMicroChart (class) extends sap.ui.core.Control
  props: size:sap.m.Size="Auto"; width:core.CSSSize=null; height:core.CSSSize=null; showTopLabels:boolean=true; showBottomLabels:boolean=true; allowColumnLabels:boolean=false; hideOnNoData:boolean=false
  aggs: columns:sap.suite.ui.microchart.ColumnMicroChartData[0..n]; leftTopLabel:sap.suite.ui.microchart.ColumnMicroChartLabel[0..1]; rightTopLabel:sap.suite.ui.microchart.ColumnMicroChartLabel[0..1]; leftBottomLabel:sap.suite.ui.microchart.ColumnMicroChartLabel[0..1]; rightBottomLabel:sap.suite.ui.microchart.ColumnMicroChartLabel[0..1]
  defaultAgg: columns
  event press: oEvent:object
### sap.suite.ui.microchart.ColumnMicroChartData (class) extends sap.ui.core.Element
  props: color:sap.suite.ui.microchart.MicroChartColorType|sap.m.ValueCSSColor="sap.suite.ui.microchart.MicroChartColorType.Neutral"; label:string=""; displayValue:string=null; value:float=null
  event press: oEvent:object
### sap.suite.ui.microchart.ColumnMicroChartLabel (class) extends sap.ui.core.Element
  props: color:sap.suite.ui.microchart.MicroChartColorType|sap.m.ValueCSSColor="sap.suite.ui.microchart.MicroChartColorType.Neutral"; label:string=""
### sap.suite.ui.microchart.CommonBackgroundType (enum) extends 
  values: Dark, Darkest, ExtraDark, ExtraLight, Light, Lightest, Medium, MediumLight, Transparent
### sap.suite.ui.microchart.ComparisonMicroChart (class) extends sap.ui.core.Control
  props: size:sap.m.Size="Auto"; scale:string=""; minValue:float=null; maxValue:float=null; view:sap.suite.ui.microchart.ComparisonMicroChartViewType="Normal"; colorPalette:string[]=[]; shrinkable:boolean=false; width:core.CSSSize=null; height:core.CSSSize=null; hideOnNoData:boolean=false
  aggs: data:sap.suite.ui.microchart.ComparisonMicroChartData[0..n]
  defaultAgg: data
  event press: oEvent:object
### sap.suite.ui.microchart.ComparisonMicroChartData (class) extends sap.ui.core.Element
  props: value:float="0"; color:sap.suite.ui.microchart.MicroChartColorType|sap.m.ValueCSSColor="sap.suite.ui.microchart.MicroChartColorType.Neutral"; title:string=""; displayValue:string=""
  event press: oEvent:object
### sap.suite.ui.microchart.ComparisonMicroChartViewType (enum) extends 
  values: Normal, Responsive, Wide
### sap.suite.ui.microchart.DeltaMicroChart (class) extends sap.ui.core.Control
  props: value1:float=null; value2:float=null; title1:string=null; title2:string=null; displayValue1:string=null; displayValue2:string=null; deltaDisplayValue:string=null; color:string="sap.suite.ui.microchart.MicroChartColorType.Neutral"; view:sap.suite.ui.microchart.DeltaMicroChartViewType="Normal"; width:core.CSSSize=null; height:core.CSSSize=null; size:sap.m.Size="Auto"; hideOnNoData:boolean=false
  event press: oEvent:object
### sap.suite.ui.microchart.DeltaMicroChartViewType (enum) extends 
  values: Normal, Responsive, Wide
### sap.suite.ui.microchart.HarveyBallMicroChart (class) extends sap.ui.core.Control
  props: total:float=null; totalLabel:string=null; totalScale:string=null; formattedLabel:boolean=false; showTotal:boolean=true; showFractions:boolean=true; size:sap.m.Size="Auto"; colorPalette:string[]=[]; width:core.CSSSize=null; height:core.CSSSize=null; alignContent:sap.suite.ui.microchart.HorizontalAlignmentType="Left"; hideOnNoData:boolean=false; xsWidth:boolean=false
  aggs: items:sap.suite.ui.microchart.HarveyBallMicroChartItem[0..n]
  defaultAgg: items
  event press: oEvent:object
### sap.suite.ui.microchart.HarveyBallMicroChartItem (class) extends sap.ui.core.Element
  props: color:sap.suite.ui.microchart.MicroChartColorType|sap.m.ValueCSSColor="sap.suite.ui.microchart.MicroChartColorType.Neutral"; fraction:float=0; fractionLabel:string=null; fractionScale:string=null; formattedLabel:boolean=false
### sap.suite.ui.microchart.HorizontalAlignmentType (enum) extends 
  values: Center, Left, Right
### sap.suite.ui.microchart.LineMicroChart (class) extends sap.ui.core.Control
  props: size:sap.m.Size="Auto"; threshold:float=0; showThresholdLine:boolean=true; showThresholdValue:boolean=false; thresholdDisplayValue:string=null; minXValue:float=null; maxXValue:float=null; minYValue:float=null; maxYValue:float=null; leftTopLabel:string=null; rightTopLabel:string=null; leftBottomLabel:string=null; rightBottomLabel:string=null; showTopLabels:boolean=true; showBottomLabels:boolean=true; color:any="Neutral"; showPoints:boolean=false; width:core.CSSSize=null; height:core.CSSSize=null; hideOnNoData:boolean=false
  aggs: points:sap.suite.ui.microchart.LineMicroChartPoint[0..n]; lines:sap.suite.ui.microchart.LineMicroChartLine[0..n]
  defaultAgg: points
  event press: oEvent:object
### sap.suite.ui.microchart.LineMicroChartEmphasizedPoint (class) extends sap.suite.ui.microchart.LineMicroChartPoint
  props: color:sap.suite.ui.microchart.MicroChartColorType|sap.m.ValueCSSColor="sap.suite.ui.microchart.MicroChartColorType.Neutral"; show:boolean=false
### sap.suite.ui.microchart.LineMicroChartLine (class) extends sap.ui.core.Element
  props: color:any=null; showPoints:boolean=null; type:sap.suite.ui.microchart.LineType="Solid"
  aggs: points:sap.suite.ui.microchart.LineMicroChartPoint[0..n]
  defaultAgg: points
### sap.suite.ui.microchart.LineMicroChartPoint (class) extends sap.ui.core.Element
  props: x:float=0; y:float=0
### sap.suite.ui.microchart.LineType (enum) extends 
  values: Dashed, Dotted, Solid
### sap.suite.ui.microchart.MicroChartColorType (enum) extends 
  values: Critical, Error, Good, Neutral, None, Sequence1, Sequence10, Sequence11, Sequence12, Sequence2, Sequence3, Sequence4, Sequence5, Sequence6, Sequence7, Sequence8, Sequence9
### sap.suite.ui.microchart.RadialMicroChart (class) extends sap.ui.core.Control
  props: total:float=null; fraction:float=null; percentage:float=null; valueColor:sap.suite.ui.microchart.MicroChartColorType|sap.m.ValueCSSColor="sap.suite.ui.microchart.MicroChartColorType.Neutral"; size:sap.m.Size="Auto"; width:core.CSSSize=null; height:core.CSSSize=null; alignContent:sap.suite.ui.microchart.HorizontalAlignmentType="Left"; hideOnNoData:boolean=false
  event press: oEvent:object
### sap.suite.ui.microchart.StackedBarMicroChart (class) extends sap.ui.core.Control
  props: size:sap.m.Size="Auto"; maxValue:float=null; precision:int=1; displayZeroValue:boolean=true; width:core.CSSSize=null; height:core.CSSSize=null; showLabels:boolean=true; hideOnNoData:boolean=false
  aggs: bars:sap.suite.ui.microchart.StackedBarMicroChartBar[0..n]
  defaultAgg: bars
  event press: oEvent:object
### sap.suite.ui.microchart.StackedBarMicroChartBar (class) extends sap.ui.core.Element
  props: value:float="0"; valueColor:sap.suite.ui.microchart.MicroChartColorType|sap.m.ValueCSSColor=null; displayValue:string=null
# stage 6: sap.m.p13n, sap.m.QuickView, sap.m.Table, landmark info (smart-kit m/p13n/Popup, SelectionPanel, SortPanel, GroupPanel; m/QuickView, QuickViewPage, QuickViewGroup, QuickViewGroupElement; m/Table; f/DynamicPageAccessibleLandmarkInfo, uxap/ObjectPageAccessibleLandmarkInfo, f/FlexibleColumnLayoutAccessibleLandmarkInfo; enums in m/library, ui/core/library)
### sap.m.p13n.Popup (class) extends sap.ui.core.Control
  props: title:string=null; mode:m.P13nPopupMode="Dialog"; warningText:string=null; reset:function=null
  aggs: panels:m.p13n.IContent[0..n]; additionalButtons:m.Button[0..n]
  event open: 
  event close: reason:string
  methods: isOpen(), open(oSource, mSettings)
### sap.m.P13nPopupMode (enum) extends 
  values: Dialog, ResponsivePopover
### sap.m.p13n.BasePanel (class) extends sap.ui.core.Control
  props: title:string=null; enableReorder:boolean=true
  aggs: messageStrip:m.MessageStrip[0..1]
  event change: reason:string, item:m.p13n.Item
  methods: getItemByKey(sName), getP13nData(bOnlyActive), setP13nData(aP13nData)
### sap.m.p13n.SelectionPanel (class) extends sap.m.p13n.BasePanel
  props: title:string="...see text or source"; showHeader:boolean=false; enableCount:boolean=false; fieldColumn:string=""; activeColumn:string=""; itemFactory:function=null; multiSelectMode:m.MultiSelectMode="ClearAll"; enableReorder:boolean=true
  aggs: messageStrip:m.MessageStrip[0..1]
  event change: reason:string, item:m.p13n.Item
  methods: setP13nData(aP13nData), getItemByKey(sName), getP13nData(bOnlyActive)
### sap.m.p13n.SortPanel (class) extends sap.m.p13n.QueryPanel
  props: title:string="...see text or source"; queryLimit:int=-1; enableReorder:boolean=true
  aggs: messageStrip:m.MessageStrip[0..1]
  event change: reason:string, item:m.p13n.Item
  methods: static setP13nData(aP13nData), setP13nData(aP13nData), getItemByKey(sName), getP13nData(bOnlyActive)
### sap.m.p13n.GroupPanel (class) extends sap.m.p13n.QueryPanel
  props: title:string="...see text or source"; enableShowField:boolean=false; queryLimit:int=-1; enableReorder:boolean=true
  aggs: messageStrip:m.MessageStrip[0..1]
  event change: reason:string, item:m.p13n.Item
  methods: static setP13nData(aP13nData), setP13nData(aP13nData), getItemByKey(sName), getP13nData(bOnlyActive)
### sap.m.QuickView (class) extends sap.m.QuickViewBase
  props: placement:m.PlacementType="Right"; width:core.CSSSize="320px"
  aggs: pages:m.QuickViewPage[0..n]
  defaultAgg: pages
  event afterOpen: openBy:core.Control
  event afterClose: openBy:core.Control, origin:m.Button
  event beforeOpen: openBy:core.Control
  event beforeClose: openBy:core.Control, origin:m.Button
  event navigate: from:core.Control, fromId:string, to:core.Control, toId:string, firstTime:boolean, isTo:boolean, isBack:boolean, isBackToTop:boolean, isBackToPage:boolean, direction:string, navOrigin:core.Control
  event afterNavigate: from:core.Control, fromId:string, to:core.Control, toId:string, firstTime:boolean, isTo:boolean, isBack:boolean, isBackToTop:boolean, isBackToPage:boolean, direction:string, isTopPage:boolean, navOrigin:core.Control
  methods: close(), openBy(oControl), navigateBack()
### sap.m.QuickViewPage (class) extends sap.ui.core.Control
  props: pageId:string=""; header:string=""; title:string=""; titleUrl:string=""; description:string=""
  aggs: groups:m.QuickViewGroup[0..n]; avatar:m.Avatar[0..1]
  defaultAgg: groups
### sap.m.QuickViewGroup (class) extends sap.ui.core.Element
  props: visible:boolean=true; heading:string=""
  aggs: elements:m.QuickViewGroupElement[0..n]
  defaultAgg: elements
### sap.m.QuickViewGroupElement (class) extends sap.ui.core.Element
  props: visible:boolean=true; label:string=""; value:string=""; url:string=""; target:string="_blank"; type:m.QuickViewGroupElementType="text"; pageLinkId:string=""; emailSubject:string=""
### sap.m.QuickViewGroupElementType (enum) extends 
  values: email, link, mobile, pageLink, phone, text
### sap.m.Table (class) extends sap.m.ListBase
  props: backgroundDesign:m.BackgroundDesign="Translucent"; fixedLayout:any=true; showOverlay:boolean=false; alternateRowColors:boolean=false; popinLayout:m.PopinLayout="Block"; contextualWidth:string="Inherit"; autoPopinMode:boolean=false; hiddenInPopin:core.Priority[]=null; inset:boolean=false; headerText:string=null; headerLevel:core.TitleLevel="Auto"; footerText:string=null; mode:m.ListMode="None"; width:core.CSSSize="100%"; includeItemInSelection:boolean=false; showUnread:boolean=false; noDataText:string=null; showNoData:boolean=true; enableBusyIndicator:boolean=true; modeAnimationOn:boolean=true; showSeparators:m.ListSeparators="All"; swipeDirection:m.SwipeDirection="Both"; growing:boolean=false; growingThreshold:int=20; growingTriggerText:string=null; growingScrollToLoad:boolean=false; growingDirection:m.ListGrowingDirection="Downwards"; rememberSelections:boolean=true; keyboardMode:m.ListKeyboardMode="Navigation"; sticky:m.Sticky[]=null; multiSelectMode:m.MultiSelectMode="Default"; itemActionCount:int=-1
  aggs: columns:m.Column[0..n]; items:m.ListItemBase[0..n]; swipeContent:core.Control[0..1]; headerToolbar:m.Toolbar[0..1]; infoToolbar:m.Toolbar[0..1]; contextMenu:core.IContextMenu[0..1]; noData:core.Control[0..1]
  assocs: ariaLabelledBy:core.Control
  defaultAgg: items
  event beforeOpenContextMenu: listItem:m.ColumnListItem, column:m.Column
  event paste: data:string[][]
  event popinChanged: hasPopin:boolean, visibleInPopin:m.Column[], hiddenInPopin:m.Column[]
  event selectionChange: listItem:m.ListItemBase, listItems:m.ListItemBase[], selected:boolean, selectAll:boolean
  event delete: listItem:m.ListItemBase
  event swipe: listItem:m.ListItemBase, swipeContent:core.Control, srcControl:core.Control, swipeDirection:m.SwipeDirection
  event updateStarted: reason:string, actual:int, total:int
  event updateFinished: reason:string, actual:int, total:int
  event itemPress: listItem:m.ListItemBase, srcControl:core.Control
  event itemActionPress: action:m.ListItemAction, listItem:m.ListItemBase
  methods: getGrowingInfo(), getSelectedContexts(bAll), getSelectedItem(), getSelectedItems(), getSwipedItem(), removeSelections(bAll, bFireEvent), requestItems(iItems), scrollToIndex(iIndex), selectAll(bFireEvent), setSelectedItem(oListItem, bSelect, bFireEvent), setSelectedItemById(sId, bSelect), swipeOut(callback)
### sap.m.ListKeyboardMode (enum) extends 
  values: Edit, Navigation
### sap.m.ListGrowingDirection (enum) extends 
  values: Downwards, Upwards
### sap.m.SwipeDirection (enum) extends 
  values: BeginToEnd, Both, EndToBegin
### sap.m.ListItemActionType (enum) extends 
  values: Custom, Delete, Edit
### sap.m.ListItemAction (class) extends sap.m.ListItemActionBase
  props: type:m.ListItemActionType="Custom"; icon:core.URI=""; text:string=""; visible:boolean=true
### sap.f.DynamicPageAccessibleLandmarkInfo (class) extends sap.ui.core.Element
  props: rootRole:core.AccessibleLandmarkRole="None"; rootLabel:string=null; contentRole:core.AccessibleLandmarkRole="None"; contentLabel:string=null; headerRole:core.AccessibleLandmarkRole="None"; headerLabel:string=null; footerRole:core.AccessibleLandmarkRole="None"; footerLabel:string=null; headerContentLabel:string=null
### sap.uxap.ObjectPageAccessibleLandmarkInfo (class) extends sap.ui.core.Element
  props: rootRole:core.AccessibleLandmarkRole="Main"; rootLabel:string=null; contentRole:core.AccessibleLandmarkRole="None"; contentLabel:string=null; navigationRole:core.AccessibleLandmarkRole="Navigation"; navigationLabel:string=null; headerRole:core.AccessibleLandmarkRole="Banner"; headerLabel:string=null; footerRole:core.AccessibleLandmarkRole="Region"; footerLabel:string=null; headerContentLabel:string=null
### sap.f.FlexibleColumnLayoutAccessibleLandmarkInfo (class) extends sap.ui.core.Element
  props: firstColumnLabel:string=null; middleColumnLabel:string=null; lastColumnLabel:string=null; firstColumnBackArrowLabel:string=null; middleColumnForwardArrowLabel:string=null; middleColumnBackArrowLabel:string=null; lastColumnForwardArrowLabel:string=null
### sap.ui.core.AccessibleLandmarkRole (enum) extends 
  values: Banner, Complementary, ContentInfo, Form, Main, Navigation, None, Region, Search
```
