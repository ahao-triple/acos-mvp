import type { GameRuntime } from '../../../../../src/shared/types.js';

export function createGame(runtime: GameRuntime) {
  return {
    start() {
      runtime.logger.info('game started');
      runtime.storage.setString('started', 'yes');
    },
    pause() {},
    resume() {},
    destroy() {},
  };
}
