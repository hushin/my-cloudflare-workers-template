---
name: template-maintenance
description: Use when maintaining this template repository itself rather than an app built from it — keeping add-on skill assets in sync with the example/d1-auth reference branch, running pnpm skills:check, rebasing example/* branches, managing skills-lock.json / external skills, Dependabot config, and deriving a new app from the template (what to rename and delete). Trigger when the user mentions テンプレート本体, 参照実装ブランチ, example/d1-auth, skills:check, assets がズレる, add-on skill の同期, アプリを作る, テンプレートから作る, or asks what to delete after creating an app from the template.
---

# template-maintenance — テンプレート本体のメンテ

この skill は**テンプレートリポジトリ本体**（このリポジトリの main）を保守するときのもの。
テンプレートからアプリを作ったら、このディレクトリごと削除してよい（`AGENTS.md` / `README.md` に
ある `template-maintenance` への参照行も消す）。

## 参照実装ブランチと assets の同期

add-on skill の `assets/` は「適用後にそのパスへ置かれる実ファイル」で、適用しきった姿を
`example/*` ブランチで維持している（直接 merge して使うものではない）。

| ブランチ          | 適用済みの skill                     |
| ----------------- | ------------------------------------ |
| `example/d1-auth` | `add-d1-drizzle` + `add-better-auth` |

main を更新したら、手順書（`SKILL.md`）・`assets/`・参照実装ブランチの 3 つを一致させる。

1. `git fetch origin`
2. `.wt/` 配下に `example/d1-auth` の worktree を用意して `git rebase main`
3. main 側で `assets/` を変えた場合は、rebase 後の example 側もそれに合わせる
4. `pnpm check && pnpm test`
5. `pnpm skills:check` で `assets/` と参照実装ブランチのズレが無いことを確認
6. `git push --force-with-lease origin example/d1-auth`、worktree を片付ける

`pnpm skills:check`（`scripts/check-skill-assets.mjs`）の決まり:

- `ASSET_ROOTS` の対応表に従い、`<skill>/assets/<path>` と `<ref>:<path>` を比較する
- **add-on skill を新しく足したら `ASSET_ROOTS` にも登録する**（未登録の assets はエラーになる）
- rebase 中は `pnpm skills:check <ref>` で全 assets をその 1 ブランチと比較できる
- 後段の skill が足す行など意図的な差分は `normalizers` で吸収する
- CI には入れていない。手元で実行する

## 外部スキル（skills-lock.json）

外部リポジトリ由来の skill（`cloudflare/skills`, `honojs/skills` など）は実体を追跡せず、
`skills-lock.json` だけをコミットして `.agents/skills/` に復元する（`mise run setup` に含まれる
`pnpm skills experimental_install`）。

- 追加: `pnpm skills add <owner>/<repo> --skill <name> -a pi -y`
- 削除: `pnpm skills remove <name> -y` / 更新: `pnpm skills update -p`
- `-a pi` を付けると canonical な `.agents/skills/` だけに入る（`.claude/skills` はここへの symlink）
- lock は commit を固定せず default branch の先端を取る。復元後に `skills-lock.json` に差分が出たら確認して commit する
- リポジトリが保守する skill は `.gitignore` の許可リストで追跡する（足したら `!/.agents/skills/<name>/` も足す）

## Node の版

Node の版は `.node-version` にだけ書く。mise は `mise.toml` の `[settings]` で、Cloudflare Workers Builds は
自前でこのファイルを読む（Workers Builds は `mise.toml` を読まない）。上げるときは `.node-version` と
`@types/node` の major を一緒に上げる（Dependabot は `@types/node` の major を上げない設定）。

## Dependabot

`.github/dependabot.yml`（週次更新）と `.github/workflows/dependabot-auto-merge.yml`
（minor / patch の自動マージ）はテンプレート本体用。アプリでは不要なら削除する。

### security_update_not_possible で落ちるとき

pnpm の**推移的依存**が脆弱なままだと、セキュリティ更新ジョブが `security_update_not_possible` で
失敗する。Dependabot は推移的依存に `pnpm update <pkg>@<ver> --lockfile-only --no-save -r` を流すが、
これは pnpm では no-op になる（dependabot-core#15766）。設定ミスではないので、`dependabot.yml` を
いじっても直らない。

1. 対象を確認する

   ```bash
   gh api -X GET /repos/{owner}/{repo}/dependabot/alerts -f state=open \
     --jq '.[] | "\(.number)\t\(.dependency.package.name)\t\(.security_vulnerability.first_patched_version.identifier // "修正版なし")"'
   ```

2. 親のレンジ内に修正版があるものは、鎖ごと手元で更新する（`<pkg>@<ver>` の形にしない）

   ```bash
   pnpm update fast-uri systeminformation seroval -r
   pnpm check && pnpm test       # 検証してから commit
   ```

   アラートは push 後の dependency graph 更新で自然に閉じる。

3. 直せないものは上流待ち。修正版が major のみ（親が `^10` なのに修正版が 11 など）か、修正版自体が
   存在しない場合。放置すると push のたびに赤い×が付くので、許容するなら dismiss する
   （`dismissed_reason` は `fix_started` / `inaccurate` / `no_bandwidth` / `not_used` / `tolerable_risk`）

   ```bash
   gh api -X PATCH /repos/{owner}/{repo}/dependabot/alerts/<number> \
     -f state=dismissed -f dismissed_reason=tolerable_risk \
     -f dismissed_comment='dev 専用の CLI 依存。上流のレンジ拡大待ち'
   ```

`pnpm audit` で手元の残数も確認できる。2026-11 の実例: `pnpm update fast-uri systeminformation seroval
ip-address brace-expansion source-map-js -r` で 23 → 2 件（残りは `minimatch` と `deepmerge`）。

## GitHub のセキュリティ設定

リポジトリ単位の設定はテンプレートから作ったアプリには引き継がれない。
`bash scripts/setup-github-security.sh [owner/repo]`（省略時は `gh repo view` から解決）で
まとめて適用する。冪等なので何度実行してもよい。テンプレート本体にも適用済み。

適用されるもの:

- Dependabot alerts / security updates
- CodeQL default setup
- secret scanning と push protection
- `main` の ruleset（`.github/rulesets/main.json`）: 削除と force push の禁止、PR 必須、
  `ci` の成功必須、admin（RepositoryRole 5）は bypass

ruleset を変えるときは `.github/rulesets/main.json` を編集してスクリプトを再実行する。
`ci.yml` のジョブ名を変えたら `context`（今は `ci`）も合わせる。

## テンプレートからアプリを作るとき

置換:

- `package.json` の `name` / `description`、`wrangler.json` の `name`、`index.html` の `<title>`
- `AGENTS.md` / `README.md` のタイトルと概要（TODO コメントを消す）
- `src/react-app/pages/home/ui/HomePage.tsx` のテンプレート紹介文

削除:

- `.agents/skills/template-maintenance/`（この skill）と、`.gitignore` の許可リスト行、
  `AGENTS.md` / `README.md` の参照行
- `scripts/check-skill-assets.mjs` と `package.json` の `skills:check`
- `.github/dependabot.yml` / `.github/workflows/dependabot-auto-merge.yml`
- `example/*` ブランチ（origin）と `.wt/` の worktree
- サンプル画面（`src/react-app/pages/example-todo/`。DB を入れるなら `add-d1-drizzle` 適用時に置き換わる）
- 外部スキルが不要なら `skills-lock.json`、`skills` devDependency、`mise.toml` の復元行、
  `.gitignore` の Agent skills ブロック、`AGENTS.md` の「外部スキル」節

作成後:

- GitHub に push したら `bash scripts/setup-github-security.sh` を実行する
  （ruleset の `ci` は一度 CI が走ってから required check として効く）
- Workers Builds を繋いだら、最初のビルドログで `.node-version` の Node が使われていることを確認する

残す: `add-d1-drizzle` / `add-better-auth`（DB・認証を足すときに使う）、`.github/workflows/ci.yml`、
`scripts/setup-github-security.sh`、`.github/rulesets/`、`docs/`、`.agents/skills/` の自前 skill。
