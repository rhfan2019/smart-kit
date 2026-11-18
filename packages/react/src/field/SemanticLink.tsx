/**
 * Smart links without the Fiori launchpad (D42): `Common.SemanticObject` on a property and
 * `UI.DataFieldWithIntentBasedNavigation`. Fiori elements asks the launchpad for the navigation targets
 * (sap.fe.macros.quickView.QuickViewDelegate, DisplayStyle "LinkWithQuickView" / the IBN link); smart-kit asks the host's
 * `NavigationAdapter.semanticTargets`. As in FE, a value without targets is plain text; one target is a direct link
 * (mdc.Link directLink), several open a popover that lists them.
 */
import { Popover, Stack, Text, UnstyledButton } from '@mantine/core';
import type { Row, SemanticTarget } from '@rhfan2019/smart-kit-core';
import { useState, type ReactNode } from 'react';
import { useSmartKit } from '../context/SmartKitProvider';

export interface SemanticLinkProps {
  semanticObject: string;
  /** DataFieldWithIntentBasedNavigation/Action: only the target of this action. */
  action?: string;
  row: Row | undefined;
  path?: string;
  service?: string;
  /** The intent of a DataFieldWithIntentBasedNavigation (one target, never a popover). */
  intent?: boolean;
  children: ReactNode;
}

/** The targets the host gives for a semantic object (empty without a NavigationAdapter.semanticTargets). */
export function useSemanticTargets(p: Omit<SemanticLinkProps, 'children' | 'intent'>): SemanticTarget[] {
  const { navigation } = useSmartKit();
  if (!navigation?.semanticTargets || !p.row) return [];
  const all = navigation.semanticTargets({ semanticObject: p.semanticObject, action: p.action, row: p.row, path: p.path, service: p.service }) ?? [];
  return p.action ? all.filter((x) => x.action === undefined || x.action === p.action) : all;
}

export function SemanticLink(p: SemanticLinkProps) {
  const [opened, setOpened] = useState(false);
  const targets = useSemanticTargets(p);
  if (!targets.length) return <>{p.children}</>;
  if (p.intent || targets.length === 1) {
    return <a className="sk-link" href={targets[0]!.href} data-sk-semantic-link={p.semanticObject} onClick={(e) => e.stopPropagation()}>{p.children}</a>;
  }
  return (
    <Popover opened={opened} onChange={setOpened} width={280} position="bottom-start" withArrow trapFocus returnFocus>
      <Popover.Target>
        <UnstyledButton className="sk-link sk-quickview__link" onClick={(e) => { e.stopPropagation(); setOpened((o) => !o); }} aria-haspopup="dialog" aria-expanded={opened} data-sk-semantic-link={p.semanticObject}>
          {p.children}
        </UnstyledButton>
      </Popover.Target>
      <Popover.Dropdown role="dialog" data-sk-semantic-links onClick={(e) => e.stopPropagation()}>
        <Stack gap="xs">
          {targets.map((x) => (
            <div key={x.href}>
              <a className="sk-link" href={x.href}>{x.text}</a>
              {x.description ? <Text size="xs" c="dimmed">{x.description}</Text> : null}
            </div>
          ))}
        </Stack>
      </Popover.Dropdown>
    </Popover>
  );
}
