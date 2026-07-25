import type { Meta, StoryObj } from '@storybook/tanstack-react';
import { expect } from 'storybook/test';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './card';

const meta = {
  component: Card,
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Card className="max-w-md">
      <CardHeader>
        <CardTitle>Example</CardTitle>
        <CardDescription>サンプルの Todo アプリを確認できます。</CardDescription>
      </CardHeader>
      <CardContent>Card body content</CardContent>
    </Card>
  ),
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Example')).toBeVisible();
    await expect(canvas.getByText('サンプルの Todo アプリを確認できます。')).toBeVisible();
  },
};

// CssCheck: Card uses `rounded-xl` (--radius-xl = var(--radius) + 4px = 14px at the default
// root font size). A concrete computed value proves the shared preview actually loaded
// src/react-app/index.css instead of just toBeVisible() passing on an unstyled node.
export const CssCheck: Story = {
  render: () => <Card data-testid="css-check-card">content</Card>,
  play: async ({ canvas }) => {
    const card = canvas.getByTestId('css-check-card');
    await expect(getComputedStyle(card).borderRadius).toBe('14px');
  },
};
