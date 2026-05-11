export function nowMs(): number {
  const timer = globalThis.performance;
  return timer && typeof timer.now === 'function' ? timer.now() : Date.now();
}
