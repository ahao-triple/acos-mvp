import type {
  Board,
  BoardCell,
  BlockerKind,
  Match,
  MatchAnalysis,
  MatchDirection,
  PieceKind,
  Position,
  SpecialPieceCell,
} from './types';

const ADJACENT_STEPS = [
  { row: -1, col: 0 },
  { row: 1, col: 0 },
  { row: 0, col: -1 },
  { row: 0, col: 1 },
];

export function createBoard(piecePool: PieceKind[], width = 7, height = 7, seed = Date.now()): Board {
  if (piecePool.length < 3) {
    throw new Error('Piece pool must contain at least three kinds');
  }

  for (let attempt = 0; attempt < 40; attempt += 1) {
    const board = generateBoard(piecePool, width, height, seed + attempt * 9973);
    if (findMatches(board).length === 0 && hasValidMoves(board)) {
      return board;
    }
  }

  return generateBoard(piecePool, width, height, seed + 40 * 9973);
}

export function findMatches(board: Board): Match[] {
  const rows = board.length;
  const cols = board[0]?.length ?? 0;
  const visited: boolean[][] = Array.from({ length: rows }, () => new Array(cols).fill(false));
  const matches: Match[] = [];

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const startKind = getMatchableKind(board[row]?.[col]);
      if (!startKind || visited[row][col]) {
        continue;
      }

      const cells: Position[] = [];
      const queue: Position[] = [{ row, col }];
      visited[row][col] = true;

      while (queue.length > 0) {
        const current = queue.shift();
        if (!current) {
          break;
        }

        cells.push(current);

        for (const step of ADJACENT_STEPS) {
          const next = { row: current.row + step.row, col: current.col + step.col };
          if (!isInside(board, next) || visited[next.row][next.col] || getMatchableKind(board[next.row][next.col]) !== startKind) {
            continue;
          }

          visited[next.row][next.col] = true;
          queue.push(next);
        }
      }

      if (cells.length >= 3) {
        matches.push({
          kind: startKind,
          cells,
          direction: classifyDirection(cells),
          length: longestRun(cells),
        });
      }
    }
  }

  return matches;
}

export function analyseMatches(matches: Match[]): MatchAnalysis {
  const cells = uniquePositions(matches);
  const maxRun = Math.max(...matches.map((match) => match.length), 0);
  const hasHorizontal = matches.some((match) => match.direction === 'h' || match.direction === 'both');
  const hasVertical = matches.some((match) => match.direction === 'v' || match.direction === 'both');

  let shape: MatchAnalysis['shape'] = '3-match';
  let shapeBonus = 1;

  if (hasHorizontal && hasVertical) {
    if (cells.length >= 9) {
      shape = 'cross';
      shapeBonus = 2.5;
    } else if (cells.length >= 7) {
      shape = 'T-shape';
      shapeBonus = 2;
    } else {
      shape = 'L-shape';
      shapeBonus = 1.8;
    }
  } else if (maxRun >= 5) {
    shape = '5-match';
    shapeBonus = 2;
  } else if (maxRun >= 4) {
    shape = '4-match';
    shapeBonus = 1.5;
  }

  return { cells, shape, maxRun, shapeBonus };
}

export function hasValidMoves(board: Board): boolean {
  for (let row = 0; row < board.length; row += 1) {
    for (let col = 0; col < (board[row]?.length ?? 0); col += 1) {
      const current = { row, col };
      for (const step of [
        { row: 0, col: 1 },
        { row: 1, col: 0 },
      ]) {
        const next = { row: row + step.row, col: col + step.col };
        if (!isInside(board, next) || !isSwappable(board[current.row][current.col]) || !isSwappable(board[next.row][next.col])) {
          continue;
        }

        if (findMatches(swapCells(board, current, next)).length > 0) {
          return true;
        }
      }
    }
  }

  return false;
}

export function areAdjacent(a: Position, b: Position): boolean {
  return Math.abs(a.row - b.row) + Math.abs(a.col - b.col) === 1;
}

export function swapCells(board: Board, a: Position, b: Position): Board {
  if (!areAdjacent(a, b)) {
    throw new Error('Cells must be adjacent');
  }

  const next = cloneBoard(board);
  const temp = next[a.row][a.col];
  next[a.row][a.col] = next[b.row][b.col];
  next[b.row][b.col] = temp;
  return next;
}

export function applyGravity(board: Board): Board {
  const next = cloneBoard(board);
  const height = next.length;
  const width = next[0]?.length ?? 0;

  for (let col = 0; col < width; col += 1) {
    const movable: BoardCell[] = [];

    for (let row = height - 1; row >= 0; row -= 1) {
      const cell = next[row][col];
      if (isSwappable(cell)) {
        movable.push(cell);
      }
    }

    for (let row = height - 1; row >= 0; row -= 1) {
      const cell = next[row][col];
      if (cell.kind === 'blocker') {
        continue;
      }
      next[row][col] = movable.shift() ?? { kind: 'empty' };
    }
  }

  return next;
}

export function refillBoard(board: Board, piecePool: PieceKind[], seed = Date.now()): Board {
  const random = createSeededRandom(seed);
  const next = cloneBoard(board);

  for (let row = 0; row < next.length; row += 1) {
    for (let col = 0; col < next[row].length; col += 1) {
      if (next[row][col].kind !== 'empty') {
        continue;
      }

      const kind = pickSafeKind(next, row, col, piecePool, random);
      next[row][col] = createPiece(kind, `refill-${row}-${col}-${kind}-${nextPieceSerial()}`);
    }
  }

  return next;
}

export function clearCells(board: Board, cells: Position[]): Board {
  const next = cloneBoard(board);

  for (const cell of cells) {
    if (next[cell.row]?.[cell.col]?.kind !== 'blocker') {
      next[cell.row][cell.col] = { kind: 'empty' };
    }
  }

  return next;
}

export function damageAdjacentBlockers(board: Board, clearedCells: Position[]): {
  board: Board;
  clearedBlockers: Partial<Record<BlockerKind, number>>;
} {
  const next = cloneBoard(board);
  const clearedBlockers: Partial<Record<BlockerKind, number>> = {};
  const damaged = new Set<string>();

  for (const cell of clearedCells) {
    for (const adjacent of adjacentPositions(cell)) {
      const key = `${adjacent.row}:${adjacent.col}`;
      const blocker = next[adjacent.row]?.[adjacent.col];
      if (damaged.has(key) || blocker?.kind !== 'blocker') {
        continue;
      }

      damaged.add(key);
      const durability = blocker.durability - 1;
      if (durability <= 0) {
        clearedBlockers[blocker.blockerKind] = (clearedBlockers[blocker.blockerKind] ?? 0) + 1;
        next[adjacent.row][adjacent.col] = { kind: 'empty' };
      } else {
        next[adjacent.row][adjacent.col] = { ...blocker, durability };
      }
    }
  }

  return { board: next, clearedBlockers };
}

export function createSpecialForMatch(_match: Match): SpecialPieceCell | null {
  return null;
}

export function uniquePositions(matches: Match[]): Position[] {
  const seen = new Set<string>();
  const positions: Position[] = [];

  for (const match of matches) {
    for (const cell of match.cells) {
      const key = `${cell.row}:${cell.col}`;
      if (!seen.has(key)) {
        seen.add(key);
        positions.push(cell);
      }
    }
  }

  return positions;
}

export function createPiece(pieceKind: PieceKind, id: string): BoardCell {
  return { kind: 'normal', pieceKind, id };
}

function generateBoard(piecePool: PieceKind[], width: number, height: number, seed: number): Board {
  const random = createSeededRandom(seed);
  const board: Board = [];

  for (let row = 0; row < height; row += 1) {
    const cells: BoardCell[] = [];

    for (let col = 0; col < width; col += 1) {
      const partial = [...board, cells];
      const kind = pickSafeKind(partial, row, col, piecePool, random);
      cells.push(createPiece(kind, `${row}-${col}-${kind}-${nextPieceSerial()}`));
    }

    board.push(cells);
  }

  return board;
}

function pickSafeKind(board: Board, row: number, col: number, piecePool: PieceKind[], random: () => number): PieceKind {
  const shuffled = shuffle(piecePool, random);
  return shuffled.find((kind) => !wouldCreateConnectedMatch(board, row, col, kind)) ?? shuffled[0] ?? piecePool[0];
}

function wouldCreateConnectedMatch(board: Board, row: number, col: number, kind: PieceKind): boolean {
  const visited = new Set<string>();
  const queue: Position[] = [{ row, col }];
  let count = 0;

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) {
      break;
    }

    const key = `${current.row}:${current.col}`;
    if (visited.has(key)) {
      continue;
    }

    visited.add(key);
    count += 1;
    if (count >= 3) {
      return true;
    }

    for (const step of ADJACENT_STEPS) {
      const next = { row: current.row + step.row, col: current.col + step.col };
      if (!isInsideOrCurrent(board, next, { row, col }) || getVirtualMatchableKind(board, next, { row, col }, kind) !== kind) {
        continue;
      }
      queue.push(next);
    }
  }

  return false;
}

function classifyDirection(cells: Position[]): MatchDirection {
  const rows = new Set(cells.map((cell) => cell.row));
  const cols = new Set(cells.map((cell) => cell.col));
  if (rows.size === 1) {
    return 'h';
  }
  if (cols.size === 1) {
    return 'v';
  }
  return 'both';
}

function longestRun(cells: Position[]): number {
  const byRow = new Map<number, number[]>();
  const byCol = new Map<number, number[]>();

  for (const cell of cells) {
    byRow.set(cell.row, [...(byRow.get(cell.row) ?? []), cell.col]);
    byCol.set(cell.col, [...(byCol.get(cell.col) ?? []), cell.row]);
  }

  return Math.max(longestGroupedRun(byRow), longestGroupedRun(byCol));
}

function longestGroupedRun(groups: Map<number, number[]>): number {
  let max = 0;

  for (const values of groups.values()) {
    values.sort((a, b) => a - b);
    let run = values.length > 0 ? 1 : 0;

    for (let index = 1; index < values.length; index += 1) {
      if (values[index] === values[index - 1] + 1) {
        run += 1;
      } else {
        max = Math.max(max, run);
        run = 1;
      }
    }

    max = Math.max(max, run);
  }

  return max;
}

function getMatchableKind(cell: BoardCell | undefined): PieceKind | null {
  if (!cell) {
    return null;
  }

  if (cell.kind === 'normal' || cell.kind === 'special') {
    return cell.pieceKind;
  }

  return null;
}

function getVirtualMatchableKind(board: Board, position: Position, target: Position, targetKind: PieceKind): PieceKind | null {
  if (position.row === target.row && position.col === target.col) {
    return targetKind;
  }

  return getMatchableKind(board[position.row]?.[position.col]);
}

function isSwappable(cell: BoardCell | undefined): boolean {
  return cell?.kind === 'normal' || cell?.kind === 'special';
}

function isInside(board: Board, position: Position): boolean {
  return position.row >= 0 && position.row < board.length && position.col >= 0 && position.col < (board[position.row]?.length ?? 0);
}

function isInsideOrCurrent(board: Board, position: Position, current: Position): boolean {
  return (position.row === current.row && position.col === current.col) || isInside(board, position);
}

function cloneBoard(board: Board): Board {
  return board.map((row) => row.map((cell) => ({ ...cell })));
}

function shuffle<T>(items: T[], random: () => number): T[] {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

let pieceSerial = 0;

function nextPieceSerial(): number {
  pieceSerial = (pieceSerial + 1) >>> 0;
  return pieceSerial;
}

function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function adjacentPositions(position: Position): Position[] {
  return ADJACENT_STEPS.map((step) => ({ row: position.row + step.row, col: position.col + step.col }));
}
