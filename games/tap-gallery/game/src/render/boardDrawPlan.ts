export interface DrawableCellRef {
  index: number;
  cleared: boolean;
}

export interface BoardHintState {
  weakHint: {
    active: boolean;
    index: number | null;
  };
  guidance: {
    type: 'firstTap';
    index: number;
    label: string;
  } | null;
  feedbackIndexes?: number[];
}

export type BoardDrawItem =
  | { layer: 'cell'; index: number }
  | { layer: 'hint'; index: number; kind: 'weakHint' | 'guidance'; label?: string };

export function boardDrawOrder(cells: DrawableCellRef[], state: BoardHintState): BoardDrawItem[] {
  const feedbackIndexes = new Set(state.feedbackIndexes ?? []);
  const activeIndexes = new Set(cells.filter((cell) => !cell.cleared).map((cell) => cell.index));
  const cellItems = cells
    .filter((cell) => !cell.cleared || feedbackIndexes.has(cell.index))
    .map((cell): BoardDrawItem => ({ layer: 'cell', index: cell.index }));
  const hintItems: BoardDrawItem[] = [];

  if (state.weakHint.active && state.weakHint.index !== null && activeIndexes.has(state.weakHint.index)) {
    hintItems.push({ layer: 'hint', index: state.weakHint.index, kind: 'weakHint' });
  }
  if (state.guidance && activeIndexes.has(state.guidance.index)) {
    hintItems.push({ layer: 'hint', index: state.guidance.index, kind: 'guidance', label: state.guidance.label });
  }

  return [...cellItems, ...hintItems];
}
