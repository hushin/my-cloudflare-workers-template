#!/usr/bin/env bash
#
# GitHub のリポジトリ単位セキュリティ設定を gh CLI でまとめて適用する。
#
# GitHub 側の設定はリポジトリごとに持っていてテンプレートからは引き継がれないので、
# アプリを作って push した後にこのスクリプトを一度実行する。
#
#   bash scripts/setup-github-security.sh [owner/repo]
#
# 引数を省略すると `gh repo view` からカレントリポジトリを解決する。
# 何度実行してもよい（冪等）。各ステップで何をしたかを 1 行出力する。
#
#   - Dependabot alerts / security updates
#   - CodeQL default setup
#   - secret scanning と push protection
#   - main の ruleset（.github/rulesets/main.json。定義を編集して再実行する）
#
set -euo pipefail

REPO="${1:-}"
if [[ -z "$REPO" ]]; then
  REPO="$(gh repo view --json nameWithOwner -q .nameWithOwner)"
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RULESET_JSON="$SCRIPT_DIR/../.github/rulesets/main.json"

# 1. Dependabot alerts
gh api -X PUT "repos/$REPO/vulnerability-alerts" >/dev/null
echo "Dependabot alerts を有効化しました"

# 2. Dependabot security updates
gh api -X PUT "repos/$REPO/automated-security-fixes" >/dev/null
echo "Dependabot security updates を有効化しました"

# 3. CodeQL default setup（未対応プランなどでは失敗するので警告して続行）
if gh api -X PATCH "repos/$REPO/code-scanning/default-setup" -f state=configured >/dev/null; then
  echo "CodeQL default setup を configured にしました"
else
  echo "警告: CodeQL default setup を設定できませんでした（続行します）" >&2
fi

# 4. secret scanning と push protection（同上、失敗は警告して続行）
if printf '%s' '{"security_and_analysis":{"secret_scanning":{"status":"enabled"},"secret_scanning_push_protection":{"status":"enabled"}}}' |
  gh api -X PATCH "repos/$REPO" --input - >/dev/null; then
  echo "secret scanning と push protection を有効化しました"
else
  echo "警告: secret scanning / push protection を設定できませんでした（続行します）" >&2
fi

# 5. main の ruleset（既存なら更新、無ければ作成）
RULESET_ID="$(gh api "repos/$REPO/rulesets" --jq '.[] | select(.name == "main") | .id' | head -n 1)"
if [[ -n "$RULESET_ID" ]]; then
  gh api -X PUT "repos/$REPO/rulesets/$RULESET_ID" --input "$RULESET_JSON" >/dev/null
  echo "ruleset 'main' を更新しました (id: $RULESET_ID)"
else
  gh api -X POST "repos/$REPO/rulesets" --input "$RULESET_JSON" >/dev/null
  echo "ruleset 'main' を作成しました"
fi
