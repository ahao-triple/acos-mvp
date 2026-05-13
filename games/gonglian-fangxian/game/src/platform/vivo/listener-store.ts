/**
 * 共享 pointer listener store + globalThis/document/window/self addEventListener 替换。
 *
 * 为什么独立成模块（而不是放在 event-bridge.ts 内部）：
 *   PixiJS v8 EventSystem 在模块顶层可能 cache `globalThis.addEventListener` 引用：
 *     const _add = globalThis.addEventListener;
 *     // later: _add.call(globalThis, 'pointerup', handler, true);
 *   ESM 顶层 import 链：
 *     main.ts line 3:  import './dom-polyfill'         ← stub noop
 *     main.ts line 8:  import { PixiRenderer }         ← pixi 模块顶层求值，cache 引用
 *     main.ts line 11: import createVivoEventBridge    ← 太晚
 *     runtime line 83: createVivoEventBridge(...)      ← 更晚，pixi 已 cache noop
 *
 *   所以 routes 必须在 dom-polyfill 内部就装好（line 3 同步完成），让 pixi 在 line 8 cache 到
 *   的就是 routed 版本。这个模块由 dom-polyfill 在 IIFE 末尾调用 installGlobalRoutes()。
 *
 * 真机现象（v1.0.32 验证）：
 *   listeners 都正确分到 bucket：wrapper.pointerdown ✓ / document.pointermove ✓，
 *   但 global.pointerup ✗（没 log，dispatch 时 listeners=0）—— 正是 pixi 提前 cache 引用导致。
 */

type Listener = (event: unknown) => void;

const POINTER_TYPES = ['pointerdown', 'pointermove', 'pointerup', 'pointercancel'] as const;
export type PointerType = typeof POINTER_TYPES[number];
export type TargetName = 'wrapper' | 'global' | 'document';

export interface Buckets {
  wrapper: Record<PointerType, Listener[]>;
  global: Record<PointerType, Listener[]>;
  document: Record<PointerType, Listener[]>;
}

function emptyBucket(): Record<PointerType, Listener[]> {
  return { pointerdown: [], pointermove: [], pointerup: [], pointercancel: [] };
}

export const buckets: Buckets = {
  wrapper: emptyBucket(),
  global: emptyBucket(),
  document: emptyBucket(),
};

export function isPointerType(t: string): t is PointerType {
  return t === 'pointerdown' || t === 'pointermove' || t === 'pointerup' || t === 'pointercancel';
}

let installed = false;
let eventSystemPatched = false;

/**
 * Monkey-patch PixiJS EventSystem.prototype._addEvents / _removeEvents 把
 * `globalThis.addEventListener("pointerup", this._onPointerUp, true)` 这行救回来。
 *
 * 必须用这个方案，原因：vivo runtime 把 globalThis.addEventListener 实现为
 * configurable=false 的 accessor property（getter only） —— defineProperty / Reflect.set /
 * 直接赋值全部失效（runtime warn "can not rewrite the property: addEventListener"）。
 * 这是平台级保护，没法从我们这边解锁。
 *
 * PixiJS v8.18.1 events/EventSystem.mjs 只有一处 `globalThis.addEventListener` 用法：
 *   line 327: globalThis.addEventListener("pointerup", this._onPointerUp, true);
 * 其它 pointer 注册都走 `domElement.addEventListener` 或 `globalThis.document.addEventListener`，
 * 这两个 target 在我们 installGlobalRoutes 里都已 routed（wrapper 走自己的 addEventListener，
 * document 在 vivo runtime 上可写，installGlobalRoutes 已替换）。
 *
 * 策略：先调原 _addEvents（注册 wrapper.pointerdown / document.pointermove / wheel /
 * EventsTicker 全部由原方法处理；那行 globalThis.addEventListener 会 noop + vivo warn 一次，
 * 不影响功能），然后手动把 this._onPointerUp push 到 buckets.global.pointerup。
 *
 * 接受度：每次 setTargetElement 触发一次 "can not rewrite" warn，能容忍 —— 一行 noop 调用
 * 换来不动 node_modules / 不依赖 patch-package / 不动 postinstall。
 */
export function patchEventSystemPrototype(EventSystemClass: { prototype: Record<string, unknown> }): void {
  if (eventSystemPatched) return;
  if (!EventSystemClass || !EventSystemClass.prototype) {
    console.warn('[pixi-patch] EventSystem.prototype unavailable; skip');
    return;
  }
  const proto = EventSystemClass.prototype;
  const origAddEvents = proto._addEvents as (() => void) | undefined;
  const origRemoveEvents = proto._removeEvents as (() => void) | undefined;
  if (typeof origAddEvents !== 'function' || typeof origRemoveEvents !== 'function') {
    console.warn('[pixi-patch] _addEvents/_removeEvents not found on prototype; skip');
    return;
  }

  proto._addEvents = function patchedAddEvents(this: Record<string, unknown>): void {
    origAddEvents.call(this);
    // 接管 globalThis.addEventListener('pointerup', this._onPointerUp, true) 那一行 —— vivo 上
    // 这行 noop + warn，我们补一次直接 push 到 listener-store。
    const handler = this._onPointerUp as Listener | undefined;
    if (typeof handler === 'function') {
      const arr = buckets.global.pointerup;
      if (!arr.includes(handler)) {
        arr.push(handler);
        console.log('[pixi-patch] _onPointerUp pushed to listener-store.buckets.global; pointerup total=%d', arr.length);
      }
    } else {
      console.warn('[pixi-patch] this._onPointerUp not a function after _addEvents');
    }
  } as unknown as Record<string, unknown>[string];

  proto._removeEvents = function patchedRemoveEvents(this: Record<string, unknown>): void {
    origRemoveEvents.call(this);
    const handler = this._onPointerUp as Listener | undefined;
    if (typeof handler === 'function') {
      const arr = buckets.global.pointerup;
      const idx = arr.indexOf(handler);
      if (idx >= 0) arr.splice(idx, 1);
    }
  } as unknown as Record<string, unknown>[string];

  eventSystemPatched = true;
  console.log('[pixi-patch] EventSystem.prototype._addEvents / _removeEvents patched');
}

type RoutedFn = ((type: string, handler: unknown) => void) & { __routed: true };

function isRouted(fn: unknown): boolean {
  return typeof fn === 'function' && (fn as { __routed?: boolean }).__routed === true;
}

/**
 * 强制把 fn 安装到 target[propName]。
 *
 * 为什么用 defineProperty 而不是直接赋值：v1.0.33 真机现象是 `global.addEventListener
 * (pointerup) total=1` 这条 log 完全没出 —— 说明 PixiJS 的 globalThis.addEventListener
 * 调用根本没走到我们路由函数。最可能解释：vivo runtime 把 globalThis.addEventListener
 * 定义为不可写属性（writable=false 或 getter-only），`g.addEventListener = fn` 静默失败
 * （非严格模式下不抛错，赋值直接被忽略）。
 *
 * defineProperty(writable:true, configurable:true) 能覆盖大多数这种 frozen / locked
 * 属性。如果 configurable=false 那是 runtime 故意锁的，这种情况会抛错并 catch 兜底。
 */
function forceInstall(target: Record<string, unknown>, propName: string, fn: unknown): boolean {
  try {
    Object.defineProperty(target, propName, { value: fn, writable: true, configurable: true });
    return target[propName] === fn;
  } catch (e) {
    // configurable=false 时 defineProperty 抛 TypeError。再 try 直接赋值。
    try {
      target[propName] = fn;
      return target[propName] === fn;
    } catch (e2) {
      console.warn('[listener-store] forceInstall %s failed:', propName, (e as Error).message, '/', (e2 as Error).message);
      return false;
    }
  }
}

/**
 * 替换 globalThis / window / self / document 的 add/removeEventListener。
 * 必须在 PixiJS 任何模块顶层求值之前调用 —— 由 dom-polyfill IIFE 末尾调用。
 *
 * pointer 类型路由到对应 bucket（PixiJS v8.3.4 注册习惯：pointerdown=wrapper、
 * pointermove=document、pointerup=global），其他类型保留原 noop。
 *
 * 多重 sanity check：
 *   1) 替换函数带 __routed=true 标记
 *   2) install 后立刻读 globalThis/window/document.addEventListener.__routed
 *   3) 检查 globalThis.addEventListener === window.addEventListener 引用一致性
 *   4) dump property descriptor（writable / configurable）便于排查 vivo runtime 行为
 *   5) 任一 target 没 install 成功 → 用 defineProperty 强制 reinstall，仍失败 → 警告
 */
export function installGlobalRoutes(): void {
  if (installed) return;
  installed = true;

  const g = globalThis as unknown as Record<string, unknown>;

  const makeAdd = (targetName: TargetName): RoutedFn => {
    const fn = ((type: string, handler: unknown): void => {
      if (typeof handler !== 'function') return;
      if (isPointerType(type)) {
        buckets[targetName][type].push(handler as Listener);
        console.log('[listener-store] %s.addEventListener(%s) total=%d',
          targetName, type, buckets[targetName][type].length);
      }
    }) as RoutedFn;
    fn.__routed = true as const;
    return fn;
  };
  const makeRemove = (targetName: TargetName): RoutedFn => {
    const fn = ((type: string, handler: unknown): void => {
      if (!isPointerType(type)) return;
      const arr = buckets[targetName][type];
      const idx = arr.indexOf(handler as Listener);
      if (idx >= 0) arr.splice(idx, 1);
    }) as RoutedFn;
    fn.__routed = true as const;
    return fn;
  };

  // 先 dump globalThis.addEventListener 的 property descriptor，看是不是 vivo 锁了它。
  try {
    const desc = Object.getOwnPropertyDescriptor(g, 'addEventListener');
    console.log('[listener-store] globalThis.addEventListener descriptor: type=%s writable=%s configurable=%s hasGetter=%s',
      typeof desc?.value, String(desc?.writable), String(desc?.configurable), String(typeof desc?.get === 'function'));
  } catch { /* ignore */ }

  // 在每个 target 上 force-install routed 函数。
  const globalAdd = makeAdd('global');
  const globalRemove = makeRemove('global');
  const documentAdd = makeAdd('document');
  const documentRemove = makeRemove('document');

  const okGlobalAdd = forceInstall(g, 'addEventListener', globalAdd);
  const okGlobalRemove = forceInstall(g, 'removeEventListener', globalRemove);

  const win = g.window as Record<string, unknown> | undefined;
  let okWinAdd = true;
  if (win && win !== g) {
    okWinAdd = forceInstall(win, 'addEventListener', globalAdd);
    forceInstall(win, 'removeEventListener', globalRemove);
  }

  const self_ = g.self as Record<string, unknown> | undefined;
  if (self_ && self_ !== g && self_ !== win) {
    forceInstall(self_, 'addEventListener', globalAdd);
    forceInstall(self_, 'removeEventListener', globalRemove);
  }

  const doc = g.document as Record<string, unknown> | undefined;
  let okDocAdd = true;
  if (doc) {
    okDocAdd = forceInstall(doc, 'addEventListener', documentAdd);
    forceInstall(doc, 'removeEventListener', documentRemove);
  }

  // identity / __routed 多重自检
  const gAdd = g.addEventListener;
  const winAdd = win?.addEventListener;
  const docAdd = doc?.addEventListener;
  console.log('[listener-store] identity check: globalRouted=%s windowRouted=%s documentRouted=%s sameRef(global,window)=%s sameRef(global,routedFn)=%s',
    String(isRouted(gAdd)),
    String(win ? isRouted(winAdd) : 'n/a'),
    String(doc ? isRouted(docAdd) : 'n/a'),
    String(gAdd === winAdd),
    String(gAdd === globalAdd));
  console.log('[listener-store] forceInstall results: global=%s globalRm=%s window=%s document=%s',
    String(okGlobalAdd), String(okGlobalRemove), String(okWinAdd), String(okDocAdd));

  // 如果 globalThis.addEventListener 不是 routed，最后挣扎一下：尝试用 Reflect.set + 给已知的
  // global 引用候选（globalThis / window / self）都 cover。
  if (!isRouted(g.addEventListener)) {
    console.warn('[listener-store] globalThis.addEventListener NOT routed after forceInstall — trying Reflect.set fallback');
    try { Reflect.set(g, 'addEventListener', globalAdd); } catch (e) { console.warn('Reflect.set failed:', (e as Error).message); }
    console.log('[listener-store] after Reflect.set: routed=%s', String(isRouted(g.addEventListener)));
  }
}
