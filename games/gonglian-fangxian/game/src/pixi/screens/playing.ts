/**
 * 战斗主屏 —— gonglian 核心循环。
 *
 * 渲染分层（容器嵌套）：
 *   PlayingScreen.container
 *     ├─ topPanel + topInfo + settingsBtn      —— 静态 UI
 *     ├─ boardPanel（占位）                     —— task #10 后被 boardBgSprite 覆盖
 *     ├─ boardBgSprite                          —— RT 烘焙的 cellSlot 背景
 *     ├─ gameLayer（持震动偏移）
 *     │   ├─ selectedGlow                       —— 选中格几何，构造时画好，每帧只改 position+alpha
 *     │   ├─ piecesLayer                        —— PieceSprite 池
 *     │   └─ effects.container                  —— particles + floatText（消费 EffectsLayer）
 *     ├─ boardHit                               —— hitArea Rectangle，eventMode='static'
 *     └─ powerUpBtns                            —— 3 个道具按钮
 *
 * 核心循环（update 每帧执行）：
 *   1. 顶部文本（仅在内容变化时 setText）
 *   2. presentation.boardFor(session, nowMs) —— 拿分步播放的当前 board
 *   3. visualBoard.sync(board, nowMs) → changes
 *   4. changes.removed → effects.burst；length>=4 → floatText "N 连消"
 *   5. presentation 新进入 clear step → effects.triggerShake
 *   6. handleVisualCue: combo/swapRejected → floatText / burst
 *   7. tilesAt(nowMs) → PieceSprite 池同步（pieceSpriteIds 类成员复用）
 *   8. selectedGlow position + pulse alpha
 *   9. 道具按钮文案
 *  10. effects.update(nowMs) 推进 + 拿 shake 偏移
 *  11. gameLayer.position = shakeOffset
 *
 * 触摸 hit-test：
 *   - boardHit 用 Rectangle hitArea（不再用占位 Graphics），更轻量
 *   - 监听 pointertap，event.global → container.toLocal → cellAt → dispatch tapCell
 */

import { Container, Graphics, Rectangle, RenderTexture, Sprite, Text } from 'pixi.js';
import type { AppViewState } from '../../app/controller';
import { POWER_UP_COIN_COSTS } from '../../config/economy';
import type { BoardCell, PowerUpType, Position } from '../../core/types';
import { pieceColors, targetProgressText } from '../../render/theme';
import { VisualBoardModel, type VisualTile } from '../../render/visualBoard';
import { createButton, type ButtonHandle } from '../ui/button';
import { createPanel } from '../ui/panel';
import { createText, setText } from '../ui/text';
import { EffectsLayer } from '../effects/effectsLayer';
import { PieceSprite } from '../pieces/pieceSprite';
import { PresentationDirector } from '../playing/presentation';
import type { PixiScreen, ScreenContext } from './base';

// 棋盘几何常量（与旧 gameScreen 完全一致，确保坐标系兼容 visualBoard.cellCenter）。
const BOARD_ROWS = 10;
const BOARD_COLS = 10;
const BOARD_CELL_SIZE = 62;
const BOARD_GAP = 5;
const BOARD_START_X = 43;
const BOARD_START_Y = 286;
const BOARD_AREA_SIZE = BOARD_COLS * BOARD_CELL_SIZE + (BOARD_COLS - 1) * BOARD_GAP;

const POWER_UPS: Array<{ type: PowerUpType; x: number; label: string }> = [
  { type: 'bomb', x: 60, label: '炸开' },
  { type: 'suck', x: 280, label: '吸走' },
  { type: 'shuffle', x: 500, label: '重排' },
];

interface PowerUpButton {
  type: PowerUpType;
  handle: ButtonHandle;
}

export class PlayingScreen implements PixiScreen {
  readonly container: Container;
  private readonly visualBoard: VisualBoardModel;
  private readonly presentation = new PresentationDirector();
  private readonly effects = new EffectsLayer(80);

  // 顶部信息
  private readonly chapterTitleText: Text;
  private readonly movesText: Text;
  private readonly coinText: Text;
  private readonly targetText: Text;

  // 棋盘
  private readonly gameLayer = new Container();
  private readonly piecesLayer = new Container();
  private readonly selectedGlow: Graphics;
  private readonly boardHit: Container;

  // 道具
  private readonly powerUpButtons: PowerUpButton[] = [];

  // PieceSprite 池
  private readonly pieceSprites = new Map<string, PieceSprite>();
  // 类成员复用，避免每帧 new Set（优化 #1）。
  private readonly seenPieceIds = new Set<string>();
  // 诊断计数（drawElements failed 排查用）
  private poolCreateCount = 0;
  private poolDestroyCount = 0;

  // visualCue 去重：只在 cue.id 变化时 emit 一次浮字/burst。
  private handledVisualCueId = -1;

  // 背景烘焙
  private boardBgSprite: Sprite | null = null;
  private boardBgBaked = false;

  // 新关卡标志（首次 sync 时 reset visualBoard 状态）
  private currentLevelId = -1;

  constructor(private readonly ctx: ScreenContext) {
    this.container = new Container();
    this.container.label = 'playing';

    this.visualBoard = new VisualBoardModel({
      cellSize: BOARD_CELL_SIZE,
      gap: BOARD_GAP,
      startX: BOARD_START_X,
      startY: BOARD_START_Y,
    });

    // ─────────────────── 顶部信息条 ───────────────────
    this.container.addChild(createPanel({ x: 36, y: 36, width: 678, height: 196 }));
    this.chapterTitleText = createText({ text: '', size: 28, color: 0xffffff, align: 'left', x: 70, y: 88 });
    this.movesText = createText({ text: '', size: 30, color: 0xfef3c7, align: 'left', x: 70, y: 142 });
    this.coinText = createText({ text: '', size: 28, color: 0xffffff, align: 'left', x: 430, y: 88 });
    this.targetText = createText({ text: '', size: 24, color: 0xd1fae5, x: 375, y: 202 });
    this.container.addChild(this.chapterTitleText, this.movesText, this.coinText, this.targetText);
    this.container.addChild(
      createButton({
        x: 560, y: 130, width: 120, height: 54, label: '设置', labelSize: 22,
        onTap: () => ctx.dispatch({ type: 'openSettings' }),
      }).container,
    );

    // ─────────────────── 棋盘背景占位 ───────────────────
    this.container.addChild(createPanel({ x: 34, y: 276, width: 682, height: 682 }));

    // ─────────────────── gameLayer（震动偏移容器） ───────────────────
    this.container.addChild(this.gameLayer);

    // 选中高亮：几何一次画好，每帧只动 position + alpha。
    this.selectedGlow = new Graphics();
    this.selectedGlow
      .roundRect(0, 0, BOARD_CELL_SIZE, BOARD_CELL_SIZE, 8)
      .fill({ color: 0xfef3c7 })
      .stroke({ color: 0xf59e0b, width: 5 });
    this.selectedGlow.visible = false;
    this.gameLayer.addChild(this.selectedGlow);

    this.gameLayer.addChild(this.piecesLayer);
    this.gameLayer.addChild(this.effects.container);

    // ─────────────────── 触摸 hit-test（优化 #2：Rectangle hitArea，无 alpha=0 Graphics） ───────────────────
    this.boardHit = new Container();
    this.boardHit.eventMode = 'static';
    this.boardHit.cursor = 'pointer';
    this.boardHit.hitArea = new Rectangle(BOARD_START_X, BOARD_START_Y, BOARD_AREA_SIZE, BOARD_AREA_SIZE);
    this.boardHit.on('pointertap', this.handleBoardTap);
    this.container.addChild(this.boardHit);

    // ─────────────────── 底部道具按钮 ───────────────────
    for (const def of POWER_UPS) {
      const handle = createButton({
        x: def.x, y: 1148, width: 190, height: 70, label: `${def.label} 0`,
        onTap: () => ctx.dispatch({ type: 'usePowerUp', item: def.type }),
      });
      this.container.addChild(handle.container);
      this.powerUpButtons.push({ type: def.type, handle });
    }
  }

  show(view: AppViewState, nowMs: number): void {
    this.container.visible = true;

    // 检测是否进入新关卡（levelId 变 / session 重新创建）。
    const session = view.session;
    if (session && session.levelId !== this.currentLevelId) {
      this.currentLevelId = session.levelId;
      this.disposePieceSprites();
      this.visualBoard.clearFinaleBlocks();
      this.presentation.reset();
      this.effects.reset();
      this.handledVisualCueId = -1;
    }

    // 棋盘背景 RT 烘焙：只第一次进入战斗屏时执行一次（renderer ready 之后才能成功）。
    if (!this.boardBgBaked) {
      this.bakeBoardBackground();
    }

    this.update(view, nowMs);
  }

  hide(): void {
    this.container.visible = false;
    // 不清 effects/visualBoard 状态：modal 叠加场景（settings/won 等）下层仍要继续显示，
    // 切回 menu 由 show() 检测 levelId 变化时再 reset。
  }

  update(view: AppViewState, nowMs: number): void {
    const session = view.session;
    if (!session) {
      return;
    }

    // ─────── 顶部文本 ───────
    setText(this.chapterTitleText, `${view.pendingLevel?.chapterTitle ?? '防线'}  第 ${session.levelId} 关`);
    setText(this.movesText, `步数 ${session.movesLeft}`);
    setText(this.coinText, `金币 ${view.save.coins}`);
    const targetStr = session.targets
      .map((t) => targetProgressText(t, session.targetProgress))
      .join('  ');
    setText(this.targetText, targetStr);

    // ─────── presentation 分步播放 ───────
    const board = this.presentation.boardFor(session, nowMs);
    const changes = this.visualBoard.sync(board, nowMs);

    // ─────── 消除特效（每个 step 独立 burst + 连消 floatText） ───────
    for (const tile of changes.removed) {
      this.effects.burst(
        tile.x + BOARD_CELL_SIZE / 2,
        tile.y + BOARD_CELL_SIZE / 2,
        colorForCell(tile.cell),
        nowMs,
        7,
      );
    }
    if (changes.removed.length >= 4) {
      const center = averageTileCenters(changes.removed);
      this.effects.floatText(`${changes.removed.length} 连消`, center.x, center.y, '#ffd166', nowMs);
    }

    // ─────── presentation 新进入 clear step → 震动 ───────
    if (this.presentation.consumeClearStepEntered()) {
      const amplitude = Math.min(12, 4 + changes.removed.length * 1.2);
      this.effects.triggerShake(amplitude, 240, nowMs);
    }

    // ─────── visualCue（combo / swapRejected） ───────
    this.handleVisualCue(view, nowMs);

    // ─────── piece sprite 池同步（优化 #1：复用 seenPieceIds） ───────
    const tiles = this.visualBoard.tilesAt(nowMs);
    this.seenPieceIds.clear();
    for (const tile of tiles) {
      this.seenPieceIds.add(tile.id);
      let sprite = this.pieceSprites.get(tile.id);
      if (!sprite) {
        sprite = new PieceSprite(BOARD_CELL_SIZE);
        sprite.diagId = tile.id;
        this.poolCreateCount += 1;
        if (this.poolCreateCount <= 30 || this.poolCreateCount % 30 === 0) {
          console.log('[piece-pool] create#%d id=%s, pool size after=%d',
            this.poolCreateCount, tile.id, this.pieceSprites.size + 1);
        }
        this.pieceSprites.set(tile.id, sprite);
        this.piecesLayer.addChild(sprite);
      }
      const isSelected = session.selectedCell?.row === tile.row && session.selectedCell.col === tile.col;
      sprite.sync(tile, isSelected);
    }
    for (const [id, sprite] of this.pieceSprites) {
      if (!this.seenPieceIds.has(id)) {
        this.poolDestroyCount += 1;
        if (this.poolDestroyCount <= 30 || this.poolDestroyCount % 30 === 0) {
          console.log('[piece-pool] destroy#%d id=%s, pool size before=%d',
            this.poolDestroyCount, id, this.pieceSprites.size);
        }
        this.piecesLayer.removeChild(sprite);
        sprite.destroy({ children: true });
        this.pieceSprites.delete(id);
      }
    }

    // ─────── 选中格高亮 ───────
    this.renderSelectedGlow(session.selectedCell, nowMs);

    // ─────── 道具按钮 ───────
    for (const button of this.powerUpButtons) {
      this.updatePowerUpButton(button, view);
    }

    // ─────── effects 推进 + 屏幕震动 ───────
    const shake = this.effects.update(nowMs);
    this.gameLayer.position.set(shake.x, shake.y);
  }

  dispose(): void {
    this.disposePieceSprites();
    this.effects.dispose();
    if (this.boardBgSprite) {
      this.boardBgSprite.destroy();
      this.boardBgSprite = null;
    }
    this.container.destroy({ children: true });
  }

  // ───────────────────────────────────────────────────────────────────────
  // 内部：烘焙棋盘背景
  // ───────────────────────────────────────────────────────────────────────

  private bakeBoardBackground(): void {
    const renderer = this.ctx.getRenderer();
    if (!renderer) {
      console.warn('[playing] renderer not ready, skip bake; will retry next show');
      return;
    }

    const bake = new Container();
    const slots = new Graphics();
    for (let row = 0; row < BOARD_ROWS; row += 1) {
      for (let col = 0; col < BOARD_COLS; col += 1) {
        const x = BOARD_START_X + col * (BOARD_CELL_SIZE + BOARD_GAP);
        const y = BOARD_START_Y + row * (BOARD_CELL_SIZE + BOARD_GAP);
        slots
          .roundRect(x, y, BOARD_CELL_SIZE, BOARD_CELL_SIZE, 8)
          .fill({ color: 0xffffff, alpha: 0.12 })
          .stroke({ color: 0xffffff, alpha: 0.18, width: 2 });
      }
    }
    bake.addChild(slots);

    const rt = RenderTexture.create({
      width: this.ctx.logicalWidth,
      height: this.ctx.logicalHeight,
      resolution: renderer.resolution,
    });
    try {
      renderer.render({ container: bake, target: rt });
    } catch (e) {
      console.error('[playing] bake board background failed:', (e as Error).message);
      bake.destroy({ children: true });
      rt.destroy();
      return;
    }
    bake.destroy({ children: true });

    this.boardBgSprite = new Sprite(rt);
    this.boardBgSprite.position.set(0, 0);
    // 插到 gameLayer 之前（gameLayer 是 boardPanel 后第一个子节点）。
    const gameLayerIndex = this.container.getChildIndex(this.gameLayer);
    this.container.addChildAt(this.boardBgSprite, gameLayerIndex);
    this.boardBgBaked = true;
  }

  // ───────────────────────────────────────────────────────────────────────
  // 内部：选中高亮
  // ───────────────────────────────────────────────────────────────────────

  private renderSelectedGlow(selected: Position | null, nowMs: number): void {
    if (!selected) {
      this.selectedGlow.visible = false;
      return;
    }
    const x = BOARD_START_X + selected.col * (BOARD_CELL_SIZE + BOARD_GAP);
    const y = BOARD_START_Y + selected.row * (BOARD_CELL_SIZE + BOARD_GAP);
    const pulse = 0.5 + Math.sin(nowMs / 120) * 0.5;
    this.selectedGlow.position.set(x, y);
    this.selectedGlow.alpha = 0.88 + pulse * 0.08;
    this.selectedGlow.visible = true;
  }

  // ───────────────────────────────────────────────────────────────────────
  // 内部：visualCue (combo / swapRejected) → effects
  // ───────────────────────────────────────────────────────────────────────

  private handleVisualCue(view: AppViewState, nowMs: number): void {
    const cue = view.visualCue;
    if (!cue || cue.id === this.handledVisualCueId) return;
    this.handledVisualCueId = cue.id;

    if (cue.type === 'combo') {
      const text = cue.combo >= 5 ? `超级连击 x${cue.combo}` : `连击 x${cue.combo}`;
      this.effects.floatText(text, 375, 275, '#ffd166', nowMs);
      return;
    }

    // swapRejected
    const from = this.visualBoard.cellCenter(cue.from.row, cue.from.col);
    const to = this.visualBoard.cellCenter(cue.to.row, cue.to.col);
    const half = BOARD_CELL_SIZE / 2;
    this.effects.floatText('未形成消除', (from.x + to.x) / 2 + half, (from.y + to.y) / 2 + half, '#ffd166', nowMs);
    this.effects.burst(from.x + half, from.y + half, '#ffd166', nowMs, 4);
    this.effects.burst(to.x + half, to.y + half, '#ffd166', nowMs, 4);
  }

  // ───────────────────────────────────────────────────────────────────────
  // 内部：道具按钮状态
  // ───────────────────────────────────────────────────────────────────────

  private updatePowerUpButton(button: PowerUpButton, view: AppViewState): void {
    const count = view.save.items[button.type];
    const active = view.activePowerUp === button.type;
    const def = POWER_UPS.find((d) => d.type === button.type)!;
    if (count > 0) {
      button.handle.setLabel(`${active ? '>' : ''}${def.label} ${count}`);
    } else {
      button.handle.setLabel(`${POWER_UP_COIN_COSTS[button.type]}币${def.label}`);
    }
  }

  // ───────────────────────────────────────────────────────────────────────
  // 内部：触摸 → tapCell dispatch
  // ───────────────────────────────────────────────────────────────────────

  private handleBoardTap = (event: { global: { x: number; y: number } }): void => {
    const local = this.container.toLocal(event.global);
    const cell = cellAt(local.x, local.y);
    if (cell) {
      this.ctx.dispatch({ type: 'tapCell', position: cell });
    }
  };

  // ───────────────────────────────────────────────────────────────────────
  // 内部：清空 piece 池
  // ───────────────────────────────────────────────────────────────────────

  private disposePieceSprites(): void {
    for (const sprite of this.pieceSprites.values()) {
      this.piecesLayer.removeChild(sprite);
      sprite.destroy({ children: true });
    }
    this.pieceSprites.clear();
  }
}

// ─────────────────────────────────────────────────────────────────────────
// helpers
// ─────────────────────────────────────────────────────────────────────────

function cellAt(x: number, y: number): Position | null {
  if (x < BOARD_START_X || y < BOARD_START_Y) return null;
  const col = Math.floor((x - BOARD_START_X) / (BOARD_CELL_SIZE + BOARD_GAP));
  const row = Math.floor((y - BOARD_START_Y) / (BOARD_CELL_SIZE + BOARD_GAP));
  const insideX = (x - BOARD_START_X) % (BOARD_CELL_SIZE + BOARD_GAP) <= BOARD_CELL_SIZE;
  const insideY = (y - BOARD_START_Y) % (BOARD_CELL_SIZE + BOARD_GAP) <= BOARD_CELL_SIZE;
  if (row >= 0 && row < BOARD_ROWS && col >= 0 && col < BOARD_COLS && insideX && insideY) {
    return { row, col };
  }
  return null;
}

function colorForCell(cell: BoardCell): string {
  if (cell.kind === 'normal' || cell.kind === 'special') return pieceColors[cell.pieceKind];
  if (cell.kind === 'blocker') return cell.blockerKind === 'sandbag' ? '#9b6a3a' : '#6b7280';
  return '#ffffff';
}

// 优化 #3：for 循环替代 reduce，避免每次创建临时对象。
function averageTileCenters(tiles: VisualTile[]): { x: number; y: number } {
  let sumX = 0;
  let sumY = 0;
  for (let i = 0; i < tiles.length; i += 1) {
    sumX += tiles[i].x + BOARD_CELL_SIZE / 2;
    sumY += tiles[i].y + BOARD_CELL_SIZE / 2;
  }
  const n = Math.max(1, tiles.length);
  return { x: sumX / n, y: sumY / n };
}
