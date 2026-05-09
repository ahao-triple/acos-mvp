import type { GameController, ToolName } from '../app/controller';
import type { AssetManifest } from '../assets/types';
import { resolveAssetUrl } from '../assets/loader';
import type { BoardCell, Direction } from '../core/types';
import { BOARD_BOX, DESIGN_HEIGHT, DESIGN_WIDTH, boardLayout, cellRect, viewportScale } from './layout';
import { ImageCache } from './imageCache';
import { theme } from './theme';

interface HitTarget {
  type: 'cell' | 'continue' | 'retry' | 'tool' | 'hint';
  index?: number;
  tool?: ToolName;
  rect: Rect;
}

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export class CanvasRenderer {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly imageCache = new ImageCache();
  private readonly hits: HitTarget[] = [];
  private scale = 1;
  private offsetX = 0;
  private offsetY = 0;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly controller: GameController,
    private readonly manifest: AssetManifest,
    private readonly assetBase: string,
  ) {
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Canvas 2D context is unavailable.');
    }
    this.ctx = ctx;
    this.onPointerDown = this.onPointerDown.bind(this);
    canvas.addEventListener('pointerdown', this.onPointerDown);
    canvas.addEventListener('touchstart', this.onPointerDown, { passive: false });
  }

  destroy(): void {
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    this.canvas.removeEventListener('touchstart', this.onPointerDown);
  }

  resize(width: number, height: number, dpr: number): void {
    this.scale = viewportScale(width, height);
    const cssWidth = DESIGN_WIDTH * this.scale;
    const cssHeight = DESIGN_HEIGHT * this.scale;
    this.offsetX = (width - cssWidth) / 2 / this.scale;
    this.offsetY = (height - cssHeight) / 2 / this.scale;
    this.canvas.width = Math.max(1, Math.floor(width * dpr));
    this.canvas.height = Math.max(1, Math.floor(height * dpr));
    const style = (this.canvas as HTMLCanvasElement & { style?: CSSStyleDeclaration }).style;
    if (style) {
      style.width = `${width}px`;
      style.height = `${height}px`;
    }
    this.ctx.setTransform(dpr * this.scale, 0, 0, dpr * this.scale, dpr * this.offsetX * this.scale, dpr * this.offsetY * this.scale);
  }

  render(): void {
    const view = this.controller.getViewState();
    this.hits.length = 0;
    this.ctx.clearRect(-this.offsetX, -this.offsetY, DESIGN_WIDTH + Math.abs(this.offsetX) * 2, DESIGN_HEIGHT + Math.abs(this.offsetY) * 2);
    this.drawBackground();
    this.drawHud();
    this.drawLevelInfo();
    this.drawBoard();
    this.drawTools();
    if (view.screen === 'win') {
      this.drawResult('Complete', 'Continue', 'continue');
    } else if (view.screen === 'failed') {
      this.drawResult('No moves', 'Retry', 'retry');
    }
  }

  private drawBackground(): void {
    const gradient = this.ctx.createLinearGradient(0, 0, 0, DESIGN_HEIGHT);
    gradient.addColorStop(0, theme.backgroundTop);
    gradient.addColorStop(0.56, '#f8fbff');
    gradient.addColorStop(1, theme.backgroundBottom);
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, 0, DESIGN_WIDTH, DESIGN_HEIGHT);
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.46)';
    for (let y = 170; y < DESIGN_HEIGHT; y += 72) {
      this.ctx.fillRect(0, y, DESIGN_WIDTH, 2);
    }
  }

  private drawHud(): void {
    const { save } = this.controller.getViewState();
    this.roundRect(36, 32, 678, 92, 28, theme.panelStrong, 'rgba(16, 32, 51, 0.14)');
    this.text('Tap Gallery', 64, 86, 32, 700, theme.ink, 'left');
    this.pill(452, 48, 92, 46, `E ${save.energy}`, theme.mint);
    this.pill(562, 48, 120, 46, `$ ${save.coins}`, theme.gold);
  }

  private drawLevelInfo(): void {
    const view = this.controller.getViewState();
    this.text(`Level ${view.level.levelNo}`, 54, 178, 24, 700, theme.muted, 'left');
    this.text(view.level.title, 54, 214, 34, 800, theme.ink, 'left');
    this.text(`${view.movesLeft} moves`, 696, 202, 26, 700, theme.ink, 'right');
    this.roundRect(54, 226, 642, 12, 6, 'rgba(16, 32, 51, 0.12)');
    this.roundRect(54, 226, 642 * view.progress, 12, 6, theme.coral);
  }

  private drawBoard(): void {
    const view = this.controller.getViewState();
    this.roundRect(BOARD_BOX.x - 16, BOARD_BOX.y - 16, BOARD_BOX.size + 32, BOARD_BOX.size + 32, 34, 'rgba(255, 255, 255, 0.72)', 'rgba(35, 49, 66, 0.14)');
    const reveal = this.imageCache.get(resolveAssetUrl(this.assetBase, view.level.revealImage));
    if (reveal?.complete && reveal.naturalWidth > 0) {
      this.ctx.save();
      this.ctx.globalAlpha = view.screen === 'win' ? 1 : 0.18 + view.progress * 0.42;
      this.ctx.drawImage(reveal, BOARD_BOX.x, BOARD_BOX.y, BOARD_BOX.size, BOARD_BOX.size);
      this.ctx.restore();
    } else {
      this.roundRect(BOARD_BOX.x, BOARD_BOX.y, BOARD_BOX.size, BOARD_BOX.size, 20, '#eef7ff');
    }

    const layout = boardLayout(view.level.board);
    for (const cell of view.board.cells) {
      if (cell.cleared) {
        continue;
      }
      const rect = cellRect(layout, cell.index, view.board.width);
      this.hits.push({
        type: 'cell',
        index: cell.index,
        rect: {
          x: rect.x - layout.gap / 2,
          y: rect.y - layout.gap / 2,
          width: rect.width + layout.gap,
          height: rect.height + layout.gap,
        },
      });
      this.drawCell(cell, rect);
    }
  }

  private drawCell(cell: BoardCell, rect: Rect): void {
    const view = this.controller.getViewState();
    const highlighted = view.feedback.indexes?.includes(cell.index);
    const fill = highlighted ? '#fff2a8' : '#ffffff';
    this.roundRect(rect.x, rect.y, rect.width, rect.height, Math.max(6, rect.width * 0.16), fill, 'rgba(16, 32, 51, 0.2)');
    this.ctx.fillStyle = cell.kind === 'golden' ? theme.gold : cell.kind === 'bomb' ? theme.coral : theme.ink;
    this.drawArrow(rect.x + rect.width / 2, rect.y + rect.height / 2, Math.max(10, rect.width * 0.32), cell.direction);
  }

  private drawArrow(cx: number, cy: number, size: number, direction: Direction): void {
    this.ctx.save();
    this.ctx.translate(cx, cy);
    this.ctx.rotate((Math.PI / 2) * direction);
    this.ctx.beginPath();
    this.ctx.moveTo(0, -size);
    this.ctx.lineTo(size * 0.72, -size * 0.16);
    this.ctx.lineTo(size * 0.26, -size * 0.16);
    this.ctx.lineTo(size * 0.26, size);
    this.ctx.lineTo(-size * 0.26, size);
    this.ctx.lineTo(-size * 0.26, -size * 0.16);
    this.ctx.lineTo(-size * 0.72, -size * 0.16);
    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.restore();
  }

  private drawTools(): void {
    const view = this.controller.getViewState();
    const tools: Array<{ key: ToolName; label: string }> = [
      { key: 'hint', label: 'Hint' },
      { key: 'bomb', label: 'Bomb' },
      { key: 'magnet', label: 'Magnet' },
      { key: 'hammer', label: 'Hammer' },
      { key: 'freeze', label: 'Freeze' },
    ];
    const y = 996;
    const width = 120;
    for (let index = 0; index < tools.length; index += 1) {
      const tool = tools[index];
      const x = 45 + index * 132;
      const active = view.selectedTool === tool.key;
      this.roundRect(x, y, width, 132, 18, active ? '#dff8ef' : theme.panelStrong, 'rgba(16, 32, 51, 0.16)');
      this.text(tool.label, x + width / 2, y + 48, 20, 700, theme.ink, 'center');
      this.text(String(view.save.tools[tool.key]), x + width / 2, y + 92, 28, 800, active ? theme.good : theme.muted, 'center');
      this.hits.push({ type: tool.key === 'hint' ? 'hint' : 'tool', tool: tool.key, rect: { x, y, width, height: 132 } });
    }
  }

  private drawResult(title: string, action: string, type: 'continue' | 'retry'): void {
    this.roundRect(86, 1156, 578, 118, 30, theme.panelStrong, 'rgba(16, 32, 51, 0.18)');
    this.text(title, 124, 1210, 32, 800, theme.ink, 'left');
    this.roundRect(458, 1184, 168, 58, 20, type === 'continue' ? theme.good : theme.coral);
    this.text(action, 542, 1222, 22, 800, '#ffffff', 'center');
    this.hits.push({ type, rect: { x: 458, y: 1184, width: 168, height: 58 } });
  }

  private onPointerDown(event: PointerEvent | TouchEvent): void {
    event.preventDefault?.();
    const point = this.eventToDesignPoint(event);
    const hit = [...this.hits].reverse().find((target) => contains(target.rect, point));
    if (!hit) {
      return;
    }
    if (hit.type === 'cell' && hit.index !== undefined) {
      this.controller.tapCell(hit.index);
    } else if (hit.type === 'continue') {
      this.controller.continueAfterWin();
    } else if (hit.type === 'retry') {
      this.controller.retryLevel();
    } else if (hit.type === 'hint') {
      this.controller.useHint();
    } else if (hit.type === 'tool' && hit.tool) {
      this.controller.selectTool(hit.tool);
    }
  }

  private eventToDesignPoint(event: PointerEvent | TouchEvent): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect?.() ?? { left: 0, top: 0 };
    const touch = 'touches' in event ? event.touches[0] ?? event.changedTouches[0] : null;
    const clientX = touch?.clientX ?? ('clientX' in event ? event.clientX : 0);
    const clientY = touch?.clientY ?? ('clientY' in event ? event.clientY : 0);
    return {
      x: (clientX - rect.left) / this.scale - this.offsetX,
      y: (clientY - rect.top) / this.scale - this.offsetY,
    };
  }

  private roundRect(x: number, y: number, width: number, height: number, radius: number, fill: string, stroke?: string): void {
    const r = Math.min(radius, width / 2, height / 2);
    this.ctx.beginPath();
    this.ctx.moveTo(x + r, y);
    this.ctx.lineTo(x + width - r, y);
    this.ctx.quadraticCurveTo(x + width, y, x + width, y + r);
    this.ctx.lineTo(x + width, y + height - r);
    this.ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    this.ctx.lineTo(x + r, y + height);
    this.ctx.quadraticCurveTo(x, y + height, x, y + height - r);
    this.ctx.lineTo(x, y + r);
    this.ctx.quadraticCurveTo(x, y, x + r, y);
    this.ctx.closePath();
    this.ctx.fillStyle = fill;
    this.ctx.fill();
    if (stroke) {
      this.ctx.strokeStyle = stroke;
      this.ctx.lineWidth = 2;
      this.ctx.stroke();
    }
  }

  private pill(x: number, y: number, width: number, height: number, label: string, fill: string): void {
    this.roundRect(x, y, width, height, height / 2, fill, 'rgba(16, 32, 51, 0.12)');
    this.text(label, x + width / 2, y + 31, 20, 800, theme.ink, 'center');
  }

  private text(text: string, x: number, y: number, size: number, weight: number, color: string, align: CanvasTextAlign): void {
    this.ctx.fillStyle = color;
    this.ctx.font = `${weight} ${size}px Avenir Next, Trebuchet MS, sans-serif`;
    this.ctx.textAlign = align;
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(text, x, y);
  }
}

function contains(rect: Rect, point: { x: number; y: number }): boolean {
  return point.x >= rect.x && point.y >= rect.y && point.x <= rect.x + rect.width && point.y <= rect.y + rect.height;
}
