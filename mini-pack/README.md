# mini-pack

`mini-pack` 是一个 Node.js + TypeScript 打包工具项目，用来把受控的 Web/Canvas 游戏工程打成小游戏平台包。

首版只支持抖音小游戏，只服务《共联防线》这类内部可控游戏结构。它不是通用 HTML 转小游戏工具，也不处理平台资质、提审、上传和审核。

## 能力边界

负责：

- 加载并校验 `game.config.ts`。
- 使用 `esbuild` 打包游戏入口。
- 复制 `game/public` 到抖音包 `assets/`。
- 生成 `game.js`、`game.json`、`project.config.json`、`build-report.json`。
- 注入抖音小游戏 runtime adapter。
- 提供本地 smoke 所需的稳定输出结构。

不负责：

- 任意 HTML/DOM/CSS 游戏迁移。
- 平台账号、资质、软著、备案。
- 自动上传、自动提审。
- 广告后台配置。
- 代码混淆、查重规避。
- 多平台打包。

## CLI

开发 CLI：

```bash
mini-pack validate --platform douyin
mini-pack build --platform douyin
```

仓库根目录平时通过包装脚本调用：

```bash
pnpm build games/gonglian-fangxian
pnpm smoke games/gonglian-fangxian
pnpm verify
```

## 游戏项目约定

游戏项目根目录需要包含：

```text
game.config.ts
game/src/main.ts
game/public/
platform/douyin/materials/
```

`game/src/main.ts` 导出：

```ts
export function createGame(runtime?: MiniPackGameRuntime): MiniPackGameApp
```

## 配置

`game.config.ts` 示例：

```ts
import { defineGameConfig } from '../../mini-pack/src/index';

export default defineGameConfig({
  title: '共联防线',
  platform: 'douyin',
  entry: 'game/src/main.ts',
  publicDir: 'game/public',
  outDir: 'builds/douyin',
  orientation: 'portrait',
  canvas: {
    width: 750,
    height: 1334,
  },
  douyin: {
    appid: process.env.DOUYIN_APPID ?? '',
    projectName: 'gonglian-fangxian',
    rewardedAdUnitId: process.env.DOUYIN_REWARDED_AD_UNIT_ID ?? '',
  },
});
```

字段规则：

- `platform` 目前只支持 `douyin`。
- `entry` 和 `publicDir` 必须存在。
- `outDir` 不能指向源码、资源原始目录或项目根目录。
- `orientation` 支持 `portrait`、`landscape`。
- `douyin.projectName` 不能为空。
- `douyin.appid` 可为空，提审前必须配置真实值。

## 输出

单个游戏默认输出到该游戏配置中的 `outDir`。仓库根目录包装脚本会统一输出到：

```text
build/<game-name>-douyin/
```

抖音包结构：

```text
game.js
game.json
project.config.json
assets/
build-report.json
```

`game.js` 面向抖音上传编译器输出 ES2015 语法，不保留 optional chaining、nullish coalescing 等 ES2020 语法。

## Runtime Contract

`mini-pack` 注入的 runtime 包含：

```ts
interface MiniPackGameRuntime {
  canvas: HTMLCanvasElement;
  storage: {
    getString(key: string): string | null;
    setString(key: string, value: string): void;
    remove(key: string): void;
  };
  audio: {
    playSfx(name: string): Promise<void>;
    playMusic(name: string, loop: boolean): Promise<void>;
    stopMusic(): void;
    setMuted(muted: boolean): void;
  };
  ads: {
    isRewardedVideoReady(slot: 'add-steps' | 'claim-reward'): boolean;
    showRewardedVideo(slot: 'add-steps' | 'claim-reward'): Promise<{ completed: boolean }>;
  };
  rewards: {
    canAddDesktop(): Promise<boolean>;
    requestAddDesktop(): Promise<boolean>;
    canAddFavorite(): Promise<boolean>;
    requestAddFavorite(): Promise<boolean>;
    didEnterFromSidebar(): Promise<boolean>;
    requestSidebarEntry(): Promise<boolean>;
  };
  logger: {
    info(message: string, data?: unknown): void;
    warn(message: string, data?: unknown): void;
    error(message: string, data?: unknown): void;
  };
}
```

runtime 只返回平台结果，不直接决定奖励。奖励是否发放由游戏应用层按业务规则处理。

## 抖音适配

- Canvas：优先使用 `tt.createCanvas()`。
- 触摸：把抖音 touch API 转成游戏可消费的 pointer/touch 事件。
- 存储：使用 `tt.getStorageSync`、`tt.setStorageSync`、`tt.removeStorageSync`。
- 音频：使用 `tt.createInnerAudioContext`。
- 激励视频：使用 `tt.createRewardedVideoAd` 和 `douyin.rewardedAdUnitId`。
- 加桌：使用 `tt.checkShortcut`、`tt.addShortcut`。
- 加常用：使用 `tt.showFavoriteGuide`。
- 侧边栏：使用启动参数和 `tt.navigateToScene`。

平台 API 不存在或调用失败时不能抛未捕获异常，必须返回失败/不可用结果并记录日志。

## 测试

```bash
pnpm --dir mini-pack test
pnpm --dir mini-pack build
```

覆盖范围：

- 配置加载和路径安全。
- 资源复制和构建报告。
- 抖音输出 JSON。
- `game.js` 打包和 ES 语法兼容。
- 仓库真实游戏构建集成。

## 技术栈

Node.js 20+、TypeScript、pnpm、commander、zod、esbuild、fs-extra、fast-glob、picocolors、vitest。
