import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const gamePath = process.argv[2];

if (!gamePath) {
  console.error('Usage: pnpm smoke games/<game-project>');
  process.exit(1);
}

const gameName = path.basename(path.resolve(repoRoot, gamePath));
const packageDir = path.join(repoRoot, 'build', `${gameName}-douyin`);
const gameJsPath = path.join(packageDir, 'game.js');

if (!fs.existsSync(gameJsPath)) {
  console.error(`Built game.js not found: ${path.relative(repoRoot, gameJsPath)}`);
  process.exit(1);
}

const code = fs.readFileSync(gameJsPath, 'utf8');
const errors = [];
const storage = new Map();
const canvases = [];
const audioPlays = [];
const touchListeners = {
  start: [],
  move: [],
  end: [],
  cancel: [],
};
const windowInfo = {
  windowWidth: 393,
  windowHeight: 852,
  pixelRatio: 3,
};
const logicalScale = Math.min(windowInfo.windowWidth / 750, windowInfo.windowHeight / 1334);
const smokeTouch = {
  x: windowInfo.windowWidth / 2,
  y: (windowInfo.windowHeight - 1334 * logicalScale) / 2 + 373 * logicalScale,
};
let frameCount = 0;
let frameId = 0;

const onUnhandledRejection = (reason) => {
  errors.push(reason);
};
process.on('unhandledRejection', onUnhandledRejection);

const context = vm.createContext({
  console,
  performance: {
    now: () => Date.now(),
  },
  requestAnimationFrame(callback) {
    const id = ++frameId;
    if (frameCount < 3) {
      frameCount += 1;
      queueMicrotask(() => {
        try {
          callback(Date.now());
        } catch (error) {
          errors.push(error);
        }
      });
    }
    return id;
  },
  cancelAnimationFrame() {},
  tt: {
    createCanvas() {
      return createMiniGameCanvas();
    },
    onTouchStart(listener) {
      touchListeners.start.push(listener);
    },
    offTouchStart(listener) {
      removeListener(touchListeners.start, listener);
    },
    onTouchMove(listener) {
      touchListeners.move.push(listener);
    },
    offTouchMove(listener) {
      removeListener(touchListeners.move, listener);
    },
    onTouchEnd(listener) {
      touchListeners.end.push(listener);
    },
    offTouchEnd(listener) {
      removeListener(touchListeners.end, listener);
    },
    onTouchCancel(listener) {
      touchListeners.cancel.push(listener);
    },
    offTouchCancel(listener) {
      removeListener(touchListeners.cancel, listener);
    },
    getStorageSync(key) {
      return storage.get(key) ?? '';
    },
    setStorageSync(key, value) {
      storage.set(key, value);
    },
    removeStorageSync(key) {
      storage.delete(key);
    },
    getEnterOptionsSync() {
      return {};
    },
    getWindowInfo() {
      return windowInfo;
    },
    getSystemInfoSync() {
      return windowInfo;
    },
    createInnerAudioContext() {
      const handlers = {
        ended: [],
        error: [],
      };
      return {
        src: '',
        loop: false,
        obeyMuteSwitch: true,
        volume: 1,
        play() {
          audioPlays.push(this.src);
          for (const handler of handlers.ended) {
            queueMicrotask(handler);
          }
        },
        stop() {},
        destroy() {},
        onEnded(handler) {
          handlers.ended.push(handler);
        },
        onError(handler) {
          handlers.error.push(handler);
        },
      };
    },
  },
});

try {
  new vm.Script(code, { filename: gameJsPath }).runInContext(context, { timeout: 1000 });
  for (const canvas of canvases) {
    canvas.dispatchEvent?.('pointerdown', { clientX: smokeTouch.x, clientY: smokeTouch.y });
    canvas.dispatchEvent?.('touchstart', { touches: [{ clientX: smokeTouch.x, clientY: smokeTouch.y }] });
  }
  for (const listener of touchListeners.start) {
    listener({ touches: [smokeTouch], changedTouches: [smokeTouch] });
  }
  await new Promise((resolve) => setTimeout(resolve, 30));
} catch (error) {
  errors.push(error);
} finally {
  process.off('unhandledRejection', onUnhandledRejection);
}

if (errors.length > 0) {
  for (const error of errors) {
    console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  }
  process.exit(1);
}

if (audioPlays.length === 0) {
  console.error('Smoke failed: no SFX playback was requested after pointer input.');
  process.exit(1);
}

if (canvases[0]?.width !== windowInfo.windowWidth * windowInfo.pixelRatio || canvases[0]?.height !== windowInfo.windowHeight * windowInfo.pixelRatio) {
  console.error(
    `Smoke failed: canvas backing store is ${canvases[0]?.width}x${canvases[0]?.height}, expected ${
      windowInfo.windowWidth * windowInfo.pixelRatio
    }x${windowInfo.windowHeight * windowInfo.pixelRatio}.`,
  );
  process.exit(1);
}

console.log(`Smoke passed: ${path.relative(repoRoot, packageDir)}`);

function createMiniGameCanvas() {
  const canvas = {
    width: 0,
    height: 0,
    addEventListener() {},
    removeEventListener() {},
    getContext(type) {
      if (type !== '2d') {
        return null;
      }
      return createNoopContext2d();
    },
  };
  canvases.push(canvas);
  return canvas;
}

function removeListener(listeners, listener) {
  const index = listeners.indexOf(listener);
  if (index >= 0) {
    listeners.splice(index, 1);
  }
}

function createNoopContext2d() {
  const gradient = {
    addColorStop() {},
  };

  return new Proxy(
    {},
    {
      get(target, property) {
        if (property in target) {
          return target[property];
        }
        if (property === 'createLinearGradient') {
          return () => gradient;
        }
        if (property === 'measureText') {
          return (text) => ({ width: String(text).length * 10 });
        }
        return () => {};
      },
      set(target, property, value) {
        target[property] = value;
        return true;
      },
    },
  );
}
