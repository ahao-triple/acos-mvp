/**
 * Pixi screen 基类约定。
 *
 * 与旧 immediate-mode drawXxxScreen(ui, view) 的关键差别：
 *  - Pixi screen 是 persistent Container，创建一次后通过 update(view, nowMs) 只更新动态部分
 *    （文本、disabled、可见性），不每帧 destroy + rebuild。
 *  - PixiRenderer 持有所有 screen 实例，按 view.screen 字段切显示/隐藏（visible = true/false）。
 *  - dispatch 通过构造参数 `dispatch: (action: AppAction) => void` 注入；按钮 onTap 调它。
 */
import { Container } from 'pixi.js';
import type { Renderer } from 'pixi.js';
import type { AppAction, AppViewState } from '../../app/controller';

export type DispatchFn = (action: AppAction) => void;

export interface ScreenContext {
  dispatch: DispatchFn;
  logicalWidth: number;
  logicalHeight: number;
  /** Pixi renderer 引用：PlayingScreen 用来烘焙网格背景 RenderTexture。 */
  getRenderer(): Renderer | null;
}

export interface PixiScreen {
  /** 挂载到 PixiRenderer 的 ui/overlay 层。 */
  readonly container: Container;
  /** 切到该 screen 时调用。 */
  show(view: AppViewState, nowMs: number): void;
  /** 离开该 screen 时调用。 */
  hide(): void;
  /** 每帧调用（仅当 screen 当前可见时）。 */
  update(view: AppViewState, nowMs: number): void;
  /** 释放资源。 */
  dispose(): void;
}
