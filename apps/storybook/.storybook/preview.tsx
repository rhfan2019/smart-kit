import '@mantine/core/styles.css';
import '@mantine/dates/styles.css';
import '@rhfan2019/smart-kit/styles.css';
import type { Preview } from '@storybook/react-vite';
import { Providers } from '../stories/providers';

const preview: Preview = {
  globalTypes: {
    theme: { description: 'smart-kit theme', toolbar: { icon: 'paintbrush', items: ['yellow', 'navy', 'dark'] } },
    density: { description: 'density', toolbar: { icon: 'component', items: ['comfortable', 'compact'] } },
    locale: { description: 'language', toolbar: { icon: 'globe', items: ['en', 'zh'] } },
  },
  initialGlobals: { theme: 'yellow', density: 'comfortable', locale: 'en' },
  decorators: [
    (Story, ctx) => {
      document.documentElement.dataset.theme = ctx.globals.theme as string;
      document.documentElement.dataset.density = ctx.globals.density as string;
      return (
        <Providers locale={(ctx.globals.locale as 'en' | 'zh') ?? 'en'}>
          <Story />
        </Providers>
      );
    },
  ],
};
export default preview;
