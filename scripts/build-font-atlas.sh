#!/usr/bin/env bash
# 离线生成 SDF 字体 atlas（CI 不跑，本地手动维护）。
#
# 前置：
#   1. assets/fonts/source/SourceHanSansCN-Bold.otf 已下载（见 LICENSE.md）
#   2. docs/font-charset.txt 已生成（node scripts/scan-charset.mjs）
#   3. msdf-bmfont-xml 可用（首次跑会自动 npx --yes 拉）
#
# 产物：
#   games/gonglian-fangxian/game/public-pack/fonts/main.png
#   games/gonglian-fangxian/game/public-pack/fonts/main.xml
#
# 字符集变化时重跑此脚本。git add 产物。

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FONT_SRC="$REPO_ROOT/assets/fonts/source/SourceHanSansCN-Bold.otf"
if [ ! -f "$FONT_SRC" ]; then
  FONT_SRC="$REPO_ROOT/games/gonglian-fangxian/assets/raw/fonts/SourceHanSansSC-Bold.otf"
fi
CHARSET="$REPO_ROOT/docs/font-charset.txt"
OUT_DIR="$REPO_ROOT/games/gonglian-fangxian/game/public-pack/fonts"
OUT_PREFIX="$OUT_DIR/main"

[ -f "$FONT_SRC" ] || { echo "[build-font-atlas] missing font source: $FONT_SRC"; echo "  see assets/fonts/source/LICENSE.md for manual download"; exit 1; }
[ -f "$CHARSET" ] || { echo "[build-font-atlas] missing charset: $CHARSET"; echo "  run: node scripts/scan-charset.mjs"; exit 1; }

mkdir -p "$OUT_DIR"
# 清旧产物避免残留 page 1+ 文件
rm -f "$OUT_PREFIX".png "$OUT_PREFIX".xml "$OUT_PREFIX".json "$OUT_PREFIX"_*.png

echo "[build-font-atlas] charset: $(wc -c < "$CHARSET") bytes / $(awk 'BEGIN{c=0}{c+=length($0)}END{print c}' "$CHARSET") chars"
echo "[build-font-atlas] font:    $(ls -lh "$FONT_SRC" | awk '{print $5}')"

# msdf-bmfont-xml 工具链 maintain 在 .tools/ 下（不污染游戏 deps，.gitignore 排除）。
# opentype.js@1.3.4 强制 pin —— msdf-bmfont-xml 用了 v1 deprecated 的 opentype.load(file, cb) 路径，
# v2 已删除该路径直接返回 undefined，所以 npm overrides 锁回 v1.3.4。
TOOLS_DIR="$REPO_ROOT/.tools/msdf-bmfont-xml"
if [ ! -x "$TOOLS_DIR/node_modules/.bin/msdf-bmfont" ]; then
  echo "[build-font-atlas] bootstrapping msdf-bmfont-xml in .tools/ ..."
  mkdir -p "$TOOLS_DIR"
  cat > "$TOOLS_DIR/package.json" <<'JSON'
{
  "name": "msdf-bmfont-xml-tools",
  "version": "1.0.0",
  "private": true,
  "overrides": { "opentype.js": "1.3.4" }
}
JSON
  (cd "$TOOLS_DIR" && npm install msdf-bmfont-xml --no-save --no-fund --no-audit)
fi

# 生成 atlas（参数：48px field-size, 4px padding, msdf 4 通道, 2048x2048 上限）
"$TOOLS_DIR/node_modules/.bin/msdf-bmfont" \
  "$FONT_SRC" \
  --charset-file "$CHARSET" \
  --filename "$OUT_PREFIX" \
  --output-type xml \
  --texture-size 2048,2048 \
  --font-size 48 \
  --texture-padding 4 \
  --distance-range 4 \
  --field-type msdf \
  --pot \
  --square

# msdf-bmfont 把 .fnt 文件名固定写成字体 face name（"SourceHanSansCN-Bold.fnt"）—— 这违反
# OFL-1.1 "衍生品不得用 'Source' 保留字面名" 条款。手动 rename 成 main.fnt + 把内部
# face 属性改成中性名 "main"。PixiJS Assets.load 用 face name 作为字体 ID，必须改。
FACE_FNT="$OUT_DIR/SourceHanSansCN-Bold.fnt"
TARGET_FNT="$OUT_PREFIX.fnt"
if [ -f "$FACE_FNT" ]; then
  mv "$FACE_FNT" "$TARGET_FNT"
  # macOS sed 需要 -i '' 占位空 backup 后缀
  sed -i '' 's/face="SourceHanSansCN-Bold"/face="main"/' "$TARGET_FNT"
fi

# 落 LICENSE 跟产物在一起，OFL 要求衍生品携带原协议
cp "$REPO_ROOT/assets/fonts/source/OFL.txt" "$OUT_DIR/OFL.txt"

echo ""
echo "[build-font-atlas] === DONE ==="
ls -lh "$OUT_DIR"

# 校验：atlas xml 中 char 数应等于 charset 实际 unique codepoint 数
# （awk length 按 byte 算 UTF-8 多字节字符不准，用 node 算 Set size 排除 \\n\\r）
if [ -f "$TARGET_FNT" ]; then
  CHAR_COUNT="$(grep -c '<char ' "$TARGET_FNT" || true)"
  EXPECTED="$(node -e "
    const s = require('fs').readFileSync('$CHARSET', 'utf8');
    const set = new Set();
    for (const ch of s) {
      const cp = ch.codePointAt(0);
      if (cp !== 0x0a && cp !== 0x0d) set.add(ch);
    }
    console.log(set.size);
  ")"
  echo "[build-font-atlas] glyph count: $CHAR_COUNT (charset unique chars: $EXPECTED)"
  if [ "$CHAR_COUNT" -ne "$EXPECTED" ]; then
    echo "[build-font-atlas] WARNING: glyph count != charset count (some glyphs missing or duplicated)"
  fi
fi
