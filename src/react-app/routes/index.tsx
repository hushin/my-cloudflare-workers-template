import { Link, createFileRoute } from '@tanstack/react-router';
import { Button } from '@/react-app/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/react-app/components/ui/card';

export const Route = createFileRoute('/')({
  component: Index,
});

function Index() {
  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-2">
        <h1 className="font-heading text-3xl font-bold tracking-tight">Hello World</h1>
        <p className="text-muted-foreground">
          Cloudflare Workers + Hono + React + shadcn/ui のテンプレート
        </p>
      </section>

      <Card className="max-w-md">
        <CardHeader>
          <CardTitle>Example</CardTitle>
          <CardDescription>サンプルの Todo アプリを確認できます。</CardDescription>
        </CardHeader>
        <CardContent>
          <Button render={<Link to="/example-todo" />}>Example Todo</Button>
        </CardContent>
      </Card>
    </div>
  );
}
