/** Mantine theme bridged to smart-kit tokens. No literal values here (AC-THEME-03). */
import { createTheme, type CSSVariablesResolver, type MantineColorsTuple } from '@mantine/core';

const shades = ['surface-2', 'hover', 'border', 'border-strong', 'text-subtle', 'text-muted', 'primary', 'primary-hover', 'primary-hover', 'text'];
const sk = shades.map((s) => `var(--sk-color-${s})`) as unknown as MantineColorsTuple;

export const smartKitMantineTheme = createTheme({
  primaryColor: 'sk',
  primaryShade: 6,
  colors: { sk },
  fontFamily: 'var(--sk-font-sans)',
  headings: { fontFamily: 'var(--sk-font-sans)' },
  defaultRadius: 'md',
  focusRing: 'auto',
  cursorType: 'pointer',
  components: {
    Button: { defaultProps: { size: 'sm' } },
    ActionIcon: { defaultProps: { size: 'md', variant: 'subtle', color: 'gray' } },
    TextInput: { defaultProps: { size: 'sm' } },
    Select: { defaultProps: { size: 'sm' } },
    MultiSelect: { defaultProps: { size: 'sm' } },
    TagsInput: { defaultProps: { size: 'sm' } },
    SegmentedControl: { defaultProps: { size: 'sm' } },
    Badge: { defaultProps: { tt: 'none' } },
  },
});

const bridge: Record<string, string> = {
  '--mantine-color-body': 'var(--sk-color-page)',
  '--mantine-color-text': 'var(--sk-color-text)',
  '--mantine-color-bright': 'var(--sk-color-text)',
  '--mantine-color-dimmed': 'var(--sk-color-text-muted)',
  '--mantine-color-anchor': 'var(--sk-color-link)',
  '--mantine-color-placeholder': 'var(--sk-color-text-subtle)',
  '--mantine-color-default': 'var(--sk-color-surface)',
  '--mantine-color-default-hover': 'var(--sk-color-hover)',
  '--mantine-color-default-color': 'var(--sk-color-text)',
  '--mantine-color-default-border': 'var(--sk-color-border-strong)',
  '--mantine-color-error': 'var(--sk-color-negative)',
  '--mantine-primary-color-filled': 'var(--sk-color-primary)',
  '--mantine-primary-color-filled-hover': 'var(--sk-color-primary-hover)',
  '--mantine-primary-color-contrast': 'var(--sk-color-text-on-primary)',
  '--mantine-primary-color-light': 'var(--sk-color-hover)',
  '--mantine-primary-color-light-hover': 'var(--sk-color-border)',
  '--mantine-primary-color-light-color': 'var(--sk-color-text)',
  '--mantine-color-sk-filled': 'var(--sk-color-primary)',
  '--mantine-color-sk-filled-hover': 'var(--sk-color-primary-hover)',
  '--mantine-color-sk-light': 'var(--sk-color-hover)',
  '--mantine-color-sk-light-hover': 'var(--sk-color-border)',
  '--mantine-color-sk-light-color': 'var(--sk-color-text)',
  '--mantine-color-sk-outline': 'var(--sk-color-text)',
  '--mantine-color-sk-outline-hover': 'var(--sk-color-hover)',
  '--mantine-color-sk-text': 'var(--sk-color-text)',
  '--mantine-color-gray-light': 'var(--sk-color-hover)',
  '--mantine-color-gray-light-hover': 'var(--sk-color-border)',
  '--mantine-color-gray-light-color': 'var(--sk-color-text-muted)',
  '--mantine-color-gray-text': 'var(--sk-color-text-muted)',
  '--mantine-color-white': 'var(--sk-color-surface)',
  '--mantine-color-black': 'var(--sk-color-text)',
};

export const smartKitCssVariablesResolver: CSSVariablesResolver = () => ({ variables: bridge, light: bridge, dark: bridge });
