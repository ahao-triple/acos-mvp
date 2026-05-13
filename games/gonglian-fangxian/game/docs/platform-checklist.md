# 新平台接入 checklist

## 第 0 步：跑 probe

- 跑 `canvas2d-text-probe.ts`，确认新平台 Canvas2D `fillText`、`fillStyle`、`getImageData` 行为。
- 跑 WebGL extensions probe，记录 `getSupportedExtensions()`、`OES_standard_derivatives`、`OES_element_index_uint`。
- 跑 DOM polyfill probe，确认 `document.createElement` 支持哪些 tag，事件 API 是否是可写属性。
- 跑本地资源加载 probe，确认 `fetch`、平台 request API、FileSystem API 对 rpk 内资源的行为。
- 把发现的 quirks 写入平台文档；不要默认复用 vivo workaround。

## 第 1 步：platform adapter 实现

- 复用 `src/platform/<platform>/` 结构，参考 `src/platform/vivo/`。
- 必填能力：`login`、`showRewardedAd`、`showToast`、`exitMiniGame`、`triggerHaptic`。
- 选填能力：`addDesktopShortcut`、`share`、`favoriteGuide`、`sidebarEntry`。
- 所有平台异常对象要展开日志字段：`errCode`、`errMsg`、`data`、`detail`、`rawJson`。
- 所有本地资源路径避免前导 `/`，先在真机验证相对路径规则。

## 第 2 步：mini-pack 模板

- 新增 `mini-pack/src/platforms/<platform>/template.ts`。
- 新增 `mini-pack/src/platforms/<platform>/index.ts` 和必要的打包/签名模块。
- 入口 boot 脚本必须先安装 canvas/global/document polyfill，再执行游戏 bundle。
- 资源打包规则必须覆盖 `public-pack/` 平铺、manifest、icon、runtime adapter、音频、字体。
- release 签名目录必须 git ignored，参照 vivo `releaseSignDir` 模式，只复制到生成工程。

## 第 3 步：测试三层

- jsdom unit：`pnpm test`，覆盖 schema、template、adapter 的纯逻辑。
- Playwright e2e：`pnpm test:e2e`，覆盖 core-loop 和 jitter-loop。
- Browser verify：`pnpm verify:browser`，覆盖 atlas 加载、缺字 warning、启动日志、截图。
- 真机：灌包 + vConsole，看启动 log 和平台 API 真实错误对象。
- 新平台若有 strict mode，要在测试里复用/模拟 quirks 假设，避免只在浏览器通过。

## 第 4 步：上架材料

- manifest 平台特定字段：包名、版本、横竖屏、最小平台版本、首页/图标字段。
- 正式签名证书：目录按平台隔离，永不进 git，打包时复制到生成工程。
- 适龄图标、软著号、健康忠告、著作权人：改文案后必须重打字体 atlas。
- 广告位：后台开通、白名单、测试/正式环境行为、错误码说明都要留证据。
- 提审前跑完整 `check:full`，再解包检查 manifest、签名、字体、音频、广告位是否入包。
