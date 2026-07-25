import type { Meta, StoryObj } from '@storybook/tanstack-react';
import { expect } from 'storybook/test';
import { Button } from './button';

const meta = {
  component: Button,
  tags: ['ai-generated'],
  args: {
    children: 'Click me',
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvas }) => {
    const button = await canvas.findByRole('button', { name: 'Click me' });
    await expect(button).toHaveTextContent('Click me');
  },
};

export const Outline: Story = { args: { variant: 'outline' } };
export const Secondary: Story = { args: { variant: 'secondary' } };
export const Destructive: Story = { args: { variant: 'destructive' } };
export const Ghost: Story = { args: { variant: 'ghost' } };
export const Link: Story = { args: { variant: 'link' } };

export const Disabled: Story = {
  args: { disabled: true },
  play: async ({ canvas }) => {
    const button = await canvas.findByRole('button', { name: 'Click me' });
    await expect(button).toBeDisabled();
  },
};
