import type { GameScreen } from '../app/controller';

export type HitTargetType =
  | 'target'
  | 'continue'
  | 'level'
  | 'start'
  | 'home'
  | 'settings'
  | 'hint'
  | 'adHint'
  | 'adTime'
  | 'daily'
  | 'doubleReward'
  | 'adConfirm'
  | 'adCancel'
  | 'sound'
  | 'retry';

const OVERLAY_HITS = new Set<HitTargetType>([
  'continue',
  'doubleReward',
  'adTime',
  'adConfirm',
  'adCancel',
  'retry',
  'level',
  'home',
]);

export function shouldHandleHit(screen: GameScreen, hitType: HitTargetType | null): boolean {
  if (screen !== 'win' && screen !== 'failed') {
    return true;
  }
  return hitType !== null && OVERLAY_HITS.has(hitType);
}
