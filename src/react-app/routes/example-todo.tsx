import { createFileRoute } from '@tanstack/react-router';
import { ExampleTodoPage } from '@/react-app/pages/example-todo';

export const Route = createFileRoute('/example-todo')({
  component: ExampleTodoPage,
});
