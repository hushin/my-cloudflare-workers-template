import type { Meta, StoryObj } from '@storybook/tanstack-react';
import { expect } from 'storybook/test';
import { Separator } from './separator';

const meta = {
  component: Separator,
  tags: ['ai-generated'],
} satisfies Meta<typeof Separator>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Horizontal: Story = {
  play: async ({ canvasElement }) => {
    const separator = canvasElement.querySelector('[data-slot="separator"]');
    await expect(separator).toHaveAttribute('data-orientation', 'horizontal');
  },
};

export const Vertical: Story = {
  args: { orientation: 'vertical' },
  render: (args) => (
    <div className="flex h-8 items-center">
      <Separator {...args} />
    </div>
  ),
};
