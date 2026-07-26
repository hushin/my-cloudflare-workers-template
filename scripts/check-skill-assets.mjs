#!/usr/bin/env node
/**
 * add-on skill の `assets/` が参照実装ブランチと一致しているかを検査する。
 *
 * `.agents/skills/<skill>/assets/<path>` は、適用後に `<path>` へ置かれる実ファイル。
 * 参照実装ブランチ（既定 `example/d1-auth`）はその適用済みの姿なので、両者がズレていたら
 * 手順書が腐りかけているサイン。
 *
 *   node scripts/check-skill-assets.mjs [ref]
 *
 * ブランチは worktree に checkout されていなくてよい（git のオブジェクトから直接読む）。
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const REF = process.argv[2] ?? 'example/d1-auth';
const SKILLS_DIR = '.agents/skills';

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

function readFromRef(path) {
  try {
    return execFileSync('git', ['show', `${REF}:${path}`], { encoding: 'utf8' });
  } catch {
    return null;
  }
}

try {
  execFileSync('git', ['rev-parse', '--verify', `${REF}^{commit}`], { stdio: 'ignore' });
} catch {
  console.error(`参照実装ブランチ '${REF}' が見つかりません。`);
  process.exit(1);
}

const assetRoots = readdirSync(SKILLS_DIR)
  .map((name) => join(SKILLS_DIR, name, 'assets'))
  .filter((dir) => {
    try {
      return statSync(dir).isDirectory();
    } catch {
      return false;
    }
  });

let matched = 0;
const problems = [];

for (const root of assetRoots) {
  for (const assetPath of walk(root)) {
    // assets/ からの相対パスが、そのまま適用先のパスになる
    const target = relative(root, assetPath).split(sep).join('/');
    const assetKey = relative(SKILLS_DIR, assetPath).split(sep).join('/');

    const refText = readFromRef(target);
    if (refText === null) {
      problems.push(`MISSING  ${assetKey}\n         → ${REF} に ${target} が無い`);
      continue;
    }

    const rule = normalizers.find((n) => n.asset === assetKey);
    const left = readFileSync(assetPath, 'utf8');
    const [a, b] = rule ? [rule.normalize(left), rule.normalize(refText)] : [left, refText];

    if (a === b) {
      matched += 1;
    } else {
      problems.push(
        `DIFF     ${assetKey}\n         → git diff --no-index ${assetPath} <(git show ${REF}:${target})` +
          (rule ? `\n         （${rule.reason}）` : ''),
      );
    }
  }
}

for (const problem of problems) console.log(problem);
console.log(`\n一致 ${matched} / 不一致 ${problems.length}（参照: ${REF}）`);

if (problems.length > 0) {
  console.log(
    '\nassets と参照実装がズレています。参照実装側を正として assets を更新するか、\n' +
      '意図的な差分ならこのスクリプトの normalizers に理由付きで追加してください。',
  );
  process.exit(1);
}
