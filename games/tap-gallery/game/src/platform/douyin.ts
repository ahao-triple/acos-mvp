export function canUseDouyinAdapter(): boolean {
  return typeof globalThis !== 'undefined' && typeof (globalThis as { tt?: unknown }).tt === 'object';
}
