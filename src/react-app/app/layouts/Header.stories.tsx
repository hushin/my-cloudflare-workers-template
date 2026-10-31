import type { Meta, StoryObj } from '@storybook/tanstack-react';
import { expect } from 'storybook/test';
import { Header } from './Header';

const meta = {
  component: Header,
  // header は実アプリで sticky + 全幅（RootLayout の直下）。padded レイアウトだと 16px の
  // 余白が付いて sticky な header が viewport 幅にならないので、fullscreen で描く。
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof Header>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('link', { name: 'My App' })).toBeVisible();
    await expect(canvas.getByRole('link', { name: 'ホーム' })).toHaveAttribute('href', '/');
    await expect(canvas.getByRole('link', { name: 'Todo' })).toHaveAttribute(
      'href',
      '/example-todo',
    );
  },
};
