/// <reference types="vite/client" />
import type { Preview } from '@storybook/tanstack-react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { initialize, mswLoader } from 'msw-storybook-addon';
import '../src/react-app/index.css';

initialize({ quiet: true, onUnhandledRequest: 'bypass' });

const preview: Preview = {
  // @storybook/tanstack-react が各 story を memory-backed な TanStack Router で
  // 自動的にラップしてくれるため、Router 側のデコレーターは不要。
  decorators: [
    (Story) => {
      // story ごとに 1 つの QueryClient を保つ（再レンダリングでキャッシュを捨てない）。
      // retry を切っておかないとエラー表示の検証に時間がかかる。
      const [queryClient] = React.useState(
        () => new QueryClient({ defaultOptions: { queries: { retry: false } } }),
      );
      return (
        <QueryClientProvider client={queryClient}>
          <Story />
        </QueryClientProvider>
      );
    },
  ],
  loaders: [mswLoader],
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },

    a11y: {
      // 'todo' - show a11y violations in the test UI only
      // 'error' - fail CI on a11y violations
      // 'off' - skip a11y checks entirely
      test: 'todo',
    },
  },
};

export default preview;
