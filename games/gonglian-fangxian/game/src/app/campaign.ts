import { CHAPTERS, levels } from '../config/levels';
import type { GameSession, LevelConfig, NodeReward, PowerUpType, TargetConfig } from '../core/types';

export interface ChapterProgress {
  id: number;
  title: string;
  startLevel: number;
  endLevel: number;
  unlockedCount: number;
  completedCount: number;
  current: boolean;
}

const targetLabels: Record<TargetConfig['kind'], string> = {
  shield: '护盾',
  ammo: '弹药',
  radar: '雷达',
  medal: '勋章',
  wrench: '扳手',
  sandbag: '沙袋',
  brokenDefense: '破损防线',
};

const rewardLabels: Record<PowerUpType, string> = {
  bomb: '炸开',
  suck: '吸走',
  shuffle: '重排',
};

export function levelById(levelId: number): LevelConfig {
  return levels.find((level) => level.id === levelId) ?? levels[0];
}

export function chapterProgressForSave(
  highestUnlockedLevel: number,
  completedLevelCount = Math.max(0, highestUnlockedLevel - 1),
): ChapterProgress[] {
  return CHAPTERS.map((chapter) => {
    const unlockedCount = Math.max(0, Math.min(highestUnlockedLevel, chapter.endLevel) - chapter.startLevel + 1);
    const completedCount = Math.max(0, Math.min(completedLevelCount, chapter.endLevel) - chapter.startLevel + 1);

    return {
      id: chapter.id,
      title: chapter.title,
      startLevel: chapter.startLevel,
      endLevel: chapter.endLevel,
      unlockedCount,
      completedCount,
      current: highestUnlockedLevel >= chapter.startLevel && highestUnlockedLevel <= chapter.endLevel,
    };
  });
}

export function targetProgressText(target: TargetConfig, progress: Record<string, number>): string {
  return `${targetLabels[target.kind]} ${progress[target.kind] ?? 0}/${target.count}`;
}

export function remainingTargetsText(session: GameSession): string {
  return session.targets.map((target) => targetProgressText(target, session.targetProgress)).join('  ');
}

export function describeNodeReward(reward: NodeReward | undefined): string {
  if (!reward) {
    return '';
  }

  return (Object.entries(reward) as Array<[PowerUpType, number]>)
    .filter(([, count]) => count > 0)
    .map(([item, count]) => `${rewardLabels[item]} x${count}`)
    .join('  ');
}
