/**
 * 消除分步播放队列（PresentationDirector）。
 *
 * 背景：controller.applyMove 一次性把 swap + 多步连消 + 下落 + 补齐 都跑完，
 * session.board 是最终状态，session.lastEvents 是分步事件流。
 * 直接 sync 最终 board 会让所有消除合并成一帧 burst，连消节奏感丢失。
 *
 * 这个 director 把 lastEvents 拆成中间 board 快照按时间序逐步喂给 visualBoard.sync，
 * 让每一组消除有独立的 burst/floatText/震动节奏。
 *
 * 用法：
 *   const board = director.boardFor(session, nowMs);    // 拿当前应显示的 board
 *   const changes = visualBoard.sync(board, nowMs);     // 仅 diff 与上一次 sync 的差异
 *   // changes.removed 就是当前 step 新增的消除 —— 触发 burst
 *
 * key 不变时持续推进 step；key 变了重置 presentation。
 */

import type { GameSession, SessionEvent, Board, BoardCell } from '../../core/types';

export interface PresentationStep {
  type: SessionEvent['type'];
  eventIndex: number;
  board: Board;
  durationMs: number;
  /** 当前 step 是消除型（'clear'）—— 让消费方判断要不要 emit screenshake. */
  isClear: boolean;
}

interface PresentationState {
  key: string;
  steps: PresentationStep[];
  index: number;
  stepStartedMs: number;
}

export class PresentationDirector {
  private state: PresentationState | null = null;
  private handledKey: string | null = null;
  /** 上一帧消费过的 step index（key + index）—— 消费方据此判断是否新进入一个 step. */
  private lastEmittedStepKey: string | null = null;

  /**
   * 返回当前应显示的中间 board。
   * - 若 lastEvents 为空 / 全无 board snapshot：直接返回 session.board
   * - 若分步队列已跑完：返回 session.board 并清空 state
   * - 否则返回当前 step 的 board
   */
  boardFor(session: GameSession, nowMs: number): Board {
    const steps = buildSteps(session.lastEvents, session.board);
    if (steps.length === 0) {
      this.state = null;
      return session.board;
    }

    const key = buildKey(session.lastEvents, session.board);
    if (this.state?.key !== key && this.handledKey !== key) {
      this.state = { key, steps, index: 0, stepStartedMs: nowMs };
    }

    const presentation = this.state;
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
      this.handledKey = key;
      this.state = null;
      return session.board;
    }

    return currentStep.board;
  }

  /**
   * 判断本帧是否新进入了一个 clear step（让外部触发 screenshake）。
   * 每个 (key, index) 只返回 true 一次。
   */
  consumeClearStepEntered(): boolean {
    if (!this.state) return false;
    const stepKey = `${this.state.key}:${this.state.index}`;
    if (this.lastEmittedStepKey === stepKey) return false;
    this.lastEmittedStepKey = stepKey;
    return this.state.steps[this.state.index]?.isClear ?? false;
  }

  /** 进入新关卡时清空，避免上一关的 presentation 状态被新关卡读到。 */
  reset(): void {
    this.state = null;
    this.handledKey = null;
    this.lastEmittedStepKey = null;
  }
}

// ─────────────────────────────────────────────────────────────────────────
// helpers (从 canvasRenderer.ts 搬过来，保持算法一致)
// ─────────────────────────────────────────────────────────────────────────

function buildSteps(events: SessionEvent[], finalBoard: Board): PresentationStep[] {
  const steps: PresentationStep[] = [];
  for (let eventIndex = 0; eventIndex < events.length; eventIndex += 1) {
    const event = events[eventIndex];
    if (!event.board) continue;
    steps.push({
      type: event.type,
      eventIndex,
      board: event.board,
      durationMs: event.phaseDurationMs ?? defaultPhaseDuration(event.type),
      isClear: event.type === 'clear',
    });
  }

  if (steps.length > 0 && boardSignature(steps[steps.length - 1].board) !== boardSignature(finalBoard)) {
    steps.push({ type: 'refill', eventIndex: -1, board: finalBoard, durationMs: 280, isClear: false });
  }

  return steps;
}

function defaultPhaseDuration(type: SessionEvent['type']): number {
  if (type === 'swap') return 360;
  if (type === 'clear') return 460;
  if (type === 'fall') return 420;
  if (type === 'refill') return 480;
  return 280;
}

function buildKey(events: SessionEvent[], finalBoard: Board): string {
  const eventPart = events
    .map((event) => `${event.type}:${event.kind ?? ''}:${event.count ?? ''}:${event.cells?.map((c) => `${c.row},${c.col}`).join('|') ?? ''}`)
    .join(';');
  return `${eventPart}#${boardSignature(finalBoard)}`;
}

function boardSignature(board: Board): string {
  return board
    .map((row) =>
      row
        .map((cell: BoardCell) => {
          if (cell.kind === 'empty') return 'empty';
          if (cell.kind === 'blocker') return `${cell.blockerKind}:${cell.durability}`;
          if (cell.kind === 'special') return `${cell.id}:${cell.pieceKind}:${cell.specialKind}`;
          return `${cell.id}:${cell.pieceKind}`;
        })
        .join(','),
    )
    .join('/');
}
