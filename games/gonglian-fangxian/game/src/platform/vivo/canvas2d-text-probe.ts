/**
 * vivo Canvas2D Text 诊断 probe（一次性，不修复，只 log）。
 *
 * 背景：
 *   v1.0.37 真机截图显示所有 PIXI.Text（白字标题/副标题/健康忠告）显示为深色，
 *   同屏 PIXI.Graphics 绘制的"12+"白字与"适龄提示"黑字正常。
 *   PixiJS Text 走 OffscreenCanvas + ctx.fillText 渲染成 texture，
 *   怀疑 vivo Canvas2D 的 fillStyle / fillText 这条路径上有 bug。
 *
 * 不做修复 —— 只跑诊断 log，灌真机看 vConsole 输出，根据结果选修法。
 *
 * 测试矩阵：
 *   canvas 来源 × 4 个测试点：
 *     - qg.createCanvas        （vivo 主路径）
 *     - document.createElement （DOM 兜底路径）
 *     - new OffscreenCanvas    （PIXI.Text 内部实际可能用的路径）
 *
 *   每条 canvas 跑：
 *     (a) fillStyle setter：'#FFFFFF' / 'rgb(255,255,255)' / number 0xFFFFFF 读回行为
 *     (b) fillRect 白方块像素（getImageData(8,8,1,1)）
 *     (c) fillText 白字像素（第一个 alpha>0 像素 RGBA）
 */

interface CanvasLike {
  width: number;
  height: number;
  getContext(type: string): CanvasContextLike | null;
}

interface CanvasContextLike {
  fillStyle: string | unknown;
  font?: string;
  textBaseline?: string;
  fillRect(x: number, y: number, w: number, h: number): void;
  clearRect(x: number, y: number, w: number, h: number): void;
  fillText(text: string, x: number, y: number): void;
  getImageData?(x: number, y: number, w: number, h: number): { data: Uint8ClampedArray | number[] };
}

type AnyRec = Record<string, unknown>;

function describe(v: unknown): string {
  if (v === null) return 'null';
  if (v === undefined) return 'undefined';
  if (typeof v === 'string') return `"${v}"`;
  return String(v);
}

function firstOpaquePixel(data: Uint8ClampedArray | number[]): [number, number, number, number] | null {
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] > 0) {
      return [data[i], data[i + 1], data[i + 2], data[i + 3]];
    }
  }
  return null;
}

function tryQgCreateCanvas(): CanvasLike | null {
  const g = globalThis as unknown as AnyRec & { qg?: { createCanvas?: () => CanvasLike } };
  if (typeof g.qg?.createCanvas !== 'function') return null;
  try {
    const c = g.qg.createCanvas();
    c.width = 64;
    c.height = 64;
    return c;
  } catch (e) {
    console.warn('[canvas2d-text-probe] qg.createCanvas threw:', (e as Error).message);
    return null;
  }
}

function tryDocumentCreateCanvas(): CanvasLike | null {
  const g = globalThis as unknown as AnyRec & { document?: { createElement?: (tag: string) => CanvasLike } };
  if (typeof g.document?.createElement !== 'function') return null;
  try {
    const c = g.document.createElement('canvas');
    c.width = 64;
    c.height = 64;
    return c;
  } catch (e) {
    console.warn('[canvas2d-text-probe] document.createElement(canvas) threw:', (e as Error).message);
    return null;
  }
}

function tryOffscreenCanvas(): CanvasLike | null {
  const g = globalThis as unknown as AnyRec & { OffscreenCanvas?: new (w: number, h: number) => CanvasLike };
  if (typeof g.OffscreenCanvas !== 'function') return null;
  try {
    return new g.OffscreenCanvas(64, 64);
  } catch (e) {
    console.warn('[canvas2d-text-probe] new OffscreenCanvas threw:', (e as Error).message);
    return null;
  }
}

function getCtx(canvas: CanvasLike, label: string): CanvasContextLike | null {
  try {
    return canvas.getContext('2d');
  } catch (e) {
    console.warn(`[canvas2d-text-probe] [${label}] getContext("2d") threw:`, (e as Error).message);
    return null;
  }
}

function runFillStyleSetterTests(ctx: CanvasContextLike, label: string): void {
  try {
    ctx.fillStyle = '#FFFFFF';
    const r1 = ctx.fillStyle;
    ctx.fillStyle = 'rgb(255, 255, 255)';
    const r2 = ctx.fillStyle;
    (ctx as { fillStyle: unknown }).fillStyle = 0xffffff;
    const r3 = ctx.fillStyle;
    console.log(
      `[canvas2d-text-probe] [${label}] (a) fillStyle setter: "#FFFFFF"→%s (typeof %s) | "rgb(255,255,255)"→%s | number 0xFFFFFF→%s`,
      describe(r1),
      typeof r1,
      describe(r2),
      describe(r3),
    );
  } catch (e) {
    console.warn(`[canvas2d-text-probe] [${label}] (a) threw:`, (e as Error).message);
  }
}

function runFillRectPixelTest(ctx: CanvasContextLike, label: string): void {
  try {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, 32, 32);
    if (typeof ctx.getImageData !== 'function') {
      console.warn(`[canvas2d-text-probe] [${label}] (b) getImageData unavailable`);
      return;
    }
    const img = ctx.getImageData(8, 8, 1, 1);
    const p = img?.data;
    console.log(
      `[canvas2d-text-probe] [${label}] (b) fillRect WHITE @(8,8) RGBA = [%s,%s,%s,%s] (expect 255,255,255,255)`,
      String(p?.[0]),
      String(p?.[1]),
      String(p?.[2]),
      String(p?.[3]),
    );
  } catch (e) {
    console.warn(`[canvas2d-text-probe] [${label}] (b) threw:`, (e as Error).message);
  }
}

function runFillTextPixelTest(ctx: CanvasContextLike, label: string): void {
  try {
    ctx.clearRect(0, 0, 64, 64);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '900 24px sans-serif';
    ctx.textBaseline = 'top';
    ctx.fillText('A', 4, 4);
    if (typeof ctx.getImageData !== 'function') {
      console.warn(`[canvas2d-text-probe] [${label}] (c) getImageData unavailable`);
      return;
    }
    const img = ctx.getImageData(0, 0, 32, 32);
    const pixel = firstOpaquePixel(img?.data ?? []);
    console.log(
      `[canvas2d-text-probe] [${label}] (c) fillText "A" WHITE first-opaque pixel = %s (expect [255,255,255,~] white; if RGB low / shifted → fillText path broken)`,
      pixel ? `[${pixel.join(',')}]` : 'NONE (text canvas blank — fillText produced no pixels)',
    );
  } catch (e) {
    console.warn(`[canvas2d-text-probe] [${label}] (c) threw:`, (e as Error).message);
  }
}

function runProbeOn(label: string, canvas: CanvasLike | null): void {
  if (!canvas) {
    console.warn(`[canvas2d-text-probe] [${label}] canvas factory unavailable; skip`);
    return;
  }
  const ctx = getCtx(canvas, label);
  if (!ctx) {
    console.warn(`[canvas2d-text-probe] [${label}] no 2d context; skip`);
    return;
  }
  runFillStyleSetterTests(ctx, label);
  runFillRectPixelTest(ctx, label);
  runFillTextPixelTest(ctx, label);
}

export function probeCanvas2DText(): void {
  console.log('[canvas2d-text-probe] === START ===');

  // 三种 canvas 来源 —— PixiJS Text 内部可能走任何一条；vivo runtime 各自实现可能不同
  const factoryStatus = {
    'qg.createCanvas': typeof (globalThis as AnyRec & { qg?: { createCanvas?: unknown } }).qg?.createCanvas,
    'document.createElement': typeof (globalThis as AnyRec & { document?: { createElement?: unknown } }).document?.createElement,
    'OffscreenCanvas': typeof (globalThis as AnyRec & { OffscreenCanvas?: unknown }).OffscreenCanvas,
  };
  console.log('[canvas2d-text-probe] factories availability:', JSON.stringify(factoryStatus));

  runProbeOn('qg', tryQgCreateCanvas());
  runProbeOn('doc', tryDocumentCreateCanvas());
  runProbeOn('offscreen', tryOffscreenCanvas());

  console.log('[canvas2d-text-probe] === END ===');
}
