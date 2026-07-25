# Storybook + Vitest browser mode の初回実行フレーキー

`pnpm clean --lockfile && pnpm i` の直後や、`node_modules/.cache/storybook` を消した直後の
`pnpm test` が落ち、2回目以降は通る——という症状のためのメモ。

## 症状（3つの顔があるが同じ根っこ）

いずれも `storybook` プロジェクト（vitest browser mode + chromium）側で起きる。

1. モジュール取得の失敗

   ```
   Error: Failed to import test file .../@storybook/addon-vitest/dist/vitest-plugin/setup-file-with-project-annotations.js
   Caused by: TypeError: Failed to fetch dynamically imported module: http://localhost:63315/...?import&browserv=1784971817733
   ```

   setup ファイルではなく個別の `*.stories.tsx` が対象になることもある。

2. ブラウザセッションに繋がらない（60秒待たされて終わる）

   ```
   Error: Failed to connect to the browser session "..." [storybook (chromium)] within the timeout.
   ```

3. ハングして終わらない（`timeout` で殺すまで進まない）

## 原因

Vitest browser mode のテスターページ（chromium のページ）が、起動〜モジュール読み込みの
最中に落ちる／繋がらないと、上の3パターンのどれかになる。コールドキャッシュだと Vite の依存
最適化・全ファイルの初回トランスフォームが同時に走るため踏みやすい。

上流でも未解決の既知問題:

- [vitest-dev/vitest#8471](https://github.com/vitest-dev/vitest/issues/8471) — `rm -rf node_modules && install` 直後の初回だけ Storybook のテストが落ちる（症状1と同一）
- [vitest-dev/vitest#10791](https://github.com/vitest-dev/vitest/issues/10791) — テスターページが websocket を閉じずに落ちると実行がハングする（症状3）
- [vitest-dev/vitest#10775](https://github.com/vitest-dev/vitest/issues/10775), [#8447](https://github.com/vitest-dev/vitest/issues/8447) — 読み込み中に Vite が依存を最適化するとテストの suite を見失う
- [storybookjs/storybook#33347](https://github.com/storybookjs/storybook/issues/33347) — CI で同じ `Failed to fetch dynamically imported module` が出る（open）
- [storybookjs/storybook#33067](https://github.com/storybookjs/storybook/issues/33067) — addon-vitest の依存最適化と遅さ（open）

「実行中に依存が発見されて Vite がリロードする」系（下記）は Storybook 10.3.0 で大枠が
修正済み。このリポジトリでは発火していないことを確認してある。

- [storybookjs/storybook#32049](https://github.com/storybookjs/storybook/issues/32049) — `react/jsx-dev-runtime` が事前最適化されず初回失敗（10.3.0 で修正）
- [storybookjs/storybook#34042](https://github.com/storybookjs/storybook/issues/34042) — コールドキャッシュ初回失敗。Vite が `optimizeDeps.entries` をグロブとして解釈するためスキャン漏れが起きる
- [storybookjs/storybook#33875](https://github.com/storybookjs/storybook/pull/33875) — preview annotation を `optimizeDeps.entries` に入れる修正（10.3.0）

## このリポジトリで入れている対策

| 場所                                           | 内容                                                               | 目的                                                                             |
| ---------------------------------------------- | ------------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| `pnpm-workspace.yaml` の `overrides`           | `@tanstack/react-store` をひとつに寄せる                           | 重複バージョンで依存最適化が失敗するのを防ぐ                                     |
| `pnpm-workspace.yaml` の `publicHoistPattern`  | `@tanstack/react-store` / `use-sync-external-store` をルートに公開 | Storybook がベア指定する `optimizeDeps.include` をルートから解決できるようにする |
| `.storybook/main.ts` の `optimizeDeps.include` | `react/jsx-runtime` ほか                                           | 実行中に発見されてリロードが走るのを防ぐ                                         |
| `vitest.config.ts` の `fileParallelism: false` | storybook プロジェクトのファイルを直列実行                         | 同時に立つテスターページを1枚にして初回の不安定さを避ける                        |

## 再発したときの調べ方

依存の遅延発見が原因かどうかは、まずこれで切り分ける。

```bash
rm -rf node_modules/.cache/storybook node_modules/.vite
DEBUG=vite:deps pnpm test 2>&1 | tee /tmp/deps.log
```

見どころ:

- `Crawling dependencies using entries:` — `.storybook/preview.tsx` と全 story が並んでいるか。
  現状は builder-vite が自動で入れてくれている（`*.mock.ts` は story から辿られるので明示不要）。
  抜けているものがあれば `.storybook/main.ts` の `viteFinal` で `optimizeDeps.entries` に足す。
- `✨ using post-scan optimizer result, the scanner found every used dependency` — これが出ていれば
  スキャンは完全。逆に `new dependencies optimized: X` → `optimized dependencies changed. reloading`
  が出ていたら `X` を `optimizeDeps.include` に足す（#32049 系）。
- 上記がどちらも健全なのに落ちるなら、テスターページ側の問題（#8471 / #10791）。同時に立つページを
  減らすと確率が下がる（すでに `fileParallelism: false` を入れてある）。それでも落ちるなら
  `browser.instances` を減らす・失敗率を測って許容する・vitest / storybook の更新を待つ。

失敗は確率的なので、1回通っただけでは直った判断をしないこと。失敗率はこう測る。

```bash
for i in $(seq 1 10); do
  rm -rf node_modules/.cache/storybook node_modules/.vite
  pnpm test > /tmp/run-$i.log 2>&1 || echo "run$i FAILED"
done
```

計測例（2026-07 時点、WSL2 / 24 コア、コールドキャッシュ）:

| 設定                             | 失敗 / 実行                    | 1回あたり                   |
| -------------------------------- | ------------------------------ | --------------------------- |
| 並列（`fileParallelism` 既定）   | 2 / 8（症状2と症状3が1回ずつ） | 約5秒、失敗時は60秒〜ハング |
| 直列（`fileParallelism: false`） | 0 / 22                         | 約6〜7秒                    |

キャッシュが温まっていれば並列でも連続で通ってしまうので、必ずキャッシュを消してから測ること。
