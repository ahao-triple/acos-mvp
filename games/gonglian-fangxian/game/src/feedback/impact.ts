import type { AudioCueType } from '../audio/soundEngine';
import type { Position, SessionEvent } from '../core/types';

export type ImpactLevel = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
export type ImpactSource = 'match' | 'cascade' | 'powerUp' | 'winFinale' | 'lose';
export type ImpactHaptic = 'none' | 'short' | 'long';

export interface ImpactShake {
  amplitude: number;
  durationMs: number;
}

export interface ImpactDescriptor {
  level: ImpactLevel;
  source: ImpactSource;
  sound: AudioCueType;
  haptic: ImpactHaptic;
  shake: ImpactShake;
}

export interface ImpactEvent extends ImpactDescriptor {
  id: number;
}

const IMPACT_PROFILES: Record<ImpactLevel, Pick<ImpactDescriptor, 'haptic' | 'shake'>> = {
  1: { haptic: 'short', shake: { amplitude: 0, durationMs: 0 } },
  2: { haptic: 'short', shake: { amplitude: 1, durationMs: 80 } },
  3: { haptic: 'short', shake: { amplitude: 2, durationMs: 100 } },
  4: { haptic: 'short', shake: { amplitude: 3, durationMs: 120 } },
  5: { haptic: 'short', shake: { amplitude: 4, durationMs: 150 } },
  6: { haptic: 'long', shake: { amplitude: 5, durationMs: 170 } },
  7: { haptic: 'long', shake: { amplitude: 6, durationMs: 190 } },
  8: { haptic: 'long', shake: { amplitude: 8, durationMs: 220 } },
  9: { haptic: 'long', shake: { amplitude: 10, durationMs: 280 } },
};

export function impactForClearStep(events: SessionEvent[], clearEventIndex: number): ImpactDescriptor | null {
  const event = events[clearEventIndex];
  if (!event || event.type !== 'clear') {
    return null;
  }

  const clearPhase = events.slice(0, clearEventIndex + 1).filter((candidate) => candidate.type === 'clear').length;
  if (clearPhase >= 2) {
    return impactForLevel(cascadeLevel(clearPhase), 'cascade');
  }

  const clearCount = uniquePositionCount(event.cells ?? []);
  const matchEvents = matchEventsBeforeClear(events, clearEventIndex);
  if (matchEvents.length === 0) {
    return impactForLevel(powerUpLevel(clearCount), 'powerUp');
  }

  return impactForLevel(matchLevel(matchEvents, clearCount), 'match');
}

export function impactForWinFinale(): ImpactDescriptor {
  return impactForLevel(9, 'winFinale');
}

export function impactForLevel(level: ImpactLevel, source: ImpactSource): ImpactDescriptor {
  const profile = IMPACT_PROFILES[level];
  return {
    level,
    source,
    sound: source === 'winFinale' ? 'win' : level <= 2 ? 'match' : 'combo',
    haptic: profile.haptic,
    shake: profile.shake,
  };
}

function cascadeLevel(clearPhase: number): ImpactLevel {
  if (clearPhase >= 4) {
    return 8;
  }
  if (clearPhase === 3) {
    return 7;
  }
  return 6;
}

function powerUpLevel(clearCount: number): ImpactLevel {
  if (clearCount >= 9) {
    return 8;
  }
  if (clearCount >= 5) {
    return 7;
  }
  return 5;
}

function matchLevel(matchEvents: SessionEvent[], clearCount: number): ImpactLevel {
  const groupCount = matchEvents.filter((event) => (event.cells?.length ?? event.count ?? 0) >= 3).length;
  const shaped = matchEvents.some((event) => spansRowsAndColumns(event.cells ?? []));

  if (clearCount >= 8) {
    return 5;
  }
  if (groupCount >= 2 || shaped) {
    return 4;
  }
  if (clearCount >= 6) {
    return 3;
  }
  if (clearCount >= 4) {
    return 2;
  }
  return 1;
}

function matchEventsBeforeClear(events: SessionEvent[], clearEventIndex: number): SessionEvent[] {
  const start = previousClearIndex(events, clearEventIndex) + 1;
  return events.slice(start, clearEventIndex).filter((event) => event.type === 'match');
}

function previousClearIndex(events: SessionEvent[], clearEventIndex: number): number {
  for (let index = clearEventIndex - 1; index >= 0; index -= 1) {
    if (events[index].type === 'clear') {
      return index;
    }
  }
  return -1;
}

function uniquePositionCount(cells: Position[]): number {
  return new Set(cells.map((cell) => `${cell.row}:${cell.col}`)).size;
}

function spansRowsAndColumns(cells: Position[]): boolean {
  const rows = new Set(cells.map((cell) => cell.row));
  const cols = new Set(cells.map((cell) => cell.col));
  return rows.size >= 2 && cols.size >= 2;
}
