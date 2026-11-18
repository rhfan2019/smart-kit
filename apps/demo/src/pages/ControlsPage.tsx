/** /controls: the general controls with SAPUI5 names (docs/26, ADR-032), one section per group. */
import { Stack, Title } from '@mantine/core';
import { DialogsSection } from './controls/DialogsSection';
import { DisplaySection } from './controls/DisplaySection';
import { MessagesSection } from './controls/MessagesSection';
import { ProcessSection } from './controls/ProcessSection';

export function ControlsPage() {
  return (
    <Stack gap="xl" p="md" data-demo-controls>
      <section data-demo-section="messages"><Title order={2} mb="sm">Messages</Title><MessagesSection /></section>
      <section data-demo-section="display"><Title order={2} mb="sm">Display</Title><DisplaySection /></section>
      <section data-demo-section="process"><Title order={2} mb="sm">Process</Title><ProcessSection /></section>
      <section data-demo-section="dialogs"><Title order={2} mb="sm">Dialogs &amp; navigation</Title><DialogsSection /></section>
    </Stack>
  );
}
