---
name: tanstack-router
description: Use when touching routing in this repo — adding or moving files under src/react-app/routes, the routes/pages split, search params (validateSearch), route loaders with TanStack Query (queryClient wiring, defaultPreloadStaleTime), router context for guards, or code splitting. Trigger when the user mentions route, ルーティング, 画面追加, search params, クエリパラメータ, loader, beforeLoad, redirect, 認証ガード, routeTree, or TanStack Router.
---

# tanstack-router — このリポジトリでのルーティングの扱い

TanStack Router の一般的な API の説明（Link / loader / beforeLoad / code splitting の仕様）は書かない。ここは、このリポジトリを読むだけでは分からない前提と、間違えやすい点を「正解の形」で持つ。

## ルートと画面の役割

- `src/react-app/routes/*.tsx` は薄いルート定義。`validateSearch` / `loader` / `beforeLoad` はここ、画面本体は `pages/<slice>/ui/`（構造は `fsd` skill）
- **pages 側から `Route` を import しない**。分割チャンクからルート定義（critical chunk）を参照し返す形になるため、公式ガイドは `getRouteApi('/path')` を指示している（`useSearch({ from: '/path' })` でもよい）。既存 pages はまだ route フック未使用なので、前例が無いまま `Route.useSearch()` と書くとこの規約を破りやすい
- `from` に渡すのは URL ではなく **route id**。`_` でエスケープしたファイルは id にも残る（`posts_.$postId.tsx` の id は `/posts_/$postId`、URL は `/posts/$postId`）
- `routeTree.gen.ts` はコミット対象の生成物。手で編集しない（パスはファイル名から決まる）
- 型は `app/bootstrap/router.ts` の `declare module` の `Register` が効かせている。この宣言を動かさない
- `vite.config.ts` の `routeFileIgnorePattern` で `*.stories.tsx` / `*.mock.ts` はルート扱いから除外済み

## 正解の形（search params + loader + Query）

```tsx
// src/react-app/routes/posts.tsx — ルート定義は値の import だけ、component は pages から
import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { PostsPage, postsQuery } from '@/react-app/pages/posts';

export const Route = createFileRoute('/posts')({
  // zod v4 はスキーマをそのまま渡せる（@tanstack/zod-adapter は不要）。
  // search params は JSON-first なので ?page=2 は number で来る（z.coerce は不要）。
  // JSON として読めない値は文字列のまま届く（?page=abc は 'abc'）。壊れた URL は .catch() で落とす
  validateSearch: z.object({
    page: z.number().int().min(1).catch(1), // 壊れた URL は既定値に落とす
  }),
  // search は loader に直接渡らない。キャッシュキーに効く param だけを宣言する
  // （({ search }) => search にすると無関係な変更でも loader が再実行される）
  loaderDeps: ({ search }) => ({ page: search.page }),
  // 遷移前にキャッシュを温める。取得は query()、鮮度管理は Query に任せる
  // （ensureQueryData は非推奨。訓練データではこちらを書きがち）
  loader: ({ context, deps }) =>
    context.queryClient.query({ ...postsQuery({ page: deps.page }), staleTime: 'static' }),
  component: PostsPage,
});
```

```tsx
// src/react-app/pages/posts/ui/PostsPage.tsx
import { useSuspenseQuery } from '@tanstack/react-query';
import { getRouteApi } from '@tanstack/react-router';
import { postsQuery } from '../api';

const routeApi = getRouteApi('/posts'); // Route を import しない（code splitting を壊さない）

export function PostsPage() {
  const { page } = routeApi.useSearch(); // 推論された型。注釈もキャストも付けない
  const { data } = useSuspenseQuery(postsQuery({ page })); // loader と同じ queryOptions を購読
  // ...
}
```

`postsQuery` のような `queryOptions` は slice の `api/` に置いて `index.ts` から公開し、loader（遷移前の取得）と component（購読）で同じ定義を共有する。片方だけ別のキー・別の関数にすると二重取得になる。

## loader をどこまで使うか

この形を全部の画面で使う必要はない。判断の軸は「最初の描画にデータが要るか」。

loader に寄せる: URL の param / search で内容が決まる一覧・詳細。遷移が始まった時点でキャッシュが温まりローディングのちらつきが消える。`defaultPreload: 'intent'`（または `Link` の `preload="intent"`。既定は `false`）を書けば hover でも先読みする。

component 側の `useQuery` のままでよい: 操作のあとに初めて取るデータ（「もっと見る」、検索ボタン、タブを開いたとき）、最初の描画に要らない補助データ（`isPending` で骨組みを出せば済む）、`ExampleTodoPage` のような画面完結の CRUD。

判断材料:

- 配線（queryClient の context、`defaultPreloadStaleTime: 0`）はグローバルだが、**loader は route 単位**。必要な route にだけ入れてよい
- `validateSearch` / `loaderDeps` / `loader` は main bundle に残る（分割されない）。複雑な処理や重い import を loader に持ち込まない
- 同じデータを loader と component の両方で取らない（`queryOptions` を共有して、片方はキャッシュを温める、片方は購読する）
- 主要データを loader、補助データを `useQuery` という混在は普通の選択
- 「もっと見る」形式の cursor ページングは `useInfiniteQuery` になる。loader で温めるには `queryClient.infiniteQuery({ ...options })` が要る（plain な `query()` で温めた key を infinite の observer に渡すと壊れる。`prefetchInfiniteQuery` は非推奨）

## loader / Query を使うときの配線

現状は `__root.tsx` が `createRootRoute()`（context なし）、`router.ts` が `createRouter({ routeTree })` のみ、`queryClient` は `AppProviders.tsx` の中で export されていない。この状態で `context.queryClient` を読むと型エラーになるので、先に次の形へ変える。

```tsx
// src/react-app/app/bootstrap/query-client.ts（新規）
export const queryClient = new QueryClient();

// src/react-app/routes/__root.tsx
export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: RootLayout,
});

// src/react-app/app/bootstrap/router.ts
export const router = createRouter({
  routeTree,
  context: { queryClient },
  // 既定 30 秒の preload キャッシュが Query の鮮度管理と衝突するため 0 にする
  defaultPreloadStaleTime: 0,
});

// src/react-app/app/bootstrap/AppProviders.tsx — Provider と router context で同じインスタンスを共有
<QueryClientProvider client={queryClient}>
  <RouterProvider router={router} />
</QueryClientProvider>;
```

## ガード（session を beforeLoad で使う）

`add-better-auth` を適用しても router context は配線されない。session を `beforeLoad` / `loader` から使うなら、自分で context に足す。

```tsx
// src/react-app/routes/__root.tsx
export const Route = createRootRouteWithContext<{ queryClient: QueryClient; auth: AuthState }>()({
  component: RootLayout,
});

// src/react-app/app/bootstrap/router.ts
// createRouter の context は省略できないので、live 値には初期値を置く（undefined! はその印）
export const router = createRouter({
  routeTree,
  context: { queryClient, auth: undefined! },
  defaultPreloadStaleTime: 0,
});

// src/react-app/app/bootstrap/AppProviders.tsx — live な値はここから注入する（router は作り直さない）
<RouterProvider router={router} context={{ auth }} />;
```

```tsx
// src/react-app/routes/_authenticated.tsx — component を書かなければ Outlet が既定
import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: ({ context, location }) => {
    if (!context.auth.isAuthenticated) {
      throw redirect({ to: '/sign-in', search: { redirect: location.href } });
    }
  },
});

// src/react-app/routes/_authenticated/dashboard.tsx（子ルートが必要）
export const Route = createFileRoute('/_authenticated/dashboard')({
  component: DashboardPage,
});
```

- 戻り先を `search` に載せるときは、受ける側（`/sign-in` の `validateSearch`）で `//` 始まりや非文字列を弾く
- `beforeLoad` を try/catch で囲むと redirect が握り潰される。`isRedirect(e)` で再スローする
- pathless レイアウトに子を書かないと、そのルートが leaf として `/` を占め、`index.tsx` とパスが重複して routeTree の生成が失敗する
- `beforeLoad` はナビゲーションごとに全マッチで再実行される（再利用されるのは loader）。ここで `authClient.getSession()` のように HTTP を await すると遷移のたびに往復が入る。session は context（live 値）や Query のキャッシュに載せ、`beforeLoad` は既にある値を読む
- context の値を差し替えただけでは matches は再評価されない。session の user が変わったときは `router.invalidate()` する
- クライアント側のガードは UI の話。同じ条件を Hono route 側でも認可する（RPC を直接叩けば通ってしまう）

## 検証

- route を足したら、型チェックの前に一度 `pnpm exec vite build`（または `pnpm dev`）で `routeTree.gen.ts` を再生成する。生成前に型チェックすると「そんなルートは無い」で落ちる
- 生成が失敗しても `vite build` は exit 0 で終わり、`routeTree.gen.ts` が古いまま残る（パス重複などは console にエラーが出るだけ）。route を足したら生成物が実際に更新されたかを見る
- `?tsr-split=component` は自動分割の印。dev のモジュール URL に付くのは正常
- story のルーターは既定だと合成ルート 1 本で、実ルートのネスト・遷移・search の反映・loader の発火は検出できない（`@storybook/tanstack-react`）。`parameters.tanstack.router.route` に `Route` を渡せば実ツリーが複製され、そこまでは検証できる。最終確認は `pnpm dev` で触る

## その他の注意

- loader のエラーからの再試行は `router.invalidate()`。component 側の `reset()` だけでは loader が再実行されない
- 既存ナビの active 表示は `data-status="active"` に依存している（`Header.tsx` の `data-[status=active]:`）。見た目を揃えるときはこれに合わせる
- リンクをボタンとして使うときの `render` prop は `shadcn-ui` skill 側の規約
