/**
 * レイヤー間の import 方向を機械的に守るための設定（`pnpm lint` に含まれる）。
 *
 * oxlint / steiger と役割が違う:
 * - oxlint … 1 ファイル内のコードの書き方
 * - steiger … `src/react-app` の FSD 構造（レイヤー・スライス・public API）
 * - ここ    … `src/worker` `src/shared` `src/react-app` をまたぐ依存の向き
 *
 * ルールを足すときは「なぜその向きが禁止なのか」を comment に書く。
 * 違反の意味が分からないルールは、いずれ回避されて意味を失う。
 */
export default {
  forbidden: [
    {
      name: 'no-circular',
      comment: '循環依存。片方を分割するか、共通部分を切り出して依存の向きを一方向にする。',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
    {
      name: 'shared-is-not-allowed-to-depend-on-worker',
      comment:
        'src/shared は worker と react-app の両方から読まれる土台。worker に依存すると ' +
        'react-app のバンドルに worker のコードが混ざる（`src/shared` は DTO と定数だけに保つ）。',
      severity: 'error',
      from: { path: '^src/shared' },
      to: { path: '^src/worker' },
    },
    {
      name: 'shared-is-not-allowed-to-depend-on-react-app',
      comment: 'src/shared は UI を知らない。逆向き（react-app → shared）だけが正しい。',
      severity: 'error',
      from: { path: '^src/shared' },
      to: { path: '^src/react-app' },
    },
    {
      name: 'worker-is-not-allowed-to-depend-on-react-app',
      comment:
        'worker が react-app に依存すると、Workers のバンドルに React が入る。' +
        '共有したいものは src/shared に置く。',
      severity: 'error',
      from: { path: '^src/worker' },
      to: { path: '^src/react-app' },
    },
    {
      name: 'react-app-may-only-import-types-from-worker',
      comment:
        'react-app が worker から取ってよいのは Hono RPC の型だけ（`import type`）。' +
        '値を import すると worker の実装がクライアントのバンドルに入る。',
      severity: 'error',
      from: { path: '^src/react-app' },
      to: { path: '^src/worker', dependencyTypesNot: ['type-only'] },
    },
    {
      name: 'repositories-are-not-allowed-to-depend-on-routes',
      comment:
        'データアクセスが HTTP 層を知ってはいけない。route が repository を呼ぶ向きだけが正しい。',
      severity: 'error',
      from: { path: '^src/worker/repositories' },
      to: { path: '^src/worker/routes' },
    },
  ],
  options: {
    // 依存の解決に path alias（@/*）が必要。paths を持つのはルートの tsconfig
    tsConfig: { fileName: 'tsconfig.json' },
    // `import type` も依存として数える（数えないとグラフから消え、type-only の判定ができない）
    tsPreCompilationDeps: true,
    // node_modules は「依存として数えるが中は辿らない」。includeOnly: '^src' にすると
    // npm への依存がグラフから落ち、「この層は特定のライブラリに依存しない」系のルールが
    // 素通りする（add-dmmf の domain-must-stay-pure がそれに当たる）
    doNotFollow: { path: 'node_modules' },
    // 自動生成物と型定義だけのファイルは対象外
    exclude: { path: '(routeTree\\.gen\\.ts|worker-configuration\\.d\\.ts)$' },
  },
};
