#!/usr/bin/env node
/**
 * 单独统计 levels.ts briefing 字段独占了多少汉字 —— 判断如果删 briefing 字段
 * （或不在 UI 显示）能省多少 atlas 体积。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const hanCp = (cp) => (cp >= 0x4e00 && cp <= 0x9fff) || (cp >= 0x3400 && cp <= 0x4dbf);

const levelsTs = fs.readFileSync(path.join(repoRoot, 'games/gonglian-fangxian/game/src/config/levels.ts'), 'utf8');

// 抓所有 briefing 文案：level(...) 第 5 个参数
// 简单 regex 抓单引号字符串，含中文
const briefingChars = new Set();
const match = levelsTs.match(/'[^']*[一-鿿][^']*'/g) ?? [];
for (const m of match) {
  for (const ch of m) {
    const cp = ch.codePointAt(0);
    if (hanCp(cp)) briefingChars.add(ch);
  }
}

// CHAPTERS title 也在这个文件，但短，已经会在其他屏出现
// 简单粗暴：reportedly 大部分 briefing 字符不会在其他文件出现，跑全量 diff
const allHanInRepo = new Set();
function walk(p, acc) {
  const st = fs.statSync(p);
  if (st.isFile()) {
    const rel = path.relative(repoRoot, p);
    if (!/\.(ts|tsx|json)$/.test(rel)) return;
    if (rel.includes('/test/') || rel.includes('.test.ts')) return;
    if (rel.includes('/node_modules/')) return;
    if (rel.includes('/build/')) return;
    if (rel.includes('/dist')) return;
    if (rel.endsWith('/levels.ts')) return; // 排除自身
    const text = fs.readFileSync(p, 'utf8');
    for (const ch of text) {
      const cp = ch.codePointAt(0);
      if (hanCp(cp)) acc.add(ch);
    }
    return;
  }
  if (!st.isDirectory()) return;
  for (const e of fs.readdirSync(p)) {
    if (['node_modules', 'dist', 'build', 'test'].includes(e)) continue;
    walk(path.join(p, e), acc);
  }
}

walk(path.join(repoRoot, 'games/gonglian-fangxian'), allHanInRepo);

const briefingOnly = [...briefingChars].filter((c) => !allHanInRepo.has(c)).sort();
const sharedWithOthers = [...briefingChars].filter((c) => allHanInRepo.has(c)).sort();

console.log(`levels.ts briefing 字段独占汉字数（其他文件未出现）: ${briefingOnly.length}`);
console.log(`levels.ts briefing 字段与其他文件共享汉字数: ${sharedWithOthers.length}`);
console.log(`levels.ts briefing 字段总汉字数: ${briefingChars.size}`);
console.log('');
console.log('--- briefing 独占字（删掉就省掉的字） ---');
console.log(briefingOnly.join(' '));
