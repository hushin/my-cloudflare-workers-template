import type { Meta, StoryObj } from '@storybook/tanstack-react';
import { expect } from 'storybook/test';
import { Header } from './Header';

const meta = {
  component: Header,
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
