export type PieceKind = 'shield' | 'ammo' | 'radar' | 'medal' | 'wrench';

export type SpecialKind = 'horizontalRocket' | 'verticalFlare' | 'areaBomb';

export type BlockerKind = 'sandbag' | 'brokenDefense';

export type PowerUpType = 'bomb' | 'suck' | 'shuffle';

export interface Position {
  row: number;
  col: number;
}

export interface EmptyCell {
  kind: 'empty';
}

export interface NormalPieceCell {
  kind: 'normal';
  pieceKind: PieceKind;
  id: string;
}

export interface SpecialPieceCell {
  kind: 'special';
  pieceKind: PieceKind;
  specialKind: SpecialKind;
  id: string;
}

export interface BlockerCell {
  kind: 'blocker';
  blockerKind: BlockerKind;
  durability: number;
}

export type BoardCell = EmptyCell | NormalPieceCell | SpecialPieceCell | BlockerCell;

export type Board = BoardCell[][];

export type MatchDirection = 'h' | 'v' | 'both';

export type MatchShape = '3-match' | '4-match' | '5-match' | 'L-shape' | 'T-shape' | 'cross';

export interface Match {
  kind: PieceKind;
  cells: Position[];
  direction: MatchDirection;
  length: number;
}

export interface MatchAnalysis {
  cells: Position[];
  shape: MatchShape;
  maxRun: number;
  shapeBonus: number;
}

export interface TargetConfig {
  type: 'collect' | 'clearBlocker';
  kind: PieceKind | BlockerKind;
  count: number;
}

export interface LevelConfig {
  id: number;
  moves: number;
  width: number;
  height: number;
  piecePool: PieceKind[];
  targets: TargetConfig[];
  blockers: Array<Position & { blockerKind: BlockerKind; durability: number }>;
  rewards: {
    coins: number;
  };
}

export type SessionStatus = 'playing' | 'paused' | 'won' | 'lost' | 'settling';

export interface SessionEvent {
  type: 'swap' | 'match' | 'clear' | 'fall' | 'refill' | 'shuffle' | 'win' | 'lose';
  cells?: Position[];
  kind?: PieceKind | BlockerKind;
  count?: number;
  board?: Board;
  phaseDurationMs?: number;
}

export interface GameSession {
  levelId: number;
  board: Board;
  movesLeft: number;
  targetProgress: Record<string, number>;
  targets: TargetConfig[];
  selectedCell: Position | null;
  comboCount: number;
  status: SessionStatus;
  lastEvents: SessionEvent[];
  piecePool: PieceKind[];
}
