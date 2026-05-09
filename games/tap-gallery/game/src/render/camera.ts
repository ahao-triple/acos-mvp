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
  initialZoom?: number;
}

const BOARD_SIZE = 660;
const BOARD_CENTER = BOARD_SIZE / 2;

export function createBoardCamera(level: CameraLevelConfig): BoardCameraState {
  const canPan = level.allowPan && level.levelNo >= 6;
  const canZoom = level.allowZoom && level.levelNo >= 11;
  const maxScale = canZoom ? 2.2 : 1;
  const scale = clamp(level.initialZoom ?? 1, 1, maxScale);
  return {
    scale,
    x: 0,
    y: 0,
    minScale: 1,
    maxScale,
    canPan,
    canZoom,
    isDragging: false,
  };
}

export function zoomCamera(camera: BoardCameraState, scale: number, origin: { x: number; y: number }): BoardCameraState {
  if (!camera.canZoom) {
    return camera;
  }
  const nextScale = clamp(scale, camera.minScale, camera.maxScale);
  const scaleRatio = nextScale / camera.scale;
  const next = {
    ...camera,
    scale: nextScale,
    x: camera.x * scaleRatio + (origin.x - BOARD_CENTER) * (1 - scaleRatio),
    y: camera.y * scaleRatio + (origin.y - BOARD_CENTER) * (1 - scaleRatio),
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

export function boardToCameraScreenPoint(camera: BoardCameraState, point: { x: number; y: number }): { x: number; y: number } {
  return {
    x: BOARD_CENTER + camera.x + (point.x - BOARD_CENTER) * camera.scale,
    y: BOARD_CENTER + camera.y + (point.y - BOARD_CENTER) * camera.scale,
  };
}

export function cameraScreenToBoardPoint(camera: BoardCameraState, point: { x: number; y: number }): { x: number; y: number } {
  return {
    x: BOARD_CENTER + (point.x - BOARD_CENTER - camera.x) / camera.scale,
    y: BOARD_CENTER + (point.y - BOARD_CENTER - camera.y) / camera.scale,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
