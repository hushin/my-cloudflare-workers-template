import type { Meta, StoryObj } from '@storybook/tanstack-react';
import { expect, waitFor } from 'storybook/test';
import { ExampleTodoPage } from './ExampleTodoPage';
import { exampleTodoHandlers, resetExampleTodos } from './ExampleTodoPage.mock';

const meta = {
  component: ExampleTodoPage,
  // story ごとにモックの状態を初期化して、実行順に依存しないようにする
  beforeEach: [
    () => {
      resetExampleTodos();
    },
    ({ msw }) => {
      msw.use(...exampleTodoHandlers.success);
    },
  ],
} satisfies Meta<typeof ExampleTodoPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('Storybook を導入する')).toBeVisible();
    await expect(canvas.getByText('MSW でデータをモックする')).toBeVisible();
  },
};

export const Empty: Story = {
  beforeEach: () => {
    resetExampleTodos([]);
  },
  play: async ({ canvas }) => {
    await waitFor(() => expect(canvas.queryByText('Loading...')).not.toBeInTheDocument());
    await expect(canvas.queryAllByRole('button', { name: 'Delete' })).toHaveLength(0);
  },
};

export const Loading: Story = {
  beforeEach: ({ msw }) => {
    msw.use(...exampleTodoHandlers.loading);
  },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('Loading...')).toBeVisible();
  },
};

export const FetchError: Story = {
  beforeEach: ({ msw }) => {
    msw.use(...exampleTodoHandlers.error);
  },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('Failed to load todos.')).toBeVisible();
  },
};

export const AddTodo: Story = {
  play: async ({ canvas, userEvent }) => {
    await canvas.findByText('Storybook を導入する');

    await userEvent.type(canvas.getByPlaceholderText('New todo'), 'Interaction test を書く');
    await userEvent.click(canvas.getByRole('button', { name: 'Add' }));

    await expect(await canvas.findByText('Interaction test を書く')).toBeVisible();
    // 送信後にフォームがリセットされる
    await waitFor(() => expect(canvas.getByPlaceholderText('New todo')).toHaveValue(''));
  },
};

export const AddTodoValidationError: Story = {
  play: async ({ canvas, userEvent }) => {
    const input = await canvas.findByPlaceholderText('New todo');

    // 一度入力してから空にすると onChange バリデーションが走る
    await userEvent.type(input, 'a');
    await userEvent.clear(input);

    await waitFor(() => expect(input).toHaveAttribute('aria-invalid', 'true'));
    await expect(canvas.queryByText('Interaction test を書く')).not.toBeInTheDocument();
  },
};

export const EditTodo: Story = {
  play: async ({ canvas, userEvent }) => {
    await canvas.findByText('Storybook を導入する');

    const [editButton] = canvas.getAllByRole('button', { name: 'Edit' });
    await userEvent.click(editButton);

    const editInput = await canvas.findByDisplayValue('Storybook を導入する');
    await userEvent.clear(editInput);
    await userEvent.type(editInput, 'Storybook のテストを書く');
    await userEvent.click(canvas.getByRole('button', { name: 'Save' }));

    await expect(await canvas.findByText('Storybook のテストを書く')).toBeVisible();
    await expect(canvas.queryByText('Storybook を導入する')).not.toBeInTheDocument();
  },
};

export const CancelEditTodo: Story = {
  play: async ({ canvas, userEvent }) => {
    await canvas.findByText('Storybook を導入する');

    const [editButton] = canvas.getAllByRole('button', { name: 'Edit' });
    await userEvent.click(editButton);

    const editInput = await canvas.findByDisplayValue('Storybook を導入する');
    await userEvent.clear(editInput);
    await userEvent.type(editInput, '保存しない変更');
    await userEvent.click(canvas.getByRole('button', { name: 'Cancel' }));

    await expect(await canvas.findByText('Storybook を導入する')).toBeVisible();
    await expect(canvas.queryByText('保存しない変更')).not.toBeInTheDocument();
  },
};

export const ToggleStatus: Story = {
  play: async ({ canvas, userEvent }) => {
    await canvas.findByText('Storybook を導入する');

    // 未完了のものを完了にすると表示が Reopen に変わる
    const [completeButton] = canvas.getAllByRole('button', { name: 'Complete' });
    await userEvent.click(completeButton);
    await waitFor(() => expect(canvas.getAllByRole('button', { name: 'Reopen' })).toHaveLength(2));

    // 完了済みのものを未完了に戻す
    const [reopenButton] = canvas.getAllByRole('button', { name: 'Reopen' });
    await userEvent.click(reopenButton);
    await waitFor(() =>
      expect(canvas.getAllByRole('button', { name: 'Complete' })).toHaveLength(1),
    );
  },
};

export const DeleteTodo: Story = {
  play: async ({ canvas, userEvent }) => {
    await canvas.findByText('Storybook を導入する');

    const [deleteButton] = canvas.getAllByRole('button', { name: 'Delete' });
    await userEvent.click(deleteButton);

    await waitFor(() => expect(canvas.queryByText('Storybook を導入する')).not.toBeInTheDocument());
    await expect(canvas.getByText('MSW でデータをモックする')).toBeVisible();
  },
};
