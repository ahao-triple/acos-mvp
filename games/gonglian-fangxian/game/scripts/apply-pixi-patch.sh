#!/bin/sh
# 应用 pixi.js uint16 index patch（绕 vivo WebGL 1 严格驱动 + OES_element_index_uint 禁用）。
#
# 为什么不用 patch-package 的 apply：patch-package@8 的 JS 实现要求严格的 git-style patch
# metadata（index/hash 行），手工构造的 unified diff 它识别不了；标准 patch -p1 命令格式更宽容。
#
# 为什么不用 patch -N 做幂等：BSD patch（macOS 默认）在"已 applied"状态下 dry-run 返 0，
# 然后自动 prompt "Assume -R?"（默认接受），结果**反向 apply 把 patch 撤掉**——这是
# 灾难性的（实测踩过：postinstall 跑两次会把 Uint16Array 改回 Uint32Array）。
#
# 这里用 marker 字符串 grep 做幂等判断：patch 里的 console.warn `[pixi-patch:uint16]` 是
# 我们注入的独有标记，原版 pixi.js 没有。出现就是已 applied，否则跑 patch。
#
# 详见 patches/pixi.js+8.18.1.patch 与 docs/phase0-changelog.md。

set -e

PATCH_FILE="patches/pixi.js+8.18.1.patch"
TARGET="node_modules/pixi.js"
MARKER='[pixi-patch:uint16]'
MARKER_FILE="$TARGET/lib/rendering/batcher/shared/Batcher.mjs"

if [ ! -f "$PATCH_FILE" ]; then
  echo "[pixi-patch] skip: $PATCH_FILE not found"
  exit 0
fi
if [ ! -f "$MARKER_FILE" ]; then
  echo "[pixi-patch] skip: pixi.js not installed yet (run pnpm install first)"
  exit 0
fi

# 幂等：检查 marker 是否已注入。已注入 → 跳过；未注入 → 跑 patch。
# 注意：marker 含 `[...]` 是 grep 正则字符类，必须用 -F (fixed string) 字面匹配。
if grep -qF -- "$MARKER" "$MARKER_FILE"; then
  echo "[pixi-patch] already applied (skip)"
  exit 0
fi

# -N 拒绝反向 apply（即便 BSD patch 想自作主张也不行）；--silent 减少噪声。
patch -p1 -N --silent -d "$TARGET" < "$PATCH_FILE"
echo "[pixi-patch] successfully applied 1 patches (pixi.js+8.18.1)"
