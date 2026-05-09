export const SOUND_NAMES = new Set([
  'tap',
  'invalid',
  'win',
  'hint',
  'bomb',
  'magnet',
  'hammer',
  'freeze',
  'ad-reward',
  'button',
  'level-start',
]);

export function normalizeSoundName(name: string | undefined): string | null {
  if (!name) {
    return null;
  }
  return SOUND_NAMES.has(name) ? name : 'tap';
}
