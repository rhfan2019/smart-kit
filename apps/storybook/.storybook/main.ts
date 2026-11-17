import type { StorybookConfig } from '@storybook/react-vite';
import { defaultClientConditions } from 'vite';

const config: StorybookConfig = {
  stories: ['../stories/**/*.stories.tsx'],
  framework: { name: '@storybook/react-vite', options: {} },
  // workspace packages from their sources (exports condition `smart-kit-source`, ADR-029)
  viteFinal: (config) => ({ ...config, resolve: { ...config.resolve, conditions: ['smart-kit-source', ...defaultClientConditions] } }),
};
export default config;
