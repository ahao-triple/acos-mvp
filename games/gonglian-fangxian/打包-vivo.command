#!/bin/bash
# 双击运行：打包共联防线 vivo 版本
# 也可在终端里直接执行此文件

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

cd "$REPO_ROOT" || { echo "❌ 找不到仓库根目录: $REPO_ROOT"; read -r -p "按回车关闭..."; exit 1; }

if ! command -v node >/dev/null 2>&1; then
  echo "❌ 未找到 node，请先安装 Node.js 20+"
  read -r -p "按回车关闭..."; exit 1
fi
if ! command -v pnpm >/dev/null 2>&1; then
  echo "❌ 未找到 pnpm，请先安装 pnpm（npm i -g pnpm）"
  read -r -p "按回车关闭..."; exit 1
fi

echo "🔨 编译 mini-pack ..."
if ! pnpm --dir mini-pack build; then
  echo "❌ mini-pack 编译失败"
  read -r -p "按回车关闭..."; exit 1
fi

echo
echo "📦 打包 vivo ..."
node mini-pack/dist/cli.js pack "$SCRIPT_DIR/build.vivo.json"
status=$?

echo
if [ "$status" -eq 0 ]; then
  echo "✅ 打包成功"
  echo "产物目录：$SCRIPT_DIR/dist"
  ls -lh "$SCRIPT_DIR/dist"/*.rpk 2>/dev/null || true
else
  echo "❌ 打包失败（exit=$status）"
fi
echo
read -r -p "按回车关闭窗口..."
exit $status
