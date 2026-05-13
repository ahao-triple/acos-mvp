import type { PieceKind } from '../core/types';

export const pieceColors: Record<PieceKind, string> = {
  shield: '#93c5fd',
  ammo: '#86efac',
  radar: '#d8b4fe',
  medal: '#fde68a',
  wrench: '#fca5a5',
  energy: '#67e8f9',
};

// target label / targetProgressText 单一定义在 src/app/campaign.ts。
// 之前这里也有一份重复版本，导致主题适配时漏改、过关条件 UI 仍显示旧文案。

export interface ChapterTheme {
  top: string;
  middle: string;
  bottom: string;
  accent: string;
}

export const chapterThemes: Record<number, ChapterTheme> = {
  1: { top: '#fafaf7', middle: '#f3f0e8', bottom: '#e9f1ee', accent: '#f59e0b' },
  2: { top: '#fafaf7', middle: '#eef2f6', bottom: '#e3edf6', accent: '#f59e0b' },
  3: { top: '#fafaf7', middle: '#f4edf3', bottom: '#efe6dd', accent: '#f59e0b' },
};

export function chapterTheme(chapterId: number | undefined): ChapterTheme {
  return chapterThemes[chapterId ?? 1] ?? chapterThemes[1];
}
