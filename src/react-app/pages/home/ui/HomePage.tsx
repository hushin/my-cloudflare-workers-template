import { Link } from '@tanstack/react-router';
import { Button } from '@/react-app/shared/ui';

const stack = [
  { name: 'Cloudflare Workers', role: 'API とアセット配信' },
  { name: 'Hono 4', role: 'ルーティングと RPC の型付け' },
  { name: 'React 19 + Vite 8', role: 'SPA のビルド' },
  { name: 'TanStack Router / Query / Form', role: '画面遷移・データ取得・フォーム' },
  { name: 'shadcn/ui + Tailwind CSS v4', role: 'UI キットとテーマ' },
  { name: 'Vitest + Storybook 10', role: 'テストとカタログ' },
];

export function HomePage() {
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-12">
      <header className="flex flex-col gap-3">
        <h1 className="text-3xl font-semibold tracking-tight text-balance">
          Cloudflare Workers テンプレート
        </h1>
        <p className="text-sm leading-6 text-muted-foreground break-keep">
          Hono の API と React の SPA を 1 つの Worker にまとめた、個人用のスターターテンプレート。
        </p>
      </header>

      <section className="flex items-start justify-between gap-6 rounded-xl border border-border bg-card px-5 py-4 shadow-sm">
        <div className="flex flex-col gap-1">
          <h2 className="text-sm font-medium">Example Todo</h2>
          <p className="text-sm text-muted-foreground">
            追加・編集・削除の CRUD と、Storybook でのテスト方法を確認できます。
          </p>
        </div>
        <Button render={<Link to="/example-todo" />} className="shrink-0">
          開く
        </Button>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-medium">構成</h2>
        <dl className="divide-y divide-border border-t border-border">
          {stack.map((item) => (
            <div key={item.name} className="flex items-baseline justify-between gap-6 py-3">
              <dt className="text-sm font-medium">{item.name}</dt>
              <dd className="text-right text-sm text-muted-foreground">{item.role}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
