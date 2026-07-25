import type { Meta, StoryObj } from '@storybook/tanstack-react';
import { expect } from 'storybook/test';
import { Header } from './Header';
import { sessionHandlers } from './Header.mock';

const meta = {
  component: Header,
} satisfies Meta<typeof Header>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SignedOut: Story = {
  parameters: { msw: { handlers: sessionHandlers.signedOut } },
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
  parameters: { msw: { handlers: sessionHandlers.signedIn } },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('テスト ユーザー')).toBeVisible();
    await expect(canvas.getByRole('button', { name: 'サインアウト' })).toBeEnabled();
  },
};
