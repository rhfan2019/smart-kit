// Fixture for tests/unit/check-ui5-api.test.ts (AL-20): a component whose API matches the hand-made UI5 description.
import type { Ref } from 'react';

interface Aligned {
  close(): void;
}
export interface Aligned$ItemSelectEvent {
  item: string;
  messageTypeFilter: string;
}
export interface $AlignedSettings {
  /** @defaultValue '' */
  text?: string;
  /** @defaultValue 'Information' */
  type?: 'Information' | 'Error';
  /** @defaultValue false */
  showIcons?: boolean;
  onItemSelect?: (event: Aligned$ItemSelectEvent) => void;
  ref?: Ref<Aligned>;
}

// the instance interface merges with the component; the default export carries both (as UI5 TypeScript classes do)
function Aligned(props: $AlignedSettings) {
  return <div>{props.text}</div>;
}
export default Aligned;
