// SPECULATIVE PORT from vivo. OPPO 也用 qg.* runtime, 多数 hook 应通用。
// 真机校准如有差异再修。

/**
 * oppo 触摸事件桥接 wrapper canvas（Phase 1 P0 — v4，buckets 提到 listener-store）。
 *
 * 关键背景：PixiJS v8.3.4 events/EventSystem.ts 注册习惯：
 *   wrapper(domElement).addEventListener('pointerdown', ..., true);
 *   globalThis.document.addEventListener('pointermove', ..., true);
 *   globalThis.addEventListener('pointerup', ..., true);
 *   // pointercancel 监听在 v8 源码里被注释掉 —— touchcancel 必须转 pointerup
 *
 * v3 错误：installGlobalRoutes 在 createOppoEventBridge 里调（runtime），但 PixiJS
 *   模块在 main.ts line 8 import 时顶层求值就 cache 了 globalThis.addEventListener
 *   引用（dom-polyfill 的 noop）。runtime 替换太晚，pixi 永远调 cached noop。
 *
 * v4 修复：listener buckets + installGlobalRoutes 提到 listener-store.ts，由
 *   dom-polyfill IIFE 末尾调 installGlobalRoutes —— 早于 pixi 模块顶层求值。
 *   本模块只负责 qg.onTouch* hook 与 dispatch；wrapper.addEventListener 走同一份 buckets。
 */
import { buckets, isPointerType, type PointerType } from './listener-store';

interface OppoTouchEventLike {
  touches?: Array<{ clientX?: number; clientY?: number; x?: number; y?: number; identifier?: number }>;
  changedTouches?: Array<{ clientX?: number; clientY?: number; x?: number; y?: number; identifier?: number }>;
  timeStamp?: number;
}

interface OppoQgTouchApi {
  onTouchStart?: (handler: (event: OppoTouchEventLike) => void) => void;
  onTouchMove?: (handler: (event: OppoTouchEventLike) => void) => void;
  onTouchEnd?: (handler: (event: OppoTouchEventLike) => void) => void;
  onTouchCancel?: (handler: (event: OppoTouchEventLike) => void) => void;
}

type Listener = (event: unknown) => void;
type TargetName = 'wrapper' | 'global' | 'document';

let touchHookInstalled = false;

const rawTouchCounts: Record<'start' | 'move' | 'end' | 'cancel', number> = {
  start: 0, move: 0, end: 0, cancel: 0,
};
let dispatchCount = 0;

function logRawTouch(name: 'start' | 'move' | 'end' | 'cancel', event: OppoTouchEventLike): void {
  rawTouchCounts[name] += 1;
  const n = rawTouchCounts[name];
  if (n <= 20 || n % 60 === 0) {
    const t = event.touches?.[0] ?? event.changedTouches?.[0];
    const x = t ? (t.clientX ?? t.x ?? 0) : -1;
    const y = t ? (t.clientY ?? t.y ?? 0) : -1;
    console.log('[oppo-event-bridge] RAW touch%s #%d @ (%d, %d) touches=%d changed=%d',
      name, n, Math.round(Number(x)), Math.round(Number(y)),
      event.touches?.length ?? 0, event.changedTouches?.length ?? 0);
  }
}

function buildMockEvent(type: PointerType, clientX: number, clientY: number, pointerId: number, isUp: boolean, target: unknown): unknown {
  const fields = {
    type,
    pointerType: 'touch',
    pointerId,
    isPrimary: true,
    button: 0,
    buttons: isUp ? 0 : 1,
    clientX, clientY,
    pageX: clientX, pageY: clientY,
    screenX: clientX, screenY: clientY,
    movementX: 0, movementY: 0,
    width: 1, height: 1,
    pressure: isUp ? 0 : 0.5,
    tangentialPressure: 0,
    twist: 0,
    tiltX: 0,
    tiltY: 0,
    target,
    currentTarget: target,
    timeStamp: performance.now(),
    preventDefault: () => {},
    stopPropagation: () => {},
    stopImmediatePropagation: () => {},
    composedPath: () => [],
  };
  // 优先 PointerEvent 构造器；vivo 的 stub class 构造后字段为空，靠 Object.assign 补全。
  try {
    const PE = (globalThis as unknown as { PointerEvent?: new (t: string, init?: unknown) => unknown }).PointerEvent;
    if (typeof PE === 'function') {
      const e = new PE(type, fields) as Record<string, unknown>;
      Object.assign(e, fields);
      return e;
    }
  } catch { /* fall through */ }
  try {
    const Ev = (globalThis as unknown as { Event?: new (t: string) => unknown }).Event;
    if (typeof Ev === 'function') {
      const e = new Ev(type) as Record<string, unknown>;
      Object.assign(e, fields);
      return e;
    }
  } catch { /* fall through */ }
  return fields;
}

const DISPATCH_TARGET: Record<PointerType, TargetName> = {
  pointerdown: 'wrapper',
  pointermove: 'document',
  pointerup: 'global',
  pointercancel: 'global',
};

function dispatchPointer(type: PointerType, touchEvent: OppoTouchEventLike, wrapperRef: unknown): void {
  const t = touchEvent.touches?.[0] ?? touchEvent.changedTouches?.[0];
  if (!t) return;
  const clientX = typeof t.clientX === 'number' ? t.clientX : typeof t.x === 'number' ? t.x : 0;
  const clientY = typeof t.clientY === 'number' ? t.clientY : typeof t.y === 'number' ? t.y : 0;
  const targetName = DISPATCH_TARGET[type];
  const handlers = (buckets[targetName][type] as Listener[]).slice();

  dispatchCount += 1;
  if (dispatchCount <= 20 || dispatchCount % 60 === 0) {
    console.log('[oppo-event-bridge] dispatch %s → %s (listeners=%d) @ (%d, %d) [wrapper=%d global=%d document=%d]',
      type, targetName, handlers.length, Math.round(clientX), Math.round(clientY),
      (buckets.wrapper[type] as Listener[]).length,
      (buckets.global[type] as Listener[]).length,
      (buckets.document[type] as Listener[]).length);
  }

  if (handlers.length === 0) return;
  const event = buildMockEvent(type, clientX, clientY, t.identifier ?? 0, type === 'pointerup' || type === 'pointercancel', wrapperRef);
  for (const h of handlers) {
    try { h(event); } catch (e) { console.warn('[oppo-event-bridge] handler threw:', (e as Error).message); }
  }
}

function installQgTouchHook(getDispatch: () => ((type: PointerType, e: OppoTouchEventLike) => void) | null): void {
  if (touchHookInstalled) return;
  const qg = (globalThis as unknown as { qg?: OppoQgTouchApi }).qg;
  if (!qg) {
    console.warn('[oppo-event-bridge] globalThis.qg unavailable; touch input will not work');
    touchHookInstalled = true;
    return;
  }
  const hookFlags = {
    start: typeof qg.onTouchStart === 'function',
    move: typeof qg.onTouchMove === 'function',
    end: typeof qg.onTouchEnd === 'function',
    cancel: typeof qg.onTouchCancel === 'function',
  };
  console.log('[oppo-event-bridge] qg touch hooks available:', JSON.stringify(hookFlags));
  try {
    qg.onTouchStart?.((e) => {
      logRawTouch('start', e);
      getDispatch()?.('pointerdown', e);
    });
    qg.onTouchMove?.((e) => {
      logRawTouch('move', e);
      getDispatch()?.('pointermove', e);
    });
    qg.onTouchEnd?.((e) => {
      logRawTouch('end', e);
      getDispatch()?.('pointerup', e);
    });
    qg.onTouchCancel?.((e) => {
      logRawTouch('cancel', e);
      // PixiJS v8 EventSystem 源码 pointercancel 监听已注释 —— touchcancel 必须转 pointerup。
      getDispatch()?.('pointerup', e);
    });
    console.log('[oppo-event-bridge] qg.onTouchStart/Move/End/Cancel installed');
  } catch (e) {
    console.warn('[oppo-event-bridge] failed to install qg touch hook:', (e as Error).message);
  }
  touchHookInstalled = true;
}

export function createOppoEventBridge(mainCanvas: HTMLCanvasElement): HTMLCanvasElement {
  const target = mainCanvas as unknown as { width: number; height: number };

  // 自检 sanity：确认 dom-polyfill 已装好全局路由。三个 target 都应该是 routed。
  const g = globalThis as unknown as Record<string, unknown>;
  const gAdd = g.addEventListener as { __routed?: boolean } | undefined;
  const winAdd = (g.window as Record<string, unknown> | undefined)?.addEventListener as { __routed?: boolean } | undefined;
  const docAdd = (g.document as Record<string, unknown> | undefined)?.addEventListener as { __routed?: boolean } | undefined;
  console.log('[oppo-event-bridge] sanity: globalThis.__routed=%s window.__routed=%s document.__routed=%s sameRef(g,win)=%s',
    String(gAdd?.__routed === true),
    String(winAdd?.__routed === true),
    String(docAdd?.__routed === true),
    String(gAdd === winAdd));

  let wrapper: unknown;
  const dispatcher = (type: PointerType, e: OppoTouchEventLike): void => dispatchPointer(type, e, wrapper);
  installQgTouchHook(() => dispatcher);

  wrapper = {
    get width(): number { return target.width; },
    set width(value: number) { target.width = value; },
    get height(): number { return target.height; },
    set height(value: number) { target.height = value; },
    style: {} as Record<string, string>,
    addEventListener(type: string, handler: unknown): void {
      if (typeof handler !== 'function') return;
      if (isPointerType(type)) {
        (buckets.wrapper[type] as Listener[]).push(handler as Listener);
        console.log('[oppo-event-bridge] wrapper.addEventListener(%s) total=%d',
          type, (buckets.wrapper[type] as Listener[]).length);
      }
    },
    removeEventListener(type: string, handler: unknown): void {
      if (!isPointerType(type)) return;
      const arr = buckets.wrapper[type] as Listener[];
      const idx = arr.indexOf(handler as Listener);
      if (idx >= 0) arr.splice(idx, 1);
    },
    getBoundingClientRect() {
      return {
        x: 0, y: 0, top: 0, left: 0,
        right: target.width, bottom: target.height,
        width: target.width, height: target.height,
      };
    },
  };

  return wrapper as HTMLCanvasElement;
}
