# Hono RPC 型安全ガイド

## フロントエンド: Hono RPC レスポンスの型付け

Hono RPC クライアントでレスポンスを受け取る際、ローカルのインターフェースを定義して `as unknown as T` でキャストすると、`@typescript-eslint/no-unsafe-type-assertion` 違反になる。

代わりに `InferResponseType` を使い、Hono route のレスポンス型から直接型を導出する。

### 使い方

```typescript
import type { InferResponseType } from 'hono/client';
import { client } from '../client';

// GET /api/items の 200 レスポンスの型を導出
type ItemsData = InferResponseType<typeof client.api.items.$get, 200>;
// 配列の要素型が必要な場合
type ItemData = ItemsData[number];

// 使用例
const [items, setItems] = useState<ItemsData>([]);
const res = await client.api.items.$get();
const data = await res.json();
setItems(data); // キャスト不要
```

### 利点

- `eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion` が不要
- フロントエンドと Hono route で型定義が二重管理になるのを防ぐ
- route のレスポンス形状変更が型エラーとしてフロントエンドに伝播する
- `item.status` などの具体的なリテラル型がそのまま伝わる（ローカルI/Fで `string` に広がらない）

### 注意点

- route 内の `c.json()` が複数ある場合、`InferResponseType<T, 200>` の第2引数でステータスコードを指定して成功レスポンスだけ抽出する
- route が method chain（`.get().post()`）で定義されていても正しく動作する
- エラーレスポンスとのユニオン型になる場合は `as ItemsData` のような単一の型アサーションで narrow できる（`any`/`unknown` からのアサーションではないため lint 違反にならない）

## ルート mount 時のパスはリテラルで書く

`.route()` の第1引数に `string` 型の式（関数の戻り値やテンプレートリテラル）を渡すと、ルートパスの型が `${string}` になり、`client.api["items"]` のようなアクセスが**別のルートの型に解決される**ことがある。

```typescript
// NG: getApiPath の戻り値は string 型 → RPC 型解決が壊れる
.route(`/${getApiPath("items")}`, itemsRoute)

// OK: リテラルで書く
.route("/items", itemsRoute)
```

動的キー `client.api[apiPath]` でエンドポイントを切り替える代わりに、`switch` で各エンドポイントを明示的に呼び分けること。

## Worker: リクエストバリデーション

Worker のリクエストバリデーションでは、`isRecord()` による手動チェック + `as unknown as T` ではなく、`@hono/zod-validator` + zod スキーマを使う。

### 使い方

```typescript
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';

const postBodySchema = z.object({
  name: z.string(),
  status: z.string(),
  isPublic: z.boolean().optional(),
});

// zValidator をミドルウェアとして挿入
app.post('/', zValidator('json', postBodySchema), async (c) => {
  const body = c.req.valid('json');
  // body は zod スキーマから推論された型で型安全
  // typeof body = { name: string; status: string; isPublic?: boolean }
});
```

### 利点

- `as unknown as T` の unsafe アサーションが不要
- バリデーションルールと型定義が一元管理される
- zod の `.email()` / `.enum()` / `.refine()` などで詳細な検証が可能
- Hono RPC にリクエストボディの型が伝播し、フロントエンドの `hc` クライアントでも型安全に `$post()` を呼べる

### 既存パターンからの移行

#### Before

```typescript
let body: PostBody;
try {
  const raw = await c.req.json();
  if (!isRecord(raw) || typeof raw.name !== 'string') {
    return c.json({ error: '必須です' }, 400);
  }
  body = raw as unknown as PostBody;
} catch {
  return c.json({ error: 'リクエストボディが不正です' }, 400);
}
```

#### After

```typescript
const postBodySchema = z.object({
  name: z.string(),
  status: z.string(),
});

// handler に zValidator を追加し、c.req.valid("json") で受け取る
```

### 注意点

- zod v4 (`^4.4.3`) と `@hono/zod-validator@^0.8.0` の組み合わせで動作確認済み
- zod スキーマに `z.string().email()` などを使うと、バリデーションエラー時のレスポンスボディが自動生成される（`{ success: false, error: { issues: [...] } }` 形式）。フロントエンドでエラーメッセージを詳細に表示したい場合は対応が必要
