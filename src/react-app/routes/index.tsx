import { Link, createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/')({
  component: Index,
});

function Index() {
  return (
    <div className="page">
      <h1>Hello World</h1>
      <Link to="/example-todo">Example Todo</Link>
    </div>
  );
}
