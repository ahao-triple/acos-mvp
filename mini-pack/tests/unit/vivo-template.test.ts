import { describe, expect, it } from 'vitest';
import {
  createVivoMainJs,
  createVivoManifest,
  createVivoRuntimeRalJs,
  createVivoRuntimeWebAdapterJs,
  renderVivoGameJs,
} from '../../src/platforms/vivo/template.js';
import type { LoadedGameConfig } from '../../src/shared/types.js';

function makeLoaded(): LoadedGameConfig {
  return {
    game: {
      title: '就你眼神好',
      entry: 'game/src/main.ts',
      publicDir: 'game/public-pack',
      orientation: 'portrait',
      canvas: { width: 750, height: 1334 },
    },
    platform: 'vivo',
    materials: {
      packageName: 'com.example.app',
      iconPath: 'icon.png',
      versionName: '2.5.0',
      versionCode: 7,
    },
    projectRoot: '/tmp/x',
    paths: {
      configFileAbs: '/tmp/x/game.config.ts',
      entryAbs: '/tmp/x/game/src/main.ts',
      publicDirAbs: '/tmp/x/game/public-pack',
      channelRoot: '/tmp/x/channels/vivo',
      materialsAbs: '/tmp/x/channels/vivo/materials.ts',
      iconAbs: '/tmp/x/channels/vivo/icon.png',
      outDirAbs: '/tmp/x/channels/vivo/build',
    },
    vivoMaterials: {
      packageName: 'com.example.app',
      iconPath: 'icon.png',
      versionName: '2.5.0',
      versionCode: 7,
    },
  };
}

describe('createVivoManifest', () => {
  it('uses materials.packageName / versionName / versionCode and game.title / orientation', () => {
    const manifest = createVivoManifest(makeLoaded());
    expect(manifest.package).toBe('com.example.app');
    expect(manifest.name).toBe('就你眼神好');
    expect(manifest.versionName).toBe('2.5.0');
    expect(manifest.versionCode).toBe(7);
    expect(manifest.deviceOrientation).toBe('portrait');
    expect(manifest.icon).toBe('/icon.png');
    expect(manifest.type).toBe('game');
    expect(manifest.minPlatformVersion).toBe(1060);
  });
});

describe('renderVivoGameJs (touch event shim removed)', () => {
  // 真机回归：旧 shim 把 canvas.addEventListener 翻译成 qg.onTouchStart，
  // 与 vivo runtime 内部的 W3C 兼容层互调导致栈溢出。修复后游戏 JS 不应
  // 再含 shim 痕迹，让 canvas 事件直接由 vivo runtime 原生处理。
  const js = renderVivoGameJs('var __MiniPackGameBundle = { createGame: () => ({ start(){} }) };');

  it('does not install a canvas.addEventListener shim', () => {
    expect(js).not.toContain('installTouchEventShim');
    expect(js).not.toContain('__miniPackVivoTouchShimInstalled');
  });

  it('does not redirect canvas events to qg.onTouchStart in game JS', () => {
    // 仅禁 "qg.onTouchStart(" 调用形式；类型探测 typeof qg.onTouchStart 是允许的（诊断用）
    expect(js).not.toMatch(/qg\.onTouchStart\s*\(/);
    expect(js).not.toMatch(/qg\[onName\]/);
  });

  it('keeps createCanvas thin (qg.createCanvas + return; no event override)', () => {
    expect(js).toContain('qg.createCanvas()');
    expect(js).not.toContain('canvas.addEventListener =');
    expect(js).not.toContain('canvas.removeEventListener =');
  });

  it('injects Image polyfill bridging to qg.createImage when host lacks Image', () => {
    // vivo runtime 不提供 web 标准 Image；桥接到 qg.createImage 让 imageCache 等代码可用
    expect(js).toContain("typeof ExistingImage === 'undefined'");
    expect(js).toContain('qg.createImage()');
    expect(js).toContain("defineGlobalValue(root, 'Image'");
    expect(js).toContain("defineGlobalValue(windowTarget, 'Image'");
  });

  it('exports the visible canvas globals on window as well as globalThis', () => {
    expect(js).toContain("defineGlobalValue(root, 'mainCanvas', canvas)");
    expect(js).toContain("defineGlobalValue(windowTarget, 'mainCanvas', canvas)");
    expect(js).toContain("defineGlobalValue(root, 'HTMLCanvasElement', canvas.constructor)");
    expect(js).toContain("defineGlobalValue(windowTarget, 'HTMLCanvasElement', canvas.constructor)");
    expect(js).toContain("defineGlobalValue(root, 'CanvasRenderingContext2D', Context2D)");
    expect(js).toContain("defineGlobalValue(windowTarget, 'CanvasRenderingContext2D', Context2D)");
  });

  it('attaches the vivo canvas to document.body when a DOM is available', () => {
    expect(js).toContain('function attachCanvasToDocument(canvas)');
    expect(js).toContain('document.body.appendChild(canvas)');
    expect(js).toContain('attachCanvasToDocument(__miniPackCanvas);');
  });

  it('creates and exposes the vivo canvas before executing the game bundle', () => {
    const orderedJs = renderVivoGameJs(
      'var __MiniPackGameBundle = { createGame: () => ({ start(){} }) };',
    );

    expect(orderedJs.indexOf('var __miniPackCanvas = createCanvas();')).toBeLessThan(
      orderedJs.indexOf('var __MiniPackGameBundle ='),
    );
    expect(orderedJs.indexOf('installCanvasGlobals(__miniPackCanvas);')).toBeLessThan(
      orderedJs.indexOf('var __MiniPackGameBundle ='),
    );
  });

  it('requests direct WebGL game rendering instead of a 2D canvas presenter', () => {
    expect(js).not.toContain('function createWebglPresenter');
    expect(js).not.toContain('sourceCanvas');
    expect(js).toContain("createCanvas: qg && typeof qg.createCanvas === 'function' ? qg.createCanvas.bind(qg) : undefined");
    expect(js).toContain("renderMode: 'webgl'");
  });

  it('does not include temporary vivo diagnostics', () => {
    expect(js).not.toContain('MINI-PACK VIVO DIAGNOSTICS');
    expect(js).not.toContain('miniPackDiag');
    expect(js).not.toContain('sanity paint');
    expect(js).not.toContain('paint stats');
    expect(js).not.toContain('final paint');
    expect(js).not.toContain('debug paint');
    expect(js).not.toContain('heartbeat 2s');
    expect(js).not.toContain('raf tick');
  });
});

describe('vivo runtime adapter', () => {
  it('loads runtime adapters before game.js from main.js', () => {
    expect(createVivoMainJs()).toBe(`require("runtime-adapter/ral.js");
require("runtime-adapter/web-adapter.js");
require("game.js");
`);
  });

  it('creates a mainCanvas before game.js can run', () => {
    const ralJs = createVivoRuntimeRalJs();

    expect(ralJs).toContain("qg.createCanvas()");
    expect(ralJs).toContain("define(windowTarget, 'devicePixelRatio', 1)");
    expect(ralJs).toContain("define(root, 'mainCanvas', mainCanvas)");
    expect(ralJs).toContain("define(windowTarget, 'mainCanvas', mainCanvas)");
    expect(ralJs).not.toContain('[mini-pack:vivo:adapter] ');
  });

  it('provides a minimal document.body fallback', () => {
    const webAdapterJs = createVivoRuntimeWebAdapterJs();

    expect(webAdapterJs).toContain('if (!documentRef.body)');
    expect(webAdapterJs).toContain("documentRef.body = createElementFallback('body')");
  });
});
