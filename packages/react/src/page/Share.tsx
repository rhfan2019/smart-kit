/**
 * sap.fe.macros.Share (ADR-033; LR Header Toolbar, OP Actions): an icon button that opens an action sheet with "Send Email"
 * and "Copy Link". "Save as Tile", "Share in SAP Jam" and "Share in SAP Build Work Zone" depend on the SAP platform and are
 * not offered (docs/12 U-3), as SAPUI5 hides them outside it. The link comes from the injected NavigationAdapter (the
 * library never reads the URL, NAV-06).
 */
import { ActionIcon, Menu, Tooltip } from '@mantine/core';
import { Link2, Mail, Share2 } from 'lucide-react';
import { useState } from 'react';
import { useText } from '../context/SmartKitProvider';

/** sap.fe.macros.share.ShareOptions */
export interface ShareOptions {
  /** Offer "Share in SAP Build Work Zone": not available outside SAP BTP, so never shown (as SAPUI5 does there). */
  showShareInWorkzone?: boolean;
}

export interface $ShareSettings {
  /** Options of the share menu. */
  shareOptions?: ShareOptions;
  /** Extension: link to share (relative links are resolved against the document base URI); FE takes the app URL. */
  href?: string;
  /** Extension: subject of the e-mail; FE takes the page title. */
  title: string;
}

export function Share(p: $ShareSettings) {
  const t = useText();
  const [copied, setCopied] = useState(false);
  const url = p.href ? new URL(p.href, document.baseURI).toString() : '';
  return (
    <Menu position="bottom-end" onClose={() => setCopied(false)}>
      <Menu.Target>
        <Tooltip label={t('actions.share')}>
          <ActionIcon variant="subtle" aria-label={t('actions.share')} data-sk-share><Share2 className="sk-icon" /></ActionIcon>
        </Tooltip>
      </Menu.Target>
      <Menu.Dropdown data-sk-share-menu>
        <Menu.Item component="a" href={`mailto:?subject=${encodeURIComponent(p.title)}&body=${encodeURIComponent(url)}`} leftSection={<Mail className="sk-icon" />} data-sk-share-email>
          {t('actions.sendEmail')}
        </Menu.Item>
        <Menu.Item closeMenuOnClick={false} leftSection={<Link2 className="sk-icon" />} onClick={() => void navigator.clipboard?.writeText(url).then(() => setCopied(true))} data-sk-share-copy>
          {copied ? t('actions.linkCopied') : t('actions.copyLink')}
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}
