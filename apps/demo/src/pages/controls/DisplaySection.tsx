/** Demo section of the Display controls (docs/26 §3.2–3.5): object display, empty and busy states, amounts, toolbar. */
import { Button, Group, SimpleGrid, Stack, Text } from '@mantine/core';
import BusyDialog from '@rhfan2019/smart-kit/m/BusyDialog';
import BusyIndicator from '@rhfan2019/smart-kit/m/BusyIndicator';
import Currency from '@rhfan2019/smart-kit/ui/unified/Currency';
import ExpandableText from '@rhfan2019/smart-kit/m/ExpandableText';
import IllustratedMessage from '@rhfan2019/smart-kit/m/IllustratedMessage';
import ObjectIdentifier from '@rhfan2019/smart-kit/m/ObjectIdentifier';
import ObjectMarker from '@rhfan2019/smart-kit/m/ObjectMarker';
import ObjectNumber from '@rhfan2019/smart-kit/m/ObjectNumber';
import ObjectStatus from '@rhfan2019/smart-kit/m/ObjectStatus';
import OverflowToolbar from '@rhfan2019/smart-kit/m/OverflowToolbar';
import OverflowToolbarButton from '@rhfan2019/smart-kit/m/OverflowToolbarButton';
import ToggleButton from '@rhfan2019/smart-kit/m/ToggleButton';
import ToolbarSpacer from '@rhfan2019/smart-kit/m/ToolbarSpacer';
import type IllustratedMessageType from '@rhfan2019/smart-kit/m/IllustratedMessageType';
import { Copy, Flag, Share2, Star, Trash2 } from 'lucide-react';
import { useRef, useState, type ReactNode } from 'react';

const LONG = 'The supplier confirmed the delivery for the second week of December. Partial deliveries are possible for items 20 and 30; '
  + 'the remaining quantity follows with the next shipment. Please check the incoterms before releasing the order.';
const TYPES: IllustratedMessageType[] = ['NoSearchResults', 'NoData', 'NoFilterResults', 'UnableToLoad', 'NoTasks', 'UploadToCloud', 'Achievement', 'PageNotFound'];

function Box({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Stack gap="xs">
      <Text size="sm" c="dimmed">{label}</Text>
      {children}
    </Stack>
  );
}

export function DisplaySection() {
  const busy = useRef<BusyDialog>(null);
  const [type, setType] = useState<IllustratedMessageType>('NoSearchResults');
  const [flagged, setFlagged] = useState(false);
  const openBusy = () => {
    busy.current?.open();
    setTimeout(() => busy.current?.close(), 3000);
  };
  return (
    <Stack gap="lg" data-demo-display>
      <SimpleGrid cols={{ base: 1, md: 3 }} spacing="lg">
        <Box label="ObjectIdentifier · ObjectNumber · ObjectMarker">
          <Group justify="space-between" align="flex-start">
            <ObjectIdentifier title="4500000017" text="Acme Corp" titleActive onTitlePress={() => console.info('titlePress')} />
            <ObjectNumber number="12,500.00" unit="EUR" state="Success" />
          </Group>
          <Group gap="md">
            <ObjectMarker type="Draft" />
            <ObjectMarker type="Flagged" />
            <ObjectMarker type="Favorite" />
            <ObjectMarker type="LockedBy" additionalInfo="Anna Weber" onPress={(e) => console.info('press', e.type)} />
          </Group>
        </Box>
        <Box label="ObjectStatus">
          <ObjectStatus title="Status" text="Approved" state="Success" />
          <ObjectStatus text="Overdue" state="Error" inverted />
          <Group gap="xs">
            {(['Indication01', 'Indication04', 'Indication05', 'Indication07', 'Indication13', 'Indication18'] as const).map((s) => <ObjectStatus key={s} text={s.slice(10)} state={s} inverted />)}
          </Group>
          <ObjectStatus text="3 open issues" state="Warning" active onPress={() => console.info('status press')} />
        </Box>
        <Box label="Currency (aligned) · ObjectNumber displayMode Currency">
          <Stack gap={0} align="flex-end" w="fit-content">
            <Currency value={1234.5} currency="EUR" maxPrecision={3} />
            <Currency value={98000} currency="JPY" maxPrecision={3} />
            <Currency value={7.125} currency="BHD" maxPrecision={3} />
            <Currency stringValue="12345678901234.56" currency="USD" maxPrecision={3} />
          </Stack>
          <ObjectNumber number={48900} unit="EUR" displayMode="Currency" state="Error" inverted />
        </Box>
      </SimpleGrid>

      <Box label="OverflowToolbar (resize the window: Low first, then High, right to left)">
        <OverflowToolbar design="Solid">
          <Text fw={600}>Items (24)</Text>
          <ToolbarSpacer />
          <ToggleButton text="Flag" icon={<Flag size={16} />} pressed={flagged} onPress={(e) => setFlagged(e.pressed)} />
          <ToggleButton text="Favorite" icon={<Star size={16} />} type="Transparent" layoutData={{ priority: 'Low' }} />
          <OverflowToolbarButton text="Copy" icon={<Copy size={16} />} layoutData={{ group: 1 }} />
          <OverflowToolbarButton text="Share" icon={<Share2 size={16} />} layoutData={{ group: 1 }} />
          <OverflowToolbarButton text="Delete" icon={<Trash2 size={16} />} layoutData={{ priority: 'AlwaysOverflow' }} />
          <ToggleButton text="Edit mode" type="Emphasized" layoutData={{ priority: 'NeverOverflow' }} />
        </OverflowToolbar>
      </Box>

      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
        <Box label="ExpandableText (InPlace / Popover)">
          <ExpandableText text={LONG} maxCharacters={80} />
          <ExpandableText text={LONG} maxCharacters={80} overflowMode="Popover" />
        </Box>
        <Box label="BusyIndicator · BusyDialog">
          <Group>
            <BusyIndicator text="Loading…" />
            <BusyIndicator size="0.5rem" />
          </Group>
          <Button variant="default" w="fit-content" onClick={openBusy}>Open BusyDialog (3 s)</Button>
          <BusyDialog ref={busy} title="Posting" text="Posting the goods receipt…" showCancelButton onClose={(e) => console.info('close', e)} />
        </Box>
      </SimpleGrid>

      <Box label="IllustratedMessage (Auto size follows the container width)">
        <Group gap="xs">{TYPES.map((t) => <Button key={t} size="xs" variant={t === type ? 'filled' : 'default'} onClick={() => setType(t)}>{t}</Button>)}</Group>
        <SimpleGrid cols={{ base: 1, md: 3 }} spacing="lg">
          <IllustratedMessage illustrationType={type} additionalContent={<Button variant="default">Clear search</Button>} />
          <IllustratedMessage illustrationType={type} illustrationSize="Small" />
          <IllustratedMessage illustrationType={type} illustrationSize="ExtraSmall" />
        </SimpleGrid>
      </Box>
    </Stack>
  );
}
