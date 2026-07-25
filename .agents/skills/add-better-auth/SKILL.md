---
name: add-better-auth
description: Use when this app needs user authentication — adds Better Auth with GitHub OAuth on Cloudflare Workers（createAuth ファクトリ、Hono へのマウント、セッション middleware、サインインページ、シークレット設定まで）. Requires the add-d1-drizzle skill to be applied first. Trigger when the user mentions better-auth, 認証, ログイン, サインイン, セッション, OAuth, GitHub ログイン, ユーザー, or asks to protect an API route.
---

# add-better-auth — Better Auth（GitHub OAuth）を追加する

このテンプレートの **main は認証なしの最小構成**。ログインが要るアプリでだけこの skill を適用する。

**前提: `add-d1-drizzle` skill が適用済みであること**（`src/worker/db/` と `drizzle/` が存在し、
`pnpm db:generate` が動く状態）。auth のテーブルも同じ drizzle のマイグレーションに載せる。

`assets/` 以下は配置先と同じ相対パスで実ファイルが入っている。

## 手順

### 1. 依存を追加

`add-pnpm-package` skill の手順に従って追加する。

```bash
pnpm add better-auth
```

`nodejs_compat`（better-auth の `AsyncLocalStorage` に必要）は `wrangler.json` に設定済みなので
追加作業は不要。

### 2. auth 設定を配置

`assets/src/worker/auth/` を `src/worker/auth/` にコピーする。

| ファイル        | 役割                                                         |
| --------------- | ------------------------------------------------------------ |
| `options.ts`    | DB / secret を除いた共通設定。plugin を足すならここ          |
| `index.ts`      | `createAuth(env)` ファクトリと `AuthUser` / `AuthSession` 型 |
| `cli.ts`        | スキーマ生成 CLI 専用のエントリ（実行時には使わない）        |
| `middleware.ts` | `sessionMiddleware` / `requireAuth` と `AuthEnv` 型          |

**`createAuth` をモジュールトップで呼ばない**。Workers の `env` はリクエストスコープなので、
ハンドラの中で `createAuth(c.env)` として都度生成する。

### 3. auth テーブルのスキーマを生成

better-auth の CLI に `cli.ts` を読ませて drizzle スキーマを吐かせる。

```bash
npx @better-auth/cli@latest generate --config src/worker/auth/cli.ts --output src/worker/db/auth-schema.ts
```

生成物はダブルクォートで出力されるので、続けて `pnpm fmt` を走らせる
（そうしないと `fmt:check` が落ちる）。

生成された `src/worker/db/auth-schema.ts` を `src/worker/db/schema.ts` から re-export して、
drizzle-kit の対象に入れる。

```ts
// src/worker/db/schema.ts の末尾に追加
export * from './auth-schema';
```

そのうえで migration を生成・適用する。

```bash
pnpm db:generate
pnpm db:migrate:local
```

`cli.ts` を経由するのは、`createAuth(env)` が Workers の `env` に依存していて Node 上の CLI から
読めないため。plugin を足したら `options.ts` を更新してこのコマンドを再実行する。

### 4. Hono にマウント

`src/worker/index.ts` の method chain の中に足す。**チェーンを切らない**
（切ると RPC の型が失われる / `writing-hono-rpc-routes` skill）。

```ts
import { createAuth } from './auth';
import { type AuthEnv, sessionMiddleware } from './auth/middleware';

const app = new Hono<AuthEnv>()
  .basePath('/api')
  // auth 自身のエンドポイントはセッション解決前に処理させる
  .on(['GET', 'POST'], '/auth/*', (c) => createAuth(c.env).handler(c.req.raw))
  .use('*', sessionMiddleware)
  .get('/health', (c) => c.json({ status: 'ok' }))
  .route('/example-todo', exampleTodoRoute);
```

- `Hono<{ Bindings: Env }>` を `Hono<AuthEnv>` に変える
- `.use('*', sessionMiddleware)` は auth のマウントより **後** に置く。Hono の middleware は
  登録順に効くので、こうすると OAuth コールバックで無駄な `getSession` が走らない

### 5. route を保護する（必要になったら / 必須手順ではない）

**この手順は適用例**。既存の route に無条件で掛けるものではない（掛けると既存の route テストと
story が 401 で壊れる）。ログインが要る route を実際に作るときに参照する。

保護したい sub-app は `Hono<AuthEnv>` で型付けし、`requireAuth` を通す。

```ts
import { type AuthEnv, requireAuth } from '@/worker/auth/middleware';

const app = new Hono<AuthEnv>().use('*', requireAuth).get('/', async (c) => {
  const user = c.get('user')!; // requireAuth を通っているので non-null
  return c.json(await someRepository.listFor(createDb(c.env), user.id));
});
```

`requireAuth` が返す 401 は RPC の型に現れない。クライアント側は `res.ok` で分岐する。

### 6. クライアント側を配置

`assets/src/react-app/` を `src/react-app/` にコピーする。

| ファイル                                                               | 内容                                                                                    |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `shared/api/auth-client.ts`                                            | `createAuthClient`（`better-auth/react`）                                               |
| `shared/api/index.ts`                                                  | public API に `authClient` / `signIn` / `signOut` / `useSession` を追加（既存を上書き） |
| `pages/sign-in/{index.ts,ui/SignInPage.tsx,ui/SignInPage.stories.tsx}` | サインインページ                                                                        |
| `routes/sign-in.tsx`                                                   | 薄い route 定義（`routeTree.gen.ts` は dev/build 時に自動再生成）                       |
| `app/layouts/Header.{tsx,mock.ts,stories.tsx}`                         | ログイン状態の表示（既存を上書き）                                                      |

FSD の規約どおり、スライスからは `@/react-app/shared/api`（`index.ts` 経由）で import する。
`shared/api/auth-client` を直接 import しない（`fsd` skill）。

**配置後に `pnpm exec vite build` を一度走らせて `routeTree.gen.ts` を再生成する。**
`pnpm check` は `lint` → `build` の順で走るので、再生成せずに `pnpm check` すると lint 段階で
`'"/sign-in"' is not assignable to keyof FileRoutesByPath` として落ちる。

### 7. シークレットを設定

`assets/.dev.vars.example` をリポジトリルートにコピーし、値を埋めた `.dev.vars` を作る
（`.dev.vars` は `.gitignore` 済み、`.dev.vars.example` は追跡対象）。

```bash
cp .dev.vars.example .dev.vars
```

GitHub OAuth App は https://github.com/settings/developers で作成し、
Authorization callback URL に以下を登録する。

- ローカル: `http://localhost:5173/api/auth/callback/github`
- 本番: `https://<your-worker-domain>/api/auth/callback/github`

本番のシークレットは `wrangler secret put` で入れる。

```bash
pnpm wrangler secret put BETTER_AUTH_SECRET
pnpm wrangler secret put GITHUB_CLIENT_ID
pnpm wrangler secret put GITHUB_CLIENT_SECRET
```

`BETTER_AUTH_URL` は秘密ではないので `wrangler.json` の `vars` に本番 URL を書く。**これは必須**。
`wrangler types` は `.dev.vars` があればそこからも `Env` を組み立てるため、`.dev.vars` を持つ
自分の手元でだけ型が通り、clone 直後や CI で `Env` の形が変わってしまう。

```jsonc
"vars": { "BETTER_AUTH_URL": "https://<your-worker-domain>" }
```

最後に `pnpm cf-typegen` を実行して `Env` にこれらの変数を反映させる。

### 8. 確認

```bash
pnpm check && pnpm test
pnpm dev   # localhost:5173 でサインイン → ユーザー名表示 → サインアウトを往復させる
```

## story でのセッションのモック

better-auth のセッション取得は Hono の route ではなく `auth.handler` が処理するため、
`AppType` から型を引けない。`shared/lib` の `createHandler` は使えないので、
`Header.mock.ts` のように msw の `http` をそのまま使う。

```ts
http.get('/api/auth/get-session', () => HttpResponse.json(session)); // ログイン済み
http.get('/api/auth/get-session', () => HttpResponse.json(null)); // 未ログイン
```

ログイン状態で分岐する画面は、**ログイン済みと未ログインの両方の story を持つ**。

### story 間でセッションが持ち越される問題

`useSession` はモジュールスコープの nanostore にセッションをキャッシュし、購読が 0 になっても
約 1 秒は store を生かしたままにする。story は連続実行されるので、**何もしないと 2 本目以降が
1 本目のセッションを再利用して msw のモックを無視する**（SignedIn 単体では通るのに
SignedOut と並べると落ちる、という形で出る）。

`Header.mock.ts` の `refetchSession` を meta の `loaders` に指定して回避する。

```ts
export const refetchSession = () => {
  authClient.$store.notify('$sessionSignal');
};
```

```ts
const meta = { component: Header, loaders: [refetchSession] } satisfies Meta<typeof Header>;
```

**`loaders` であることが必須**。`beforeEach` に置くと msw-storybook-addon の `mswLoader`
（global loader）より前に走ってしまい、前の story のハンドラで再取得してしまう。

## ハマりどころ

- **`createAuth` をモジュールトップで呼ぶと落ちる** — Workers ではモジュール評価時に `env` が無い
- **`basePath` の不一致** — worker 側（`options.ts`）とクライアント側（`auth-client.ts`）の
  `basePath` は両方 `/api/auth`。片方だけ変えると 404 になる
- **callback URL の登録漏れ** — GitHub 側に本番 URL を登録し忘れると本番でだけログインが失敗する
- **`.dev.vars` を作らずに `pnpm dev`** — `BETTER_AUTH_SECRET` が undefined でセッションが張れない
- **plugin 追加後にスキーマ再生成を忘れる** — `options.ts` を変えたら手順 3 をやり直す
- **`CardTitle` は heading ではない** — `shared/ui/card.tsx` の実体は `div`。
  `getByRole('heading')` で拾わせたいなら中に `<h1>` を置く（`SignInPage.tsx` がその形）
- **`routeTree.gen.ts` の再生成漏れ** — route ファイルを足したら build を一度通す。
  `pnpm check` は lint が先なので、再生成前に走らせると型エラーで落ちる
