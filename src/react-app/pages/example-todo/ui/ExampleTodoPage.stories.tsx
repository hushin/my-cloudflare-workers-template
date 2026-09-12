import type { Meta, StoryObj } from '@storybook/tanstack-react';
import { expect, waitFor } from 'storybook/test';
import { ExampleTodoPage } from './ExampleTodoPage';
import {
  createErrorThenSuccessHandlers,
  exampleTodoHandlers,
  resetExampleTodos,
} from './ExampleTodoPage.mock';

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
    // リストの登場アニメーションが終わってから表示を確認する
    await waitFor(() => expect(canvas.getByText('Storybook を導入する')).toBeVisible());
    await waitFor(() => expect(canvas.getByText('MSW でデータをモックする')).toBeVisible());
  },
};

export const Empty: Story = {
  beforeEach: () => {
    resetExampleTodos([]);
  },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('タスクはまだありません')).toBeVisible();
    await expect(canvas.queryAllByRole('button', { name: '削除' })).toHaveLength(0);
  },
};

export const Loading: Story = {
  beforeEach: ({ msw }) => {
    msw.use(...exampleTodoHandlers.loading);
  },
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole('status', { name: '読み込み中' })).toBeVisible();
  },
};

export const FetchError: Story = {
  beforeEach: ({ msw }) => {
    msw.use(...exampleTodoHandlers.error);
  },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('タスクを読み込めませんでした')).toBeVisible();
  },
};

export const RetryAfterError: Story = {
  beforeEach: ({ msw }) => {
    msw.use(...createErrorThenSuccessHandlers());
  },
  play: async ({ canvas, userEvent }) => {
    await expect(await canvas.findByText('タスクを読み込めませんでした')).toBeVisible();

    await userEvent.click(canvas.getByRole('button', { name: '再試行' }));

    await waitFor(() => expect(canvas.getByText('Storybook を導入する')).toBeVisible());
  },
};

export const AddTodo: Story = {
  play: async ({ canvas, userEvent }) => {
    await canvas.findByText('Storybook を導入する');

    await userEvent.type(
      canvas.getByPlaceholderText('新しいタスクを入力'),
      'Interaction test を書く',
    );
    await userEvent.click(canvas.getByRole('button', { name: '追加' }));

    await waitFor(() => expect(canvas.getByText('Interaction test を書く')).toBeVisible());
    // 送信後にフォームがリセットされる
    await waitFor(() => expect(canvas.getByPlaceholderText('新しいタスクを入力')).toHaveValue(''));
  },
};

export const AddTodoValidationError: Story = {
  play: async ({ canvas, userEvent }) => {
    const input = await canvas.findByPlaceholderText('新しいタスクを入力');

    // 一度入力してから空にすると onChange バリデーションが走る
    await userEvent.type(input, 'a');
    await userEvent.clear(input);

    await waitFor(() => expect(input).toHaveAttribute('aria-invalid', 'true'));
    await expect(await canvas.findByText('タスク名を入力してください')).toBeVisible();
    await expect(canvas.queryByText('Interaction test を書く')).not.toBeInTheDocument();
  },
};

export const EditTodo: Story = {
  play: async ({ canvas, userEvent }) => {
    await canvas.findByText('Storybook を導入する');

    const [editButton] = canvas.getAllByRole('button', { name: '編集' });
    await userEvent.click(editButton);

    const editInput = await canvas.findByDisplayValue('Storybook を導入する');
    await userEvent.clear(editInput);
    await userEvent.type(editInput, 'Storybook のテストを書く');
    await userEvent.click(canvas.getByRole('button', { name: '保存' }));

    await waitFor(() => expect(canvas.getByText('Storybook のテストを書く')).toBeVisible());
    await expect(canvas.queryByText('Storybook を導入する')).not.toBeInTheDocument();
  },
};

export const CancelEditTodo: Story = {
  play: async ({ canvas, userEvent }) => {
    await canvas.findByText('Storybook を導入する');

    const [editButton] = canvas.getAllByRole('button', { name: '編集' });
    await userEvent.click(editButton);

    const editInput = await canvas.findByDisplayValue('Storybook を導入する');
    await userEvent.clear(editInput);
    await userEvent.type(editInput, '保存しない変更');
    await userEvent.click(canvas.getByRole('button', { name: 'キャンセル' }));

    await waitFor(() => expect(canvas.getByText('Storybook を導入する')).toBeVisible());
    await expect(canvas.queryByText('保存しない変更')).not.toBeInTheDocument();
  },
};

export const ToggleStatus: Story = {
  play: async ({ canvas, userEvent }) => {
    await waitFor(() => expect(canvas.getByText('Storybook を導入する')).toBeVisible());

    // 未完了のものを完了にする
    const active = canvas.getByRole('checkbox', { name: 'Storybook を導入する' });
    await expect(active).not.toBeChecked();
    await userEvent.click(active);
    await waitFor(() => expect(active).toBeChecked());

    // 完了済みのものを未完了に戻す
    const completed = canvas.getByRole('checkbox', { name: 'MSW でデータをモックする' });
    await expect(completed).toBeChecked();
    await userEvent.click(completed);
    await waitFor(() => expect(completed).not.toBeChecked());
  },
};

export const DeleteTodo: Story = {
  play: async ({ canvas, userEvent }) => {
    await canvas.findByText('Storybook を導入する');

    const [deleteButton] = canvas.getAllByRole('button', { name: '削除' });
    await userEvent.click(deleteButton);

    await waitFor(() => expect(canvas.queryByText('Storybook を導入する')).not.toBeInTheDocument());
    await waitFor(() => expect(canvas.getByText('MSW でデータをモックする')).toBeVisible());
  },
};
