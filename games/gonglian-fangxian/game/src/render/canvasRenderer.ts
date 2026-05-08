import type { GameController, AppAction, AppViewState } from '../app/controller';
import type { Board, BoardCell, BlockerKind, PieceKind, Position, SessionEvent } from '../core/types';
import { EffectsModel, type FloatingText, type Particle } from './effects';
import { coverRect, fitLogicalCanvas, LOGICAL_HEIGHT, LOGICAL_WIDTH, toLogicalPoint, type CanvasFit } from './scaler';
import { VisualBoardModel, type VisualTile } from './visualBoard';

interface HitArea {
  x: number;
  y: number;
  width: number;
  height: number;
  action: AppAction;
}

interface BoardPresentation {
  key: string;
  steps: Array<{ board: Board; durationMs: number }>;
  index: number;
  stepStartedMs: number;
}

const BOARD_CELL_SIZE = 86;
const BOARD_GAP = 8;
const BOARD_START_X = 57;
const BOARD_START_Y = 300;

const pieceColors: Record<PieceKind, string> = {
  shield: '#2f80ed',
  ammo: '#27ae60',
  radar: '#9b51e0',
  medal: '#f2c94c',
  wrench: '#eb5757',
};

const targetLabels: Record<PieceKind | BlockerKind, string> = {
  shield: '护盾',
  ammo: '弹药',
  radar: '雷达',
  medal: '勋章',
  wrench: '扳手',
  sandbag: '沙袋',
  brokenDefense: '破损防线',
};

export class CanvasRenderer {
  private readonly ctx: CanvasRenderingContext2D;
  private fit: CanvasFit = fitLogicalCanvas(LOGICAL_WIDTH, LOGICAL_HEIGHT);
  private hitAreas: HitArea[] = [];
  private readonly visualBoard = new VisualBoardModel({
    cellSize: BOARD_CELL_SIZE,
    gap: BOARD_GAP,
    startX: BOARD_START_X,
    startY: BOARD_START_Y,
  });
  private readonly effects = new EffectsModel(80, 2026);
  private handledCueId = 0;
  private pressedButton: { key: string; untilMs: number } | null = null;
  private lastFeedback: string | null = null;
  private feedbackSinceMs = 0;
  private lastScreen: string | null = null;
  private screenSinceMs = 0;
  private presentation: BoardPresentation | null = null;
  private handledPresentationKey: string | null = null;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly controller: GameController,
  ) {
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Canvas 2D context is unavailable');
    }
    this.ctx = ctx;
    if (typeof this.canvas.addEventListener === 'function') {
      this.canvas.addEventListener('pointerdown', (event) => {
        void this.handlePointer(event);
      });
    }
  }

  resize(width: number, height: number, dpr = window.devicePixelRatio || 1): void {
    this.fit = fitLogicalCanvas(width, height);
    this.canvas.width = Math.floor(width * dpr);
    this.canvas.height = Math.floor(height * dpr);
    if (this.canvas.style) {
      this.canvas.style.width = `${width}px`;
      this.canvas.style.height = `${height}px`;
    }
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  render(): void {
    const nowMs = performance.now();
    const view = this.controller.getViewState();
    this.trackViewTiming(view, nowMs);
    this.hitAreas = [];

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.drawViewportBackground(view, nowMs);

    this.ctx.save();
    this.ctx.translate(this.fit.offsetX, this.fit.offsetY);
    this.ctx.scale(this.fit.scale, this.fit.scale);
    this.drawBackground(view, nowMs);

    if (view.screen === 'menu') {
      this.drawMenu(view);
    } else if (view.screen === 'levels') {
      this.drawLevels(view);
    } else if (view.screen === 'playing' || view.screen === 'paused' || view.screen === 'won' || view.screen === 'lost') {
      this.drawGame(view, nowMs);
      if (view.screen === 'paused') {
        this.drawModal('暂停', nowMs, [
          ['继续', { type: 'resume' }],
          ['重玩', { type: 'retry' }],
          ['返回首页', { type: 'home' }],
        ]);
      }
      if (view.screen === 'won') {
        this.drawModal('胜利', nowMs, [
          ['下一关', { type: 'nextLevel' }],
          ['重玩', { type: 'retry' }],
          ['返回主菜单', { type: 'closeModal' }],
        ]);
      }
      if (view.screen === 'lost') {
        this.drawModal('失败', nowMs, [
          ['看广告加 5 步', { type: 'extraMovesAd' }],
          ['重玩', { type: 'retry' }],
          ['返回主菜单', { type: 'closeModal' }],
        ]);
      }
    } else if (view.screen === 'settings') {
      this.drawSettings(view);
    }

    if (view.feedback) {
      this.drawToast(view.feedback, nowMs);
    }

    this.ctx.restore();
  }

  private trackViewTiming(view: AppViewState, nowMs: number): void {
    if (this.lastScreen !== view.screen) {
      this.lastScreen = view.screen;
      this.screenSinceMs = nowMs;
    }
    if (this.lastFeedback !== view.feedback) {
      this.lastFeedback = view.feedback;
      this.feedbackSinceMs = nowMs;
    }
  }

  private async handlePointer(event: PointerEvent | MiniGamePointerEvent): Promise<void> {
    const clientPoint = readClientPoint(event);
    if (!clientPoint) {
      return;
    }

    const bounds = typeof this.canvas.getBoundingClientRect === 'function'
      ? this.canvas.getBoundingClientRect()
      : { left: 0, top: 0 };
    const point = toLogicalPoint(clientPoint.clientX - bounds.left, clientPoint.clientY - bounds.top, this.fit);
    const area = [...this.hitAreas].reverse().find((candidate) => point.x >= candidate.x && point.x <= candidate.x + candidate.width && point.y >= candidate.y && point.y <= candidate.y + candidate.height);
    if (area) {
      this.pressedButton = { key: actionKey(area.action), untilMs: performance.now() + 240 };
      await this.controller.dispatch(area.action);
      return;
    }

    const cell = this.cellAt(point.x, point.y);
    if (cell) {
      const nowMs = performance.now();
      if (this.visualBoard.isBusy(nowMs) || this.presentation) {
        return;
      }
      await this.controller.dispatch({ type: 'tapCell', position: cell });
    }
  }

  private drawViewportBackground(view: AppViewState, nowMs: number): void {
    const gradient = this.ctx.createLinearGradient(0, 0, 0, this.fit.viewportHeight);
    gradient.addColorStop(0, view.screen === 'menu' ? '#123526' : '#20384a');
    gradient.addColorStop(0.55, '#2d4d4e');
    gradient.addColorStop(1, '#16243a');
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, 0, this.fit.viewportWidth, this.fit.viewportHeight);

    this.ctx.fillStyle = 'rgba(255,255,255,0.022)';
    for (let x = 0; x < this.fit.viewportWidth; x += 64) {
      this.ctx.fillRect(x, 0, 1, this.fit.viewportHeight);
    }

    this.ctx.save();
    for (const particle of this.effects.backgroundParticles(this.fit.viewportWidth, this.fit.viewportHeight, nowMs, 24)) {
      this.ctx.globalAlpha = particle.alpha * 0.38;
      this.ctx.fillStyle = particle.color;
      this.ctx.beginPath();
      this.ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
      this.ctx.fill();
    }
    this.ctx.restore();
  }

  private drawBackground(view: AppViewState, nowMs: number): void {
    const rect = coverRect(900, 1600, LOGICAL_WIDTH, LOGICAL_HEIGHT);
    const gradient = this.ctx.createLinearGradient(0, rect.y, 0, rect.y + rect.height);
    gradient.addColorStop(0, view.screen === 'menu' ? '#123526' : '#20384a');
    gradient.addColorStop(0.55, '#2d4d4e');
    gradient.addColorStop(1, '#16243a');
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(rect.x, rect.y, rect.width, rect.height);

    this.ctx.fillStyle = 'rgba(255,255,255,0.032)';
    for (let x = -100; x < LOGICAL_WIDTH + 120; x += 120) {
      this.ctx.fillRect(x, 0, 2, LOGICAL_HEIGHT);
    }
    for (let y = -80; y < LOGICAL_HEIGHT + 120; y += 120) {
      this.ctx.fillRect(0, y, LOGICAL_WIDTH, 2);
    }

    this.drawParticles(this.effects.backgroundParticles(LOGICAL_WIDTH, LOGICAL_HEIGHT, nowMs, 18));
  }

  private drawMenu(view: AppViewState): void {
    this.drawTitle('共联防线', '调度资源，修复防线，守住前线');
    this.drawPanel(80, 260, 590, 780);
    this.drawButton(150, 330, 450, 78, '继续作战', { type: 'start' });
    this.drawButton(150, 436, 450, 78, '关卡选择', { type: 'openLevels' });
    this.drawButton(150, 542, 450, 78, '添加到桌面领奖', { type: 'desktopReward' });
    this.drawButton(150, 648, 450, 78, '添加到常用领奖', { type: 'favoriteReward' });
    this.drawButton(150, 754, 450, 78, '侧边栏入口奖励', { type: 'sidebarReward' });
    this.drawButton(150, 860, 450, 78, '设置', { type: 'openSettings' });
    this.drawSmallText(`金币 ${view.save.coins}  最高关卡 ${view.highestLevel}`, 375, 1000);
  }

  private drawLevels(view: AppViewState): void {
    this.drawTitle('关卡选择', '完成关卡可解锁下一关');
    this.drawPanel(62, 220, 626, 820);
    for (let index = 0; index < view.levelCount; index += 1) {
      const levelId = index + 1;
      const col = index % 2;
      const row = Math.floor(index / 2);
      const x = 110 + col * 280;
      const y = 270 + row * 125;
      const unlocked = levelId <= view.highestLevel;
      this.drawButton(x, y, 250, 82, unlocked ? `第 ${levelId} 关` : `第 ${levelId} 关 未解锁`, unlocked ? { type: 'selectLevel', levelId } : { type: 'openLevels' });
    }
    this.drawButton(190, 920, 370, 78, '返回', { type: 'closeModal' });
  }

  private drawGame(view: AppViewState, nowMs: number): void {
    const session = view.session;
    if (!session) {
      this.drawMenu(view);
      return;
    }

    this.drawPanel(36, 36, 678, 180);
    this.drawText(`第 ${session.levelId} 关`, 70, 92, 34, '#ffffff', 'left');
    this.drawText(`步数 ${session.movesLeft}`, 70, 146, 30, '#fef3c7', 'left');
    this.drawText(`金币 ${view.save.coins}`, 430, 92, 28, '#ffffff', 'left');
    this.drawButton(570, 130, 110, 54, '暂停', { type: 'pause' });
    this.drawTargets(session);
    this.handleVisualCue(view, nowMs);
    this.drawBoard(session, nowMs);
    this.drawEffects(nowMs);
    this.drawPowerUpButton(60, 1148, 190, 70, '炸开', view.save.items.bomb, view.activePowerUp === 'bomb', { type: 'usePowerUp', item: 'bomb' });
    this.drawPowerUpButton(280, 1148, 190, 70, '吸走', view.save.items.suck, view.activePowerUp === 'suck', { type: 'usePowerUp', item: 'suck' });
    this.drawPowerUpButton(500, 1148, 190, 70, '重排', view.save.items.shuffle, false, { type: 'usePowerUp', item: 'shuffle' });
  }

  private drawSettings(view: AppViewState): void {
    this.drawTitle('设置', '音频开关会保存到本地');
    this.drawPanel(100, 300, 550, 500);
    this.drawButton(160, 380, 430, 86, `音效：${view.save.soundEnabled ? '开' : '关'}`, { type: 'toggleSound' });
    this.drawButton(160, 500, 430, 86, `音乐：${view.save.musicEnabled ? '开' : '关'}`, { type: 'toggleMusic' });
    this.drawButton(160, 620, 430, 86, '返回', { type: 'closeModal' });
  }

  private drawTargets(session: AppViewState['session']): void {
    if (!session) return;
    const text = session.targets
      .map((target) => `${targetLabels[target.kind]} ${(session.targetProgress[target.kind] ?? 0)}/${target.count}`)
      .join('  ');
    this.drawText(text, 375, 198, 24, '#d1fae5', 'center');
  }

  private drawBoard(session: NonNullable<AppViewState['session']>, nowMs: number): void {
    const board = this.presentedBoard(session, nowMs);
    this.drawPanel(34, 276, 682, 682);

    for (let row = 0; row < board.length; row += 1) {
      for (let col = 0; col < board[row].length; col += 1) {
        const x = BOARD_START_X + col * (BOARD_CELL_SIZE + BOARD_GAP);
        const y = BOARD_START_Y + row * (BOARD_CELL_SIZE + BOARD_GAP);
        const selected = session.selectedCell?.row === row && session.selectedCell.col === col;
        this.drawCellSlot(x, y, BOARD_CELL_SIZE, selected, nowMs);
      }
    }

    const changes = this.visualBoard.sync(board, nowMs);
    for (const tile of changes.removed) {
      this.effects.burst(tile.x + BOARD_CELL_SIZE / 2, tile.y + BOARD_CELL_SIZE / 2, colorForCell(tile.cell), nowMs, 7);
    }
    if (changes.removed.length >= 4) {
      const center = averageTiles(changes.removed);
      this.effects.floatText(`${changes.removed.length} 连消`, center.x, center.y, '#ffd166', nowMs);
    }

    for (const tile of this.visualBoard.tilesAt(nowMs)) {
      this.drawVisualTile(tile, BOARD_CELL_SIZE, session.selectedCell);
    }
  }

  private presentedBoard(session: NonNullable<AppViewState['session']>, nowMs: number): Board {
    const steps = presentationSteps(session.lastEvents, session.board);
    if (steps.length === 0) {
      this.presentation = null;
      return session.board;
    }

    const key = presentationKey(session.lastEvents, session.board);
    if (this.presentation?.key !== key && this.handledPresentationKey !== key) {
      this.presentation = {
        key,
        steps,
        index: 0,
        stepStartedMs: nowMs,
      };
    }

    const presentation = this.presentation;
    if (!presentation || presentation.key !== key) {
      return session.board;
    }

    while (
      presentation.index < presentation.steps.length - 1 &&
      nowMs - presentation.stepStartedMs >= presentation.steps[presentation.index].durationMs
    ) {
      presentation.stepStartedMs += presentation.steps[presentation.index].durationMs;
      presentation.index += 1;
    }

    const currentStep = presentation.steps[presentation.index];
    if (presentation.index === presentation.steps.length - 1 && nowMs - presentation.stepStartedMs >= currentStep.durationMs) {
      this.handledPresentationKey = key;
      this.presentation = null;
      return session.board;
    }

    return currentStep.board;
  }

  private drawCellSlot(x: number, y: number, size: number, selected: boolean, nowMs: number): void {
    const pulse = selected ? 0.5 + Math.sin(nowMs / 120) * 0.5 : 0;
    this.ctx.fillStyle = selected ? `rgba(254,243,199,${0.88 + pulse * 0.08})` : 'rgba(255,255,255,0.12)';
    roundRect(this.ctx, x, y, size, size, 8);
    this.ctx.fill();
    this.ctx.strokeStyle = selected ? '#f59e0b' : 'rgba(255,255,255,0.18)';
    this.ctx.lineWidth = selected ? 5 : 2;
    this.ctx.stroke();
  }

  private drawVisualTile(tile: VisualTile, size: number, selectedCell: Position | null): void {
    const selected = selectedCell?.row === tile.row && selectedCell.col === tile.col;

    this.ctx.save();
    this.ctx.globalAlpha = tile.alpha;
    this.ctx.translate(tile.x + size / 2, tile.y + size / 2);
    this.ctx.scale(tile.scale * (selected ? 1.05 : 1), tile.scale * (selected ? 1.05 : 1));
    this.ctx.translate(-size / 2, -size / 2);

    if (tile.cell.kind === 'blocker') {
      const color = tile.cell.blockerKind === 'sandbag' ? '#9b6a3a' : '#6b7280';
      drawGlowBox(this.ctx, 4, 4, size - 8, size - 8, color);
      this.ctx.fillStyle = color;
      roundRect(this.ctx, 15, 18, size - 30, size - 36, 8);
      this.ctx.fill();
      this.drawText(tile.cell.blockerKind === 'sandbag' ? '沙' : '损', size / 2, size / 2 + 10, 32, '#ffffff', 'center');
      this.ctx.restore();
      return;
    }

    if (tile.cell.kind === 'normal' || tile.cell.kind === 'special') {
      const color = pieceColors[tile.cell.pieceKind];
      drawGlowBox(this.ctx, 4, 4, size - 8, size - 8, color);
      this.ctx.strokeStyle = 'rgba(255,255,255,0.52)';
      this.ctx.lineWidth = 1.4;
      roundRect(this.ctx, 12, 12, size - 24, size - 24, 8);
      this.ctx.stroke();
      this.ctx.fillStyle = color;
      this.ctx.beginPath();
      this.ctx.arc(size / 2, size / 2, 28, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.fillStyle = 'rgba(255,255,255,0.22)';
      this.ctx.beginPath();
      this.ctx.ellipse(size / 2 - 8, size / 2 - 10, 15, 8, -0.4, 0, Math.PI * 2);
      this.ctx.fill();
      this.drawPieceIcon(tile.cell.pieceKind, size / 2, size / 2, color);
      if (tile.cell.kind === 'special') {
        this.drawText(tile.cell.specialKind === 'areaBomb' ? '爆' : tile.cell.specialKind === 'horizontalRocket' ? '横' : '竖', size / 2, size - 16, 18, '#ffffff', 'center');
      }
    }

    this.ctx.restore();
  }

  private cellAt(x: number, y: number): Position | null {
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

  private drawModal(title: string, nowMs: number, buttons: Array<[string, AppAction]>): void {
    const progress = Math.min(1, (nowMs - this.screenSinceMs) / 220);
    const scale = 0.88 + progress * 0.12;
    this.ctx.fillStyle = 'rgba(0,0,0,0.55)';
    this.ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
    this.ctx.save();
    this.ctx.translate(375, 585);
    this.ctx.scale(scale, scale);
    this.ctx.translate(-375, -585);
    this.drawPanel(105, 350, 540, 470);
    this.drawText(title, 375, 430, 56, '#ffffff', 'center');
    buttons.forEach(([label, action], index) => {
      if (action.type === 'extraMovesAd') {
        this.drawAdButton(175, 500 + index * 100, 400, 74, label, action);
      } else {
        this.drawButton(175, 500 + index * 100, 400, 74, label, action);
      }
    });
    this.ctx.restore();
  }

  private drawTitle(title: string, subtitle: string): void {
    this.drawText(title, 375, 126, 72, '#ffffff', 'center');
    this.drawText(subtitle, 375, 184, 28, '#d1fae5', 'center');
  }

  private drawButton(x: number, y: number, width: number, height: number, label: string, action: AppAction): void {
    this.drawButtonBase(x, y, width, height, action, () => {
      this.drawText(label, x + width / 2, y + height / 2, 26, '#111827', 'center');
    });
  }

  private drawPowerUpButton(x: number, y: number, width: number, height: number, name: string, count: number, active: boolean, action: AppAction): void {
    if (count > 0) {
      this.drawButton(x, y, width, height, `${active ? '>' : ''}${name} ${count}`, action);
      return;
    }

    this.drawAdButton(x, y, width, height, `${active ? '>' : ''}看广告${name}`, action);
  }

  private drawAdButton(x: number, y: number, width: number, height: number, label: string, action: AppAction): void {
    this.drawButtonBase(x, y, width, height, action, () => {
      const iconHeight = nearestMultipleOfFour(height * 0.4);
      const iconWidth = iconHeight * (38 / 28);
      const iconX = x + width * 0.12;
      const iconY = y + (height - iconHeight) / 2;
      this.drawAdVideoIcon(iconX, iconY, iconWidth, iconHeight, '#111827');
      this.drawText(label, iconX + iconWidth + 14, y + height / 2, 22, '#111827', 'left');
    });
  }

  private drawButtonBase(x: number, y: number, width: number, height: number, action: AppAction, drawContent: () => void): void {
    const key = actionKey(action);
    const pressed = this.pressedButton?.key === key && this.pressedButton.untilMs > performance.now();

    this.ctx.save();
    if (pressed) {
      this.ctx.translate(x + width / 2, y + height / 2);
      this.ctx.scale(0.96, 0.96);
      this.ctx.translate(-(x + width / 2), -(y + height / 2));
    }
    this.ctx.fillStyle = '#f8fafc';
    roundRect(this.ctx, x, y, width, height, 8);
    this.ctx.fill();
    this.ctx.strokeStyle = '#111827';
    this.ctx.lineWidth = 3;
    this.ctx.stroke();
    drawContent();
    this.ctx.restore();

    this.hitAreas.push({ x, y, width, height, action });
  }

  private drawAdVideoIcon(x: number, y: number, width: number, height: number, color: string): void {
    const py = (value: number) => 28 - value;
    this.ctx.save();
    this.ctx.translate(x, y);
    this.ctx.scale(width / 38, height / 28);

    // Official Douyin rewarded-video icon material is a 38x28 vector.
    this.ctx.fillStyle = color;
    this.ctx.beginPath();
    this.ctx.moveTo(0, py(22.790697));
    this.ctx.bezierCurveTo(0, py(25.667715), 2.306872, py(28), 5.152542, py(28));
    this.ctx.lineTo(25.118643, py(28));
    this.ctx.bezierCurveTo(27.964314, py(28), 30.271185, py(25.667715), 30.271185, py(22.790697));
    this.ctx.lineTo(30.271185, py(21.971283));
    this.ctx.bezierCurveTo(30.271185, py(21.510889), 30.735935, py(21.195894), 31.163574, py(21.366449));
    this.ctx.lineTo(34.478329, py(22.688473));
    this.ctx.bezierCurveTo(36.168919, py(23.362732), 38, py(22.102938), 38, py(20.265535));
    this.ctx.lineTo(38, py(7.788822));
    this.ctx.bezierCurveTo(38, py(5.936855), 36.142109, py(4.676512), 34.447056, py(5.378595));
    this.ctx.lineTo(31.17153, py(6.73531));
    this.ctx.bezierCurveTo(30.742785, py(6.912895), 30.271185, py(6.597778), 30.271185, py(6.133711));
    this.ctx.lineTo(30.271185, py(5.209301));
    this.ctx.bezierCurveTo(30.271185, py(2.332283), 27.964314, py(0), 25.118643, py(0));
    this.ctx.lineTo(5.152542, py(0));
    this.ctx.bezierCurveTo(2.306871, py(0), 0, py(2.332283), 0, py(5.209301));
    this.ctx.lineTo(0, py(22.790697));
    this.ctx.closePath();
    this.ctx.fill();

    this.ctx.fillStyle = '#f8fafc';
    this.ctx.beginPath();
    this.ctx.moveTo(20.621685, py(11.820709));
    this.ctx.bezierCurveTo(22.204817, py(12.847475), 22.204819, py(15.164505), 20.621687, py(16.191273));
    this.ctx.lineTo(14.970669, py(19.856339));
    this.ctx.bezierCurveTo(13.237776, py(20.980234), 10.948714, py(19.736496), 10.948714, py(17.671053));
    this.ctx.lineTo(10.948714, py(10.340927));
    this.ctx.bezierCurveTo(10.948714, py(8.275482), 13.237773, py(7.031748), 14.970665, py(8.155643));
    this.ctx.lineTo(20.621685, py(11.820709));
    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.restore();
  }

  private drawPanel(x: number, y: number, width: number, height: number): void {
    this.ctx.fillStyle = 'rgba(15,23,42,0.72)';
    roundRect(this.ctx, x, y, width, height, 8);
    this.ctx.fill();
    this.ctx.strokeStyle = 'rgba(255,255,255,0.56)';
    this.ctx.lineWidth = 2;
    this.ctx.stroke();
  }

  private drawToast(message: string, nowMs: number): void {
    const progress = Math.min(1, (nowMs - this.feedbackSinceMs) / 180);
    const y = 1040 - (1 - progress) * 24;
    this.ctx.save();
    this.ctx.globalAlpha = progress;
    this.ctx.fillStyle = 'rgba(17,24,39,0.94)';
    roundRect(this.ctx, 70, y, 610, 76, 8);
    this.ctx.fill();
    this.ctx.strokeStyle = '#ffffff';
    this.ctx.lineWidth = 2;
    this.ctx.stroke();
    this.drawText(message, 375, y + 48, 24, '#ffffff', 'center');
    this.ctx.restore();
  }

  private handleVisualCue(view: AppViewState, nowMs: number): void {
    const cue = view.visualCue;
    if (!cue || cue.id === this.handledCueId) {
      return;
    }

    this.handledCueId = cue.id;
    if (cue.type === 'combo') {
      this.effects.floatText(cue.combo >= 5 ? `超级连击 x${cue.combo}` : `连击 x${cue.combo}`, 375, 275, '#ffd166', nowMs);
      return;
    }

    const from = this.visualBoard.cellCenter(cue.from.row, cue.from.col);
    const to = this.visualBoard.cellCenter(cue.to.row, cue.to.col);
    this.effects.floatText('未形成消除', (from.x + to.x) / 2 + 43, (from.y + to.y) / 2 + 43, '#ffd166', nowMs);
    this.effects.burst(from.x + 43, from.y + 43, '#ffd166', nowMs, 4);
    this.effects.burst(to.x + 43, to.y + 43, '#ffd166', nowMs, 4);
  }

  private drawEffects(nowMs: number): void {
    this.drawParticles(this.effects.particlesAt(nowMs));
    for (const text of this.effects.textsAt(nowMs)) {
      this.drawFloatingText(text);
    }
  }

  private drawParticles(particles: Particle[]): void {
    this.ctx.save();
    for (const particle of particles) {
      this.ctx.globalAlpha = particle.alpha;
      this.ctx.fillStyle = particle.color;
      this.ctx.beginPath();
      this.ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
      this.ctx.fill();
    }
    this.ctx.restore();
  }

  private drawFloatingText(text: FloatingText): void {
    this.ctx.save();
    this.ctx.globalAlpha = text.alpha;
    this.ctx.translate(text.x, text.y);
    this.ctx.scale(text.scale, text.scale);
    this.drawText(text.text, 0, 0, 34, text.color, 'center');
    this.ctx.restore();
  }

  private drawPieceIcon(kind: PieceKind, cx: number, cy: number, color: string): void {
    this.ctx.strokeStyle = '#ffffff';
    this.ctx.fillStyle = withAlpha(color, 0.45);
    this.ctx.lineWidth = 3;
    const s = 18;

    if (kind === 'shield') {
      this.ctx.beginPath();
      this.ctx.moveTo(cx, cy - s);
      this.ctx.lineTo(cx + s * 0.8, cy - s * 0.45);
      this.ctx.lineTo(cx + s * 0.55, cy + s * 0.85);
      this.ctx.lineTo(cx, cy + s);
      this.ctx.lineTo(cx - s * 0.55, cy + s * 0.85);
      this.ctx.lineTo(cx - s * 0.8, cy - s * 0.45);
      this.ctx.closePath();
      this.ctx.fill();
      this.ctx.stroke();
    } else if (kind === 'ammo') {
      roundRect(this.ctx, cx - s * 0.65, cy - s * 0.8, s * 1.3, s * 1.6, 4);
      this.ctx.fill();
      this.ctx.stroke();
    } else if (kind === 'radar') {
      this.ctx.beginPath();
      this.ctx.arc(cx, cy, s, 0, Math.PI * 2);
      this.ctx.stroke();
      this.ctx.beginPath();
      this.ctx.arc(cx, cy, s * 0.45, 0, Math.PI * 2);
      this.ctx.stroke();
      this.ctx.beginPath();
      this.ctx.moveTo(cx, cy);
      this.ctx.lineTo(cx + s * 0.9, cy - s * 0.45);
      this.ctx.stroke();
    } else if (kind === 'medal') {
      drawStar(this.ctx, cx, cy, s);
      this.ctx.fill();
      this.ctx.stroke();
    } else {
      this.ctx.beginPath();
      this.ctx.moveTo(cx - s * 0.8, cy + s * 0.7);
      this.ctx.lineTo(cx + s * 0.55, cy - s * 0.65);
      this.ctx.stroke();
      this.ctx.beginPath();
      this.ctx.arc(cx + s * 0.62, cy - s * 0.72, s * 0.34, 0, Math.PI * 2);
      this.ctx.stroke();
    }
  }

  private drawSmallText(text: string, x: number, y: number): void {
    this.drawText(text, x, y, 26, '#f8fafc', 'center');
  }

  private drawText(text: string, x: number, y: number, size: number, color: string, align: CanvasTextAlign): void {
    this.ctx.fillStyle = color;
    this.ctx.font = `700 ${size}px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
    this.ctx.textAlign = align;
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(text, x, y);
  }
}

interface MiniGamePointerEvent {
  clientX?: number;
  clientY?: number;
  touches?: MiniGameTouchPoint[];
  changedTouches?: MiniGameTouchPoint[];
}

interface MiniGameTouchPoint {
  clientX?: number;
  clientY?: number;
  x?: number;
  y?: number;
}

function readClientPoint(event: PointerEvent | MiniGamePointerEvent): { clientX: number; clientY: number } | null {
  if (typeof event.clientX === 'number' && typeof event.clientY === 'number') {
    return { clientX: event.clientX, clientY: event.clientY };
  }

  const miniGameEvent = event as MiniGamePointerEvent;
  const touch = miniGameEvent.touches?.[0] ?? miniGameEvent.changedTouches?.[0];
  if (touch) {
    if (typeof touch.clientX === 'number' && typeof touch.clientY === 'number') {
      return { clientX: touch.clientX, clientY: touch.clientY };
    }
    if (typeof touch.x === 'number' && typeof touch.y === 'number') {
      return { clientX: touch.x, clientY: touch.y };
    }
  }

  return null;
}

function actionKey(action: AppAction): string {
  return JSON.stringify(action);
}

function presentationSteps(events: SessionEvent[], finalBoard: Board): Array<{ board: Board; durationMs: number }> {
  const steps = events
    .filter((event): event is SessionEvent & { board: Board } => Boolean(event.board))
    .map((event) => ({
      board: event.board,
      durationMs: event.phaseDurationMs ?? defaultPhaseDuration(event.type),
    }));

  if (steps.length > 0 && boardSignature(steps[steps.length - 1].board) !== boardSignature(finalBoard)) {
    steps.push({ board: finalBoard, durationMs: 420 });
  }

  return steps;
}

function defaultPhaseDuration(type: SessionEvent['type']): number {
  if (type === 'swap') return 520;
  if (type === 'clear') return 680;
  if (type === 'fall') return 620;
  if (type === 'refill') return 720;
  return 420;
}

function presentationKey(events: SessionEvent[], finalBoard: Board): string {
  const eventPart = events
    .map((event) => `${event.type}:${event.kind ?? ''}:${event.count ?? ''}:${event.cells?.map((cell) => `${cell.row},${cell.col}`).join('|') ?? ''}`)
    .join(';');
  return `${eventPart}#${boardSignature(finalBoard)}`;
}

function boardSignature(board: Board): string {
  return board
    .map((row) =>
      row
        .map((cell) => {
          if (cell.kind === 'empty') return 'empty';
          if (cell.kind === 'blocker') return `${cell.blockerKind}:${cell.durability}`;
          if (cell.kind === 'special') return `${cell.id}:${cell.pieceKind}:${cell.specialKind}`;
          return `${cell.id}:${cell.pieceKind}`;
        })
        .join(','),
    )
    .join('/');
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

function nearestMultipleOfFour(value: number): number {
  return Math.max(4, Math.round(value / 4) * 4);
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

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number): void {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}
