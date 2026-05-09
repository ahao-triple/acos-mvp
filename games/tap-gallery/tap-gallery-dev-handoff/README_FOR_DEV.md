# Tap Gallery Canvas 交付包

这个文件夹是给开发团队接入 `TypeScript + Vite + Canvas` 版本用的整理版交付包。

## 入口文件

- `docs/tap-gallery-30-level-plan.md`：完整设计文档，包含 750 x 1334 设计规格、镜头、提示、首次进入流程、体力广告、Reveal 流程和 30 关策划表。
- `game-assets/asset-manifest.json`：资源总入口，开发优先读取这个文件。
- `game-assets/level-configs/levels.json`：30 关配置总表。
- `game-assets/level-configs/level-001.json` 到 `level-030.json`：每关独立配置。
- `game-assets/asset-preview.html`：本地资源预览页。

## 资源目录

- `game-assets/assets/levels/reveal`：通关当下展示的高精度最终图，1024 x 1024 PNG，透明背景。
- `game-assets/assets/levels/masks`：从最终图反推的配置轮廓图，1024 x 1024 PNG，透明背景。
- `game-assets/assets/levels/thumbs`：关卡列表或图鉴缩略图，256 x 256 PNG。
- `game-assets/assets/ui`：体力、Hint、Bomb、Magnet、Hammer、Freeze、广告、金币、Moves 图标。
- `game-assets/assets/audio/sfx`：点击、飞出、错误、提示、道具、通关、奖励等 WAV 音效。
- `game-assets/previews`：资源核对用预览图。

## 当前资源状态

- 第 1 关已经改为草莓：`level_001_strawberry`。
- 第 2 关为星形奖章：`level_002_star_medal`。
- 第 1-14 关使用 imagegen 生成的精细 reveal 图，并已反推 mask 和 thumbnail。
- 第 15-30 关暂时保留程序化占位图，后续生成精细 reveal 后可用同样流程替换。
- `imagegen-source-map.json` 记录了前 14 关 reveal 图与源图文件的对应关系。

## 开发接入建议

1. Canvas 逻辑分辨率固定按 `750 x 1334`。
2. 运行时先读取 `game-assets/asset-manifest.json`。
3. 关卡数据从 `game-assets/level-configs/levels.json` 或单关 JSON 加载。
4. 棋盘配置以 `cells` 为准，`cellsTarget` 是策划目标值。
5. 通关时展示 `revealImage`，不要展示 `maskImage`。
6. `maskImage` 只用于轮廓采样、遮罩参考和低成本配置生成。
7. 首次进入直接加载第 1 关，不先进大厅。
8. 通关后先完整展示 reveal 图，再渐入奖励和 Continue。

## 脚本

- `scripts/generate_game_assets.py`：生成程序化资源、UI 图标、音效、manifest 和预览。
- `scripts/integrate_imagegen_reveals.py`：把 imagegen 源图接入资源目录，并重新生成 mask、thumb、关卡配置和 manifest。
- `scripts/postprocess_reveal_alpha.py`：早期透明背景后处理脚本，保留给开发参考。

脚本依赖当前工作区里的 Pillow 依赖路径。开发团队如果要在独立仓库重跑脚本，需要先安装 Pillow。
