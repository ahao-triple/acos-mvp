import type { BlockerKind, PieceKind, TargetConfig } from '../core/types';

export const pieceColors: Record<PieceKind, string> = {
  shield: '#2f80ed',
  ammo: '#27ae60',
  radar: '#9b51e0',
  medal: '#f2c94c',
  wrench: '#eb5757',
  energy: '#06b6d4',
};

export const targetLabels: Record<PieceKind | BlockerKind, string> = {
  shield: '护盾',
  ammo: '弹药',
  radar: '雷达',
  medal: '勋章',
  wrench: '扳手',
  energy: '能量',
  sandbag: '沙袋',
  brokenDefense: '破损防线',
};

export interface ChapterTheme {
  top: string;
  middle: string;
  bottom: string;
  accent: string;
}

export const chapterThemes: Record<number, ChapterTheme> = {
  1: { top: '#123526', middle: '#2d4d4e', bottom: '#16243a', accent: '#d1fae5' },
  2: { top: '#263947', middle: '#42566a', bottom: '#1d2a3d', accent: '#bfdbfe' },
  3: { top: '#3a2434', middle: '#57405c', bottom: '#221827', accent: '#fde68a' },
};

export function targetLabel(kind: PieceKind | BlockerKind): string {
  return targetLabels[kind];
}

export function targetProgressText(target: TargetConfig, progress: Record<string, number>): string {
  return `${targetLabel(target.kind)} ${progress[target.kind] ?? 0}/${target.count}`;
}

export function chapterTheme(chapterId: number | undefined): ChapterTheme {
  return chapterThemes[chapterId ?? 1] ?? chapterThemes[1];
}
