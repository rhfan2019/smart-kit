// Fixture of the manifest settings check (tests/unit/check-manifest-settings.test.ts, AL-13): a template settings type
// with a wrong default, a missing setting, a wrong value set, an extra prop and a React render function.
import type { ReactNode } from 'react';

export interface $PageSettings {
  /** @defaultValue "Auto" */
  initialLoad?: 'Auto' | 'Enabled' | 'Disabled';
  /** @defaultValue true */
  liveMode?: boolean;
  /** @defaultValue "Page" */
  variantManagement?: 'Page' | 'None';
  views?: { paths: { key?: string; annotationPath: string }[]; showCounts?: boolean };
  controlConfiguration?: {
    '@com.sap.vocabularies.UI.v1.LineItem'?: {
      columns?: Record<string, { header?: string; template?(row: object): ReactNode }>;
    };
  } & Record<string, object>;
  /** smart-kit only */
  service?: string;
  /** smart-kit only, registered */
  pageKey?: string;
}
