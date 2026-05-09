export interface BoardCameraState {
  scale: number;
  x: number;
  y: number;
  minScale: number;
  maxScale: number;
  canPan: boolean;
  canZoom: boolean;
  isDragging: boolean;
}

export interface CameraLevelConfig {
  levelNo: number;
  allowPan: boolean;
  allowZoom: boolean;
}

const BOARD_SIZE = 660;

export function createBoardCamera(level: CameraLevelConfig): BoardCameraState {
  const canPan = level.allowPan && level.levelNo >= 6;
  const canZoom = level.allowZoom && level.levelNo >= 11;
  return {
    scale: 1,
    x: 0,
    y: 0,
    minScale: 1,
    maxScale: canZoom ? 2.2 : 1,
    canPan,
    canZoom,
    isDragging: false,
  };
}

export function zoomCamera(camera: BoardCameraState, scale: number, _origin: { x: number; y: number }): BoardCameraState {
  if (!camera.canZoom) {
    return camera;
  }
  const next = {
    ...camera,
    scale: clamp(scale, camera.minScale, camera.maxScale),
  };
  return clampCamera(next);
}

export function panCamera(camera: BoardCameraState, delta: { dx: number; dy: number }): BoardCameraState {
  if (!camera.canPan || camera.scale <= 1) {
    return camera;
  }
  return clampCamera({
    ...camera,
    x: camera.x + delta.dx,
    y: camera.y + delta.dy,
  });
}

export function resetCamera(camera: BoardCameraState): BoardCameraState {
  return {
    ...camera,
    scale: 1,
    x: 0,
    y: 0,
    isDragging: false,
  };
}

function clampCamera(camera: BoardCameraState): BoardCameraState {
  const maxOffset = Math.round((((camera.scale - 1) * BOARD_SIZE) / 2) * 1000) / 1000;
  return {
    ...camera,
    x: clamp(camera.x, -maxOffset, maxOffset),
    y: clamp(camera.y, -maxOffset, maxOffset),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
