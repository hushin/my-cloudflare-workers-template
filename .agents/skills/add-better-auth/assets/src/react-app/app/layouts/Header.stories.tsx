import type { Meta, StoryObj } from '@storybook/tanstack-react';
import { expect } from 'storybook/test';
import { Header } from './Header';
import { refetchSession, sessionHandlers } from './Header.mock';

const meta = {
  component: Header,
  // story ごとにセッションを再取得させる（詳細は Header.mock.ts）
  loaders: [refetchSession],
} satisfies Meta<typeof Header>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SignedOut: Story = {
  beforeEach: ({ msw }) => {
    msw.use(...sessionHandlers.signedOut);
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('link', { name: 'My App' })).toBeVisible();
    await expect(canvas.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/');
    await expect(canvas.getByRole('link', { name: 'Todos' })).toHaveAttribute(
      'href',
      '/example-todo',
    );
    await expect(await canvas.findByRole('link', { name: 'サインイン' })).toHaveAttribute(
      'href',
      '/sign-in',
    );
  },
};

export const SignedIn: Story = {
  beforeEach: ({ msw }) => {
    msw.use(...sessionHandlers.signedIn);
  },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('テスト ユーザー')).toBeVisible();
    await expect(canvas.getByRole('button', { name: 'サインアウト' })).toBeEnabled();
  },
};
