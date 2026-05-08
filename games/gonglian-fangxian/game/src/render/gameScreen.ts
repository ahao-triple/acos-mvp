import type { AppAction, AppViewState } from '../app/controller';
import type { Board, BoardCell, PieceKind, Position } from '../core/types';
import type { EffectsModel } from './effects';
import { pieceColors, targetProgressText } from './theme';
import { drawAdButton, drawButton, drawPanel, drawText, roundRect, type UiRenderContext } from './uiPrimitives';
import type { VisualBoardModel, VisualTile } from './visualBoard';

export const BOARD_CELL_SIZE = 86;
export const BOARD_GAP = 8;
export const BOARD_START_X = 57;
export const BOARD_START_Y = 300;

export interface GameScreenRenderContext {
  ui: UiRenderContext;
  nowMs: number;
  visualBoard: VisualBoardModel;
  effects: EffectsModel;
  presentedBoard(session: NonNullable<AppViewState['session']>, nowMs: number): Board;
  handleVisualCue(view: AppViewState, nowMs: number): void;
  drawEffects(nowMs: number): void;
}

export function drawGameScreen(context: GameScreenRenderContext, view: AppViewState): void {
  const session = view.session;
  if (!session) {
    return;
  }

  drawPanel(context.ui.ctx, 36, 36, 678, 196);
  const level = view.pendingLevel;
  drawText(context.ui.ctx, `${level?.chapterTitle ?? '防线'}  第 ${session.levelId} 关`, 70, 88, 28, '#ffffff', 'left');
  drawText(context.ui.ctx, `步数 ${session.movesLeft}`, 70, 142, 30, '#fef3c7', 'left');
  drawText(context.ui.ctx, `金币 ${view.save.coins}`, 430, 88, 28, '#ffffff', 'left');
  drawButton(context.ui, 570, 130, 110, 54, '暂停', { type: 'pause' });
  drawTargets(context.ui, session);
  context.handleVisualCue(view, context.nowMs);
  drawBoard(context, session);
  context.drawEffects(context.nowMs);
  drawPowerUpButton(context.ui, 60, 1148, 190, 70, '炸开', view.save.items.bomb, view.activePowerUp === 'bomb', { type: 'usePowerUp', item: 'bomb' });
  drawPowerUpButton(context.ui, 280, 1148, 190, 70, '吸走', view.save.items.suck, view.activePowerUp === 'suck', { type: 'usePowerUp', item: 'suck' });
  drawPowerUpButton(context.ui, 500, 1148, 190, 70, '重排', view.save.items.shuffle, false, { type: 'usePowerUp', item: 'shuffle' });
}

export function cellAt(x: number, y: number): Position | null {
  if (x < BOARD_START_X || y < BOARD_START_Y) {
    return null;
  }

  const col = Math.floor((x - BOARD_START_X) / (BOARD_CELL_SIZE + BOARD_GAP));
  const row = Math.floor((y - BOARD_START_Y) / (BOARD_CELL_SIZE + BOARD_GAP));
  const insideX = (x - BOARD_START_X) % (BOARD_CELL_SIZE + BOARD_GAP) <= BOARD_CELL_SIZE;
  const insideY = (y - BOARD_START_Y) % (BOARD_CELL_SIZE + BOARD_GAP) <= BOARD_CELL_SIZE;

  if (row >= 0 && row < 7 && col >= 0 && col < 7 && insideX && insideY) {
    return { row, col };
  }

  return null;
}

function drawTargets(ui: UiRenderContext, session: NonNullable<AppViewState['session']>): void {
  const text = session.targets.map((target) => targetProgressText(target, session.targetProgress)).join('  ');
  drawText(ui.ctx, text, 375, 202, 24, '#d1fae5', 'center');
}

function drawPowerUpButton(ui: UiRenderContext, x: number, y: number, width: number, height: number, name: string, count: number, active: boolean, action: AppAction): void {
  if (count > 0) {
    drawButton(ui, x, y, width, height, `${active ? '>' : ''}${name} ${count}`, action);
    return;
  }

  drawAdButton(ui, x, y, width, height, `${active ? '>' : ''}看广告${name}`, action);
}

function drawBoard(context: GameScreenRenderContext, session: NonNullable<AppViewState['session']>): void {
  const board = context.presentedBoard(session, context.nowMs);
  const ctx = context.ui.ctx;
  drawPanel(ctx, 34, 276, 682, 682);

  for (let row = 0; row < board.length; row += 1) {
    for (let col = 0; col < board[row].length; col += 1) {
      const x = BOARD_START_X + col * (BOARD_CELL_SIZE + BOARD_GAP);
      const y = BOARD_START_Y + row * (BOARD_CELL_SIZE + BOARD_GAP);
      const selected = session.selectedCell?.row === row && session.selectedCell.col === col;
      drawCellSlot(ctx, x, y, BOARD_CELL_SIZE, selected, context.nowMs);
    }
  }

  const changes = context.visualBoard.sync(board, context.nowMs);
  for (const tile of changes.removed) {
    context.effects.burst(tile.x + BOARD_CELL_SIZE / 2, tile.y + BOARD_CELL_SIZE / 2, colorForCell(tile.cell), context.nowMs, 7);
  }
  if (changes.removed.length >= 4) {
    const center = averageTiles(changes.removed);
    context.effects.floatText(`${changes.removed.length} 连消`, center.x, center.y, '#ffd166', context.nowMs);
  }

  for (const tile of context.visualBoard.tilesAt(context.nowMs)) {
    drawVisualTile(ctx, tile, BOARD_CELL_SIZE, session.selectedCell);
  }
}

function drawCellSlot(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, selected: boolean, nowMs: number): void {
  const pulse = selected ? 0.5 + Math.sin(nowMs / 120) * 0.5 : 0;
  ctx.fillStyle = selected ? `rgba(254,243,199,${0.88 + pulse * 0.08})` : 'rgba(255,255,255,0.12)';
  roundRect(ctx, x, y, size, size, 8);
  ctx.fill();
  ctx.strokeStyle = selected ? '#f59e0b' : 'rgba(255,255,255,0.18)';
  ctx.lineWidth = selected ? 5 : 2;
  ctx.stroke();
}

function drawVisualTile(ctx: CanvasRenderingContext2D, tile: VisualTile, size: number, selectedCell: Position | null): void {
  const selected = selectedCell?.row === tile.row && selectedCell.col === tile.col;

  ctx.save();
  ctx.globalAlpha = tile.alpha;
  ctx.translate(tile.x + size / 2, tile.y + size / 2);
  ctx.scale(tile.scale * (selected ? 1.05 : 1), tile.scale * (selected ? 1.05 : 1));
  ctx.translate(-size / 2, -size / 2);

  if (tile.cell.kind === 'blocker') {
    const color = tile.cell.blockerKind === 'sandbag' ? '#9b6a3a' : '#6b7280';
    drawGlowBox(ctx, 4, 4, size - 8, size - 8, color);
    ctx.fillStyle = color;
    roundRect(ctx, 15, 18, size - 30, size - 36, 8);
    ctx.fill();
    drawText(ctx, tile.cell.blockerKind === 'sandbag' ? '沙' : '损', size / 2, size / 2 + 10, 32, '#ffffff', 'center');
    ctx.restore();
    return;
  }

  if (tile.cell.kind === 'normal' || tile.cell.kind === 'special') {
    const color = pieceColors[tile.cell.pieceKind];
    drawGlowBox(ctx, 4, 4, size - 8, size - 8, color);
    ctx.strokeStyle = 'rgba(255,255,255,0.52)';
    ctx.lineWidth = 1.4;
    roundRect(ctx, 12, 12, size - 24, size - 24, 8);
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, 28, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.beginPath();
    ctx.ellipse(size / 2 - 8, size / 2 - 10, 15, 8, -0.4, 0, Math.PI * 2);
    ctx.fill();
    drawPieceIcon(ctx, tile.cell.pieceKind, size / 2, size / 2, color);
    if (tile.cell.kind === 'special') {
      drawText(ctx, tile.cell.specialKind === 'areaBomb' ? '爆' : tile.cell.specialKind === 'horizontalRocket' ? '横' : '竖', size / 2, size - 16, 18, '#ffffff', 'center');
    }
  }

  ctx.restore();
}

function drawPieceIcon(ctx: CanvasRenderingContext2D, kind: PieceKind, cx: number, cy: number, color: string): void {
  ctx.strokeStyle = '#ffffff';
  ctx.fillStyle = withAlpha(color, 0.45);
  ctx.lineWidth = 3;
  const s = 18;

  if (kind === 'shield') {
    ctx.beginPath();
    ctx.moveTo(cx, cy - s);
    ctx.lineTo(cx + s * 0.8, cy - s * 0.45);
    ctx.lineTo(cx + s * 0.55, cy + s * 0.85);
    ctx.lineTo(cx, cy + s);
    ctx.lineTo(cx - s * 0.55, cy + s * 0.85);
    ctx.lineTo(cx - s * 0.8, cy - s * 0.45);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (kind === 'ammo') {
    roundRect(ctx, cx - s * 0.65, cy - s * 0.8, s * 1.3, s * 1.6, 4);
    ctx.fill();
    ctx.stroke();
  } else if (kind === 'radar') {
    ctx.beginPath();
    ctx.arc(cx, cy, s, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, s * 0.45, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + s * 0.9, cy - s * 0.45);
    ctx.stroke();
  } else if (kind === 'medal') {
    drawStar(ctx, cx, cy, s);
    ctx.fill();
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.8, cy + s * 0.7);
    ctx.lineTo(cx + s * 0.55, cy - s * 0.65);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx + s * 0.62, cy - s * 0.72, s * 0.34, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawGlowBox(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, color: string): void {
  ctx.fillStyle = withAlpha(color, 0.1);
  roundRect(ctx, x - 7, y - 7, width + 14, height + 14, 14);
  ctx.fill();
  ctx.fillStyle = withAlpha(color, 0.18);
  roundRect(ctx, x - 3, y - 3, width + 6, height + 6, 12);
  ctx.fill();
  ctx.fillStyle = '#101827';
  roundRect(ctx, x, y, width, height, 10);
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  roundRect(ctx, x + 1.5, y + 1.5, width - 3, height - 3, 9);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.13)';
  roundRect(ctx, x + 8, y + 9, width - 16, height * 0.34, 7);
  ctx.fill();
}

function withAlpha(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  const r = Number.parseInt(clean.slice(0, 2), 16);
  const g = Number.parseInt(clean.slice(2, 4), 16);
  const b = Number.parseInt(clean.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function drawStar(ctx: CanvasRenderingContext2D, cx: number, cy: number, radius: number): void {
  ctx.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const r = i % 2 === 0 ? radius : radius * 0.42;
    const angle = -Math.PI / 2 + (i * Math.PI) / 5;
    const x = cx + Math.cos(angle) * r;
    const y = cy + Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function averageTiles(tiles: VisualTile[]): { x: number; y: number } {
  const total = tiles.reduce(
    (sum, tile) => ({
      x: sum.x + tile.x + BOARD_CELL_SIZE / 2,
      y: sum.y + tile.y + BOARD_CELL_SIZE / 2,
    }),
    { x: 0, y: 0 },
  );

  return {
    x: total.x / tiles.length,
    y: total.y / tiles.length,
  };
}

function colorForCell(cell: BoardCell): string {
  if (cell.kind === 'normal' || cell.kind === 'special') {
    return pieceColors[cell.pieceKind];
  }
  if (cell.kind === 'blocker') {
    return cell.blockerKind === 'sandbag' ? '#9b6a3a' : '#6b7280';
  }
  return '#ffffff';
}
