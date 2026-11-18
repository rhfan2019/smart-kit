/**
 * Enums of the controls (docs/26 §2 rule 3, ADR-032): each is a type and a constant of the same name with the SAPUI5
 * values, so `ValueState.Error` works as in UI5. This story lists every value.
 */
import { MantineProvider, Table, Title } from '@mantine/core';
import { smartKitCssVariablesResolver, smartKitMantineTheme } from '@rhfan2019/smart-kit';
import AvatarShape from '@rhfan2019/smart-kit/m/AvatarShape';
import AvatarSize from '@rhfan2019/smart-kit/m/AvatarSize';
import { BackgroundDesign, BadgeStyle, ButtonAccessibleRole, ButtonType, EmptyIndicatorMode, ExpandableTextOverflowMode, IconTabDensityMode, IconTabFilterDesign, IconTabFilterInteractionMode, IconTabHeaderMode, LinkConversion, ListType, ObjectMarkerType, ObjectMarkerVisibility, ObjectNumberDisplayMode, OverflowToolbarPriority, PageBackgroundDesign, ReactiveAreaMode, SelectDialogInitialFocus, StandardDynamicDateRangeKeys, StringFilterOperator, TabsOverflowMode, TitleAlignment, ToolbarDesign, ToolbarStyle, WizardRenderMode, WrappingType } from '@rhfan2019/smart-kit/m/library';
import CalendarWeekNumbering from '@rhfan2019/smart-kit/base/i18n/date/CalendarWeekNumbering';
import { DEFAULT_STANDARD_OPTIONS } from '@rhfan2019/smart-kit/util';
import { IconColor, IndicationColor, TitleLevel, ValueState } from '@rhfan2019/smart-kit/ui/core/library';
import IllustratedMessageSize from '@rhfan2019/smart-kit/m/IllustratedMessageSize';
import IllustratedMessageType from '@rhfan2019/smart-kit/m/IllustratedMessageType';
import MessageType from '@rhfan2019/smart-kit/ui/core/message/MessageType';
import { MicroProcessFlowRenderType, ProcessFlowConnectionLabelState, ProcessFlowNodeState, ProcessFlowNodeType, ProcessFlowZoomLevel, TimelineAlignment, TimelineAxisOrientation, TimelineFilterType, TimelineGroupType } from '@rhfan2019/smart-kit/suite/ui/commons/library';
import { VerticalPlacementType } from '@rhfan2019/smart-kit/m/library';
import type { Meta, StoryObj } from '@storybook/react-vite';

const ENUMS: Record<string, object> = {
  AvatarShape, AvatarSize, BackgroundDesign, BadgeStyle, ButtonAccessibleRole, ButtonType, CalendarWeekNumbering, EmptyIndicatorMode,
  ExpandableTextOverflowMode, IconColor, IconTabDensityMode, IconTabFilterDesign, IconTabFilterInteractionMode, IconTabHeaderMode, IllustratedMessageSize,
  IllustratedMessageType, IndicationColor, LinkConversion, ListType, MessageType, MicroProcessFlowRenderType, ObjectMarkerType, ObjectMarkerVisibility,
  ObjectNumberDisplayMode, OverflowToolbarPriority, PageBackgroundDesign, ProcessFlowConnectionLabelState, ProcessFlowNodeState, ProcessFlowNodeType,
  ProcessFlowZoomLevel, ReactiveAreaMode, SelectDialogInitialFocus, StandardDynamicDateRangeKeys, StringFilterOperator, TabsOverflowMode,
  TimelineAlignment, TimelineAxisOrientation, TimelineFilterType, TimelineGroupType, TitleAlignment, TitleLevel, ToolbarDesign, ToolbarStyle, ValueState,
  VerticalPlacementType, WizardRenderMode, WrappingType,
};

const meta: Meta = {
  title: 'smart-kit/Controls/Enums',
  decorators: [(Story) => <MantineProvider theme={smartKitMantineTheme} cssVariablesResolver={smartKitCssVariablesResolver} forceColorScheme="light"><div style={{ padding: 16 }}><Story /></div></MantineProvider>],
};
export default meta;

export const AllEnums: StoryObj = {
  render: () => (
    <>
      <Title order={3} mb="sm">Enums (SAPUI5 1.154 values)</Title>
      <Table withTableBorder striped>
        <Table.Thead><Table.Tr><Table.Th>Enum</Table.Th><Table.Th>Values</Table.Th></Table.Tr></Table.Thead>
        <Table.Tbody>
          {Object.entries(ENUMS).map(([name, values]) => (
            <Table.Tr key={name}><Table.Td><code>{name}</code></Table.Td><Table.Td>{Object.values(values).join(', ')}</Table.Td></Table.Tr>
          ))}
          <Table.Tr><Table.Td><code>DEFAULT_STANDARD_OPTIONS</code></Table.Td><Table.Td>{DEFAULT_STANDARD_OPTIONS.join(', ')}</Table.Td></Table.Tr>
        </Table.Tbody>
      </Table>
    </>
  ),
};
