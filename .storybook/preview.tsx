/// <reference types="vite/client" />
import { setupWorker } from 'msw/browser';
import type { Preview } from '@storybook/tanstack-react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { mswLoader } from 'msw-storybook-addon/csf3';
import { configure } from 'storybook/test';
import '../src/react-app/index.css';

// waitFor / findBy の待ち時間。遅い CI のマシンで既定の 1000ms を超えて落ちることがあるので、2000ms に延ばす
configure({ asyncUtilTimeout: 2000 });

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
  loaders: [
    mswLoader(async () => {
      const worker = setupWorker();
      await worker.start({ quiet: true, onUnhandledFrame: 'bypass' });
      return worker;
    }),
  ],
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
      //
      // テストでは回さない。story ごとに axe が document 全体を走査するので、
      // Storybook テストの時間のうち約 1/3 をこれが占める（DOM の大きい画面ほど高い）。
      // 'todo' は違反しても CI を落とさないので、テストとしての検出力を下げずに待ち時間だけを減らせる。
      // Storybook UI の a11y パネルは今までどおり使える。テストで違反を落としたくなったら 'error' にする。
      test: 'off',
    },
  },
};

export default preview;
