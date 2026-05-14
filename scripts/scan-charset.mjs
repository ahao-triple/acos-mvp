#!/usr/bin/env node
/**
 * 扫描所有用户可见文本，生成 SDF 字体图集需要的字符集。
 *
 * 扫描范围（按用户指令）：
 *   - games/gonglian-fangxian/game/src/**\/*.{ts,tsx}（排除 /test/）
 *   - games/gonglian-fangxian/game.config.ts
 *   - games/gonglian-fangxian/assets/*.json
 *   - games/gonglian-fangxian/channels/* /build/src/manifest.json
 *
 * 输出：
 *   docs/font-charset.txt —— 提交 git 的字符集
 *   stdout —— 统计报告（汉字 / ASCII / 中文标点 / 总数 / atlas 体积估算）
 *
 * 强制纳入：
 *   - 完整 ASCII 字母 a-z A-Z 数字 0-9 + 常用标点
 *   - 中文标点 。，！？：、（）「」《》""''…—~
 *   - 健康游戏忠告固定文本
 *   - "SR" 软著号前缀
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSupportedPlatforms } from './platforms.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const supportedPlatforms = await loadSupportedPlatforms(repoRoot);

// ─── 扫描目标 ───
const includes = [
  'games/gonglian-fangxian/game.config.ts',
  'games/gonglian-fangxian/assets',
  'games/gonglian-fangxian/game/src',
];

function walkFiles(absPath, acc) {
  const stat = fs.statSync(absPath);
  if (stat.isFile()) {
    acc.push(absPath);
    return;
  }
  if (!stat.isDirectory()) return;
  for (const entry of fs.readdirSync(absPath)) {
    const sub = path.join(absPath, entry);
    if (entry === 'node_modules' || entry === 'dist' || entry === 'build' || entry === 'test') continue;
    walkFiles(sub, acc);
  }
}

function shouldScan(file) {
  const rel = path.relative(repoRoot, file);
  // 跳测试 / 测试 fixture
  if (rel.includes('/test/') || rel.endsWith('.test.ts')) return false;
  // 跳产物
  if (rel.includes('/channels/') && rel.includes('/build/')) return false;
  // 只扫源码 + 静态 json
  if (!/\.(ts|tsx|json)$/.test(rel)) return false;
  return true;
}

const targetFiles = [];
for (const inc of includes) {
  const abs = path.join(repoRoot, inc);
  if (!fs.existsSync(abs)) continue;
  walkFiles(abs, targetFiles);
}

const scannedFiles = targetFiles.filter(shouldScan);

// 也扫 channels/<platform>/build/src/manifest.json（产物 manifest 的 name 字段也可能含字）
for (const platform of supportedPlatforms) {
  const candidate = path.join(repoRoot, `games/gonglian-fangxian/channels/${platform}/build/src/manifest.json`);
  if (fs.existsSync(candidate)) scannedFiles.push(candidate);
}

// ─── 字符提取 ───
const hanCp = (cp) => (cp >= 0x4e00 && cp <= 0x9fff) || (cp >= 0x3400 && cp <= 0x4dbf); // CJK 基本 + 扩展 A
const isCjkPunct = (cp) =>
  (cp >= 0x3000 && cp <= 0x303f) ||  // CJK 符号
  (cp >= 0xff00 && cp <= 0xffef) ||  // 全角 ASCII
  (cp >= 0x2018 && cp <= 0x201d);    // ' ' " "

const collected = new Set();

for (const file of scannedFiles) {
  const text = fs.readFileSync(file, 'utf8');
  for (const ch of text) {
    const cp = ch.codePointAt(0);
    // 字面值收集：CJK / CJK 标点 / 非 ASCII 可打印
    if (hanCp(cp) || isCjkPunct(cp)) {
      collected.add(ch);
    }
  }
}

// ─── 强制叠加：中文标点（用户指令） ───
const cjkPunctRequired = '。，！？：、（）「」《》……—～；；·';
const cjkQuotes = '“”‘’'; // " " ' '
for (const ch of cjkPunctRequired + cjkQuotes) collected.add(ch);

// ─── 强制叠加：BitmapText 缺字替换 / 常驻按钮文案 ───
// text.ts 用中圆点替换 atlas 缺字；替换字符本身必须在 atlas 内，否则缺字时仍可能渲染为空。
const bitmapTextRequired = '·炸开吸走重排';
for (const ch of bitmapTextRequired) collected.add(ch);

// ─── 强制叠加：ASCII 字母/数字/标点 + 空格（用户指令） ───
const asciiSet = new Set();
const addAscii = (s) => { for (const c of s) asciiSet.add(c); };
addAscii('abcdefghijklmnopqrstuvwxyz');
addAscii('ABCDEFGHIJKLMNOPQRSTUVWXYZ');
addAscii('0123456789');
addAscii(' .,!?:;\'"()[]/\\_-+=*&%@#<>');
// 用户指令明确列了上面这些；另外把斜杠 / 反斜杠 / 单双引号都包含

// ─── 强制叠加：从源码扫到的 ASCII 可见字符（例如 "SR" 软著号前缀 / 关卡数字 "/ "等） ───
for (const file of scannedFiles) {
  const text = fs.readFileSync(file, 'utf8');
  for (const ch of text) {
    const cp = ch.codePointAt(0);
    // 只采源码 string 字面值里出现的 ASCII 可见字符，过滤代码语法噪音
    // 这里简化：不区分，统一加进 asciiSet（atlas 占用低，不会浪费）
    if (cp >= 0x20 && cp <= 0x7e) asciiSet.add(ch);
  }
}

// ─── 健康游戏忠告（规范 §三 P1 固定文本，确保收齐） ───
const healthAdvice =
  '健康游戏忠告' +
  '抵制不良游戏，拒绝盗版游戏。' +
  '注意自我保护，谨防受骗上当。' +
  '适度游戏益脑，沉迷游戏伤身。' +
  '合理安排时间，享受健康生活。';
for (const ch of healthAdvice) {
  const cp = ch.codePointAt(0);
  if (hanCp(cp) || isCjkPunct(cp)) collected.add(ch);
}

// ─── 用户预留：评级 / 反馈 / 庆祝 / 情绪 / 鼓励常用字（Q2 答复） ───
const ratingFeedback =
  // 评级类
  '完美优秀良棒厉胜利评通关差烂糟' +
  // 庆祝感叹
  '哇噢哦嘿噜牛帅酷神哈呵喵赞绝太真啧' +
  // 情绪语气
  '嗯啊呀啦嘛喔哎哼嘞' +
  // 鼓励反馈
  '加油接努继续再来力试行可';
for (const ch of ratingFeedback) {
  const cp = ch.codePointAt(0);
  if (hanCp(cp)) collected.add(ch);
}

// ─── 用户预留：公司 / 城市常用字（Q3 答复） ───
// placeholder "共联互动科技" / "SR2026001234" 上线前换真实著作权人公司名 +
// 主要中国城市常见字（注册地 / 公司地址等可能用到），预扫一批避免再次重打 atlas
const companyCity =
  '科技有限责任股份公司工作室网络互动娱乐游戏创数字智能集团信息' +
  '北上广深杭成南京苏州武汉重庆天津西安长沙青岛';
for (const ch of companyCity) {
  const cp = ch.codePointAt(0);
  if (hanCp(cp)) collected.add(ch);
}

// ─── 分类统计 ───
const han = [];
const cjkPunct = [];
const extraSymbols = []; // 非 ASCII / 非 CJK 标点但仍需打入 atlas 的符号，例如 ·

for (const ch of collected) {
  const cp = ch.codePointAt(0);
  if (hanCp(cp)) han.push(ch);
  else if (isCjkPunct(cp)) cjkPunct.push(ch);
  else extraSymbols.push(ch);
}

const ascii = [...asciiSet];

han.sort();
cjkPunct.sort();
extraSymbols.sort();
ascii.sort();

// ─── 输出 ───
const totalChars = han.length + cjkPunct.length + extraSymbols.length + ascii.length;

// 纯字符流 —— 不加任何注释 / 元信息（msdf-bmfont-xml 等工具会把 # 也当字符）。
// 元信息（总数 / 来源 / 分类）写在 docs/font-charset.report.md 或 stdout。
// 四段顺序：ASCII → 额外符号 → 中文标点 → 汉字（按 codepoint sort），用空行分隔。
const lines = [
  ascii.join(''),
  extraSymbols.join(''),
  cjkPunct.join(''),
  han.join(''),
];

const outPath = path.join(repoRoot, 'docs/font-charset.txt');
fs.writeFileSync(outPath, lines.join('\n'), 'utf8');

// stdout 报告
console.log('=== 字符集扫描报告 ===');
console.log(`扫描文件数: ${scannedFiles.length}`);
console.log(`输出: docs/font-charset.txt (${fs.statSync(outPath).size} bytes)`);
console.log('');
console.log(`汉字       : ${han.length}`);
console.log(`中文标点   : ${cjkPunct.length}`);
console.log(`额外符号   : ${extraSymbols.length}`);
console.log(`ASCII      : ${ascii.length}`);
console.log(`合计       : ${totalChars}`);
console.log('');
console.log('--- 汉字（前 60 个示例）---');
console.log(han.slice(0, 60).join(' '));
console.log('');
console.log('--- 中文标点 ---');
console.log(cjkPunct.join(' '));
console.log('');
console.log('--- 额外符号 ---');
console.log(extraSymbols.join(' '));
console.log('');
console.log('--- ASCII ---');
console.log(ascii.join(''));

// 文件路径列表（debug 用）
if (process.argv.includes('--verbose')) {
  console.log('\n--- 扫描的文件 ---');
  scannedFiles.forEach((f) => console.log('  ' + path.relative(repoRoot, f)));
}
