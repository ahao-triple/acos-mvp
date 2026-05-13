/**
 * 舞台分层 + 750×1334 逻辑坐标系适配。
 *
 * 层结构（z-order 由低到高）：
 *  bg     —— 背景（章节渐变 + 背景粒子）
 *  game   —— 战斗主屏 board / piece / blocker
 *  ui     —— 屏幕级 UI（按钮、面板、文本）
 *  overlay —— 特效粒子、浮字、模态遮罩
 *
 * 所有内容都画在逻辑坐标（750×1334）。`root` 整体 scale + translate 适配物理 viewport，
 * 居中且保持纵横比（letterbox）。屏幕震动就是 `root.position` 上额外的偏移叠加。
 */
import { Application, Container } from 'pixi.js';
import { fitLogicalCanvas, LOGICAL_HEIGHT, LOGICAL_WIDTH, type CanvasFit } from '../render/scaler';

export interface StageLayers {
  /** 整体根容器，scale/position 控制；shake 也在这里叠加。 */
  root: Container;
  bg: Container;
  game: Container;
  ui: Container;
  overlay: Container;
  /** 当前 fit 信息（设备坐标 → 逻辑坐标转换需要）。 */
  fit: CanvasFit;
  /** logical 尺寸常量再导出，方便消费者用同一处。 */
  logicalWidth: number;
  logicalHeight: number;
}

export function createStage(app: Application, viewportWidth: number, viewportHeight: number): StageLayers {
  const root = new Container();
  const bg = new Container();
  const game = new Container();
  const ui = new Container();
  const overlay = new Container();
  root.label = 'root';
  bg.label = 'bg';
  game.label = 'game';
  ui.label = 'ui';
  overlay.label = 'overlay';

  root.addChild(bg, game, ui, overlay);
  app.stage.addChild(root);

  const layers: StageLayers = {
    root,
    bg,
    game,
    ui,
    overlay,
    fit: fitLogicalCanvas(viewportWidth, viewportHeight),
    logicalWidth: LOGICAL_WIDTH,
    logicalHeight: LOGICAL_HEIGHT,
  };
  applyFit(layers);
  return layers;
}

export function resizeStage(
  app: Application,
  layers: StageLayers,
  viewportWidth: number,
  viewportHeight: number,
): void {
  app.renderer.resize(viewportWidth, viewportHeight);
  layers.fit = fitLogicalCanvas(viewportWidth, viewportHeight);
  applyFit(layers);
}

function applyFit(layers: StageLayers): void {
  layers.root.scale.set(layers.fit.scale, layers.fit.scale);
  layers.root.position.set(layers.fit.offsetX, layers.fit.offsetY);
}

/** 设备点击坐标 → 逻辑坐标（用于把 Pixi 没接的全局指针事件映射回 view）。 */
export function deviceToLogical(layers: StageLayers, deviceX: number, deviceY: number): { x: number; y: number } {
  return {
    x: (deviceX - layers.fit.offsetX) / layers.fit.scale,
    y: (deviceY - layers.fit.offsetY) / layers.fit.scale,
  };
}
