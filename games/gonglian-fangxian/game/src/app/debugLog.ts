export function debugLog(event: string, data: Record<string, unknown> = {}): void {
  if (typeof console === 'undefined' || typeof console.info !== 'function') {
    return;
  }

  console.info('[GLFX]', event, data);
}
