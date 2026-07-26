#!/usr/bin/env node
/**
 * add-on skill の `assets/` が参照実装ブランチと一致しているかを検査する。
 *
 * `<skill>/assets/<path>` は、適用後に `<path>` へ置かれる実ファイル。
 * 参照実装ブランチはその適用済みの姿なので、両者がズレていたら
 * 手順書が実態から乖離しはじめているサイン。
 *
 *   node scripts/check-skill-assets.mjs [ref]
 *
 * ref を渡すと、すべての assets をその 1 ブランチと比較する（rebase 中の確認用）。
 * ブランチは worktree に checkout されていなくてよい（git のオブジェクトから直接読む）。
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const SKILLS_DIR = '.agents/skills';
const REF_OVERRIDE = process.argv[2];

/**
 * assets のルートと、その適用済みの姿を持つ参照実装ブランチの対応。
 * skill を足したらここにも追加する（未登録の assets はエラーにする）。
 */
const ASSET_ROOTS = [
  { root: 'add-dmmf/assets', ref: 'example/dmmf-d1-auth' },
  { root: 'add-d1-drizzle/assets', ref: 'example/d1-auth' },
  { root: 'add-better-auth/assets', ref: 'example/d1-auth' },
];

/**
 * 意図的な差分の吸収。
 * skill は段階的に適用されるので、後段の skill が足す行は前段の assets には無いのが正しい。
 * 「差分あり」で握りつぶさず、その行だけ取り除いて残りは厳密に比較する。
 */
const normalizers = [
  {
    asset: 'add-d1-drizzle/assets/src/worker/db/schema.ts',
    reason: 'add-better-auth が末尾に足す auth-schema の re-export を除いて比較',
    normalize: (text) =>
      text
        .split('\n')
        .filter((line) => line !== "export * from './auth-schema';")
        .join('\n')
        .replace(/\n+$/, '\n'),
  },
];

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

function readFromRef(ref, path) {
  try {
    return execFileSync('git', ['show', `${ref}:${path}`], { encoding: 'utf8' });
  } catch {
    return null;
  }
}

function assertRefExists(ref) {
  try {
    execFileSync('git', ['rev-parse', '--verify', `${ref}^{commit}`], { stdio: 'ignore' });
  } catch {
    console.error(`参照実装ブランチ '${ref}' が見つかりません。`);
    process.exit(1);
  }
}

// 登録漏れの検出: 実在する assets ディレクトリがすべて ASSET_ROOTS に載っているか
for (const skill of readdirSync(SKILLS_DIR)) {
  const assetsDir = join(SKILLS_DIR, skill, 'assets');
  try {
    if (!statSync(assetsDir).isDirectory()) continue;
  } catch {
    continue;
  }
  const covered = ASSET_ROOTS.some(({ root }) => root.split('/')[0] === skill);
  if (!covered) {
    console.error(`${skill}/assets が ASSET_ROOTS に登録されていません。`);
    process.exit(1);
  }
}

let matched = 0;
const problems = [];

for (const { root, ref: declaredRef } of ASSET_ROOTS) {
  const ref = REF_OVERRIDE ?? declaredRef;
  assertRefExists(ref);

  const rootDir = join(SKILLS_DIR, root);
  for (const assetPath of walk(rootDir)) {
    // assets のルートからの相対パスが、そのまま適用先のパスになる
    const target = relative(rootDir, assetPath).split(sep).join('/');
    const assetKey = relative(SKILLS_DIR, assetPath).split(sep).join('/');

    const refText = readFromRef(ref, target);
    if (refText === null) {
      problems.push(`MISSING  ${assetKey}\n         → ${ref} に ${target} が無い`);
      continue;
    }

    const rule = normalizers.find((n) => n.asset === assetKey);
    const left = readFileSync(assetPath, 'utf8');
    const [a, b] = rule ? [rule.normalize(left), rule.normalize(refText)] : [left, refText];

    if (a === b) {
      matched += 1;
    } else {
      problems.push(
        `DIFF     ${assetKey}\n         → git diff --no-index ${assetPath} <(git show ${ref}:${target})` +
          (rule ? `\n         （${rule.reason}）` : ''),
      );
    }
  }
}

for (const problem of problems) console.log(problem);
console.log(`\n一致 ${matched} / 不一致 ${problems.length}`);

if (problems.length > 0) {
  console.log(
    '\nassets と参照実装がズレています。参照実装側を正として assets を更新するか、\n' +
      '意図的な差分ならこのスクリプトの normalizers に理由付きで追加してください。',
  );
  process.exit(1);
}
