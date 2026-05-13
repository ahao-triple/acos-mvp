/**
 * 棋子 sprite 持久节点。
 *
 * 设计：
 *  - 每个 piece id 对应一个 PieceSprite 实例（PlayingScreen 维护 Map<id, PieceSprite> 池）
 *  - kind 不变时只调 sync() 设 transform（x/y/alpha/scale），不调 .clear() + redraw
 *  - kind 变化（如 normal → special）才 rebuild() 重画 Graphics 几何
 *
 * 视觉简化（vs 旧 gameScreen drawVisualTile）：
 *  - normal/special：底层 glow box（带颜色光晕 + 内框）+ 中央圆形彩色 piece
 *  - blocker：灰/棕色方块 + 单字标签（沙/损）
 *  - 图标：用 PieceKind 单字代替旧版的复杂 path 图标，避免大量 path 描边在 vivo 上的潜在风险，
 *    后续 Phase 1.5 再补回详细 icon（可换 SDF / texture atlas 实现）
 */
import { Container, Graphics, Text } from 'pixi.js';
import type { BoardCell, BlockerKind, PieceKind } from '../../core/types';
import { pieceColors } from '../../render/theme';
import type { VisualTile } from '../../render/visualBoard';
import { type CachedKind, classifyCell, sameKind } from './pieceKind';

const PIECE_LABELS: Record<PieceKind, string> = {
  shield: '盾',
  ammo: '弹',
  radar: '雷',
  medal: '勋',
  wrench: '扳',
  energy: '能',
};

const BLOCKER_LABELS: Record<BlockerKind, string> = {
  sandbag: '沙',
  brokenDefense: '损',
};

const BLOCKER_COLORS: Record<BlockerKind, number> = {
  sandbag: 0x9b6a3a,
  brokenDefense: 0x6b7280,
};

// 全局诊断计数（仅 log 限流用）。
let redrawCount = 0;
let scaleWarnCount = 0;

export class PieceSprite extends Container {
  private readonly bg = new Graphics();
  private readonly fg = new Graphics();
  private readonly pieceLabel: Text;
  private cachedKind: CachedKind | null = null;
  private readonly cellSize: number;
  /** 排查 drawElements failed 用的 id 标记，由 playing.ts 池逻辑赋值。 */
  public diagId: string = '';

  constructor(cellSize: number) {
    super();
    this.cellSize = cellSize;
    this.addChild(this.bg);
    this.addChild(this.fg);
    this.pieceLabel = new Text({
      text: '',
      style: {
        fontFamily: 'system-ui, sans-serif',
        fontSize: Math.floor(cellSize * 0.34),
        fontWeight: '700',
        fill: 0xffffff,
        align: 'center',
      },
    });
    this.pieceLabel.anchor.set(0.5, 0.5);
    this.pieceLabel.position.set(cellSize / 2, cellSize / 2 + 2);
    this.addChild(this.pieceLabel);
    // pivot 一次性固定在格子几何中心。position 也是中心（tile.x + cellSize/2），二者重合，
    // 让 scale 围绕中心；redraw 在 (0,0)..(cellSize,cellSize) 坐标系画的内容自动以中心为基准。
    this.pivot.set(cellSize / 2, cellSize / 2);
  }

  /** 每帧调：从 VisualTile 读 transform 并赋值；kind 变了 redraw。 */
  sync(tile: VisualTile, isSelected: boolean): void {
    this.syncKind(tile.cell);

    // tile.x/y 是格子左上角的逻辑坐标。position 设到格子中心 + pivot 在几何中心 ⇒ 中心对中心。
    const size = this.cellSize;
    const cx = tile.x + size / 2;
    const cy = tile.y + size / 2;
    const scale = tile.scale * (isSelected ? 1.05 : 1);
    // scale=0 是合法（淡出/缩没动画），但 NaN / Infinity / 负数 会让 PixiJS transform 矩阵奇异，
    // 可能是 drawElements failed 的诱因之一。前 20 次警告每次都打，之后每 60 次打一次。
    if (!Number.isFinite(scale) || scale < 0) {
      scaleWarnCount += 1;
      if (scaleWarnCount <= 20 || scaleWarnCount % 60 === 0) {
        console.warn('[piece-sprite] BAD scale=%s tile.scale=%s alpha=%s id=%s',
          String(scale), String(tile.scale), String(tile.alpha), this.diagId);
      }
    }
    this.position.set(cx, cy);
    this.scale.set(scale, scale);
    this.alpha = tile.alpha;
  }

  private syncKind(cell: BoardCell): void {
    // 快速路径：kind 没变就直接返回，sameKind 不分配对象。99% 的帧走这里。
    if (sameKind(this.cachedKind, cell)) {
      return;
    }
    // kind 真变了：classifyCell 分配一次 CachedKind 对象，再 redraw。
    const next = classifyCell(cell);
    if (!next) {
      this.bg.clear();
      this.fg.clear();
      this.pieceLabel.text = '';
      this.cachedKind = null;
      return;
    }
    this.cachedKind = next;
    this.redraw(next);
  }

  private redraw(kind: CachedKind): void {
    redrawCount += 1;
    const kindStr = kind.type === 'blocker' ? `blocker:${kind.blockerKind}` : `${kind.type}:${kind.pieceKind}`;
    const logThis = redrawCount <= 30 || redrawCount % 30 === 0;
    if (logThis) {
      console.log('[piece-sprite] redraw#%d start id=%s kind=%s', redrawCount, this.diagId, kindStr);
    }
    const size = this.cellSize;
    this.bg.clear();
    this.fg.clear();

    if (kind.type === 'blocker') {
      const color = BLOCKER_COLORS[kind.blockerKind];
      drawGlowBox(this.bg, 4, 4, size - 8, size - 8, color);
      this.fg.roundRect(15, 18, size - 30, size - 36, 8).fill({ color });
      this.pieceLabel.text = BLOCKER_LABELS[kind.blockerKind];
      if (logThis) this.logRedrawEnd(kindStr);
      return;
    }

    const colorHex = pieceColors[kind.pieceKind];
    const color = parseHexColor(colorHex);
    drawGlowBox(this.bg, 4, 4, size - 8, size - 8, color);
    // 内框
    this.fg.roundRect(12, 12, size - 24, size - 24, 8).stroke({ color: 0xffffff, alpha: 0.52, width: 1.4 });
    // 中心圆 + 高光（special 略大）
    const r = size * (kind.type === 'special' ? 0.36 : 0.32);
    this.fg.circle(size / 2, size / 2, r).fill({ color });
    this.fg
      .ellipse(size / 2 - size * 0.09, size / 2 - size * 0.11, size * 0.17, size * 0.09)
      .fill({ color: 0xffffff, alpha: 0.22 });

    this.pieceLabel.text = PIECE_LABELS[kind.pieceKind];
    if (logThis) this.logRedrawEnd(kindStr);
  }

  private logRedrawEnd(kindStr: string): void {
    // 试读 GraphicsContext.instructions 数量作为几何复杂度近似指标。v8 Graphics 内部表示。
    const bgCtx = (this.bg as unknown as { context?: { instructions?: unknown[] } }).context;
    const fgCtx = (this.fg as unknown as { context?: { instructions?: unknown[] } }).context;
    const bgInstr = bgCtx?.instructions?.length ?? -1;
    const fgInstr = fgCtx?.instructions?.length ?? -1;
    console.log('[piece-sprite] redraw#%d end   id=%s kind=%s bgInstr=%d fgInstr=%d',
      redrawCount, this.diagId, kindStr, bgInstr, fgInstr);
  }
}

function parseHexColor(hex: string): number {
  const clean = hex.replace('#', '');
  return Number.parseInt(clean, 16);
}

function drawGlowBox(g: Graphics, x: number, y: number, w: number, h: number, color: number): void {
  g.roundRect(x - 7, y - 7, w + 14, h + 14, 14).fill({ color, alpha: 0.1 });
  g.roundRect(x - 3, y - 3, w + 6, h + 6, 12).fill({ color, alpha: 0.18 });
  g.roundRect(x, y, w, h, 10).fill({ color: 0x101827 });
  g.roundRect(x + 1.5, y + 1.5, w - 3, h - 3, 9).stroke({ color, width: 3 });
  g.roundRect(x + 8, y + 9, w - 16, h * 0.34, 7).fill({ color: 0xffffff, alpha: 0.13 });
}
