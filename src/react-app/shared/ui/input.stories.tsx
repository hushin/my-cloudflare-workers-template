import type { Meta, StoryObj } from '@storybook/tanstack-react';
import { expect } from 'storybook/test';
import { Input } from './input';

const meta = {
  component: Input,
  tags: ['ai-generated'],
  args: {
    placeholder: 'New todo',
  },
} satisfies Meta<typeof Input>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByPlaceholderText('New todo')).toBeVisible();
  },
};

export const Disabled: Story = {
  args: { disabled: true },
  play: async ({ canvas }) => {
    await expect(canvas.getByPlaceholderText('New todo')).toBeDisabled();
  },
};

export const Invalid: Story = {
  args: { 'aria-invalid': true },
  play: async ({ canvas }) => {
    await expect(canvas.getByPlaceholderText('New todo')).toHaveAttribute('aria-invalid', 'true');
  },
};

export const Filled: Story = {
  play: async ({ canvas, userEvent }) => {
    const input = canvas.getByPlaceholderText('New todo');
    await userEvent.type(input, 'Buy milk');
    await expect(input).toHaveValue('Buy milk');
  },
};
