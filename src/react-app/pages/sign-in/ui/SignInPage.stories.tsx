import type { Meta, StoryObj } from '@storybook/tanstack-react';
import { expect } from 'storybook/test';
import { SignInPage } from './SignInPage';

const meta = {
  component: SignInPage,
} satisfies Meta<typeof SignInPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole('heading', { name: 'サインイン' })).toBeVisible();
    await expect(canvas.getByRole('button', { name: 'GitHub でサインイン' })).toBeEnabled();
  },
};
