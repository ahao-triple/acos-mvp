export type Direction = 0 | 1 | 2 | 3;

export interface AssetManifestLevel {
  levelNo: number;
  id: string;
  title: string;
  subject: string;
  maskImage: string;
  revealImage: string;
  thumbnail: string;
  config: string;
  palette?: string[];
  artStatus?: string;
  sourceImagegenFile?: string;
}

export interface AssetManifest {
  designSize: {
    width: number;
    height: number;
  };
  levelConfigIndex: string;
  levels: AssetManifestLevel[];
}

export interface LevelBoardConfig {
  width: number;
  height: number;
  allowPan: boolean;
  allowZoom: boolean;
  initialZoom: number;
}

export interface LevelGuidanceConfig {
  introCue: string;
  weakHintEnabled: boolean;
  revealFocus: boolean;
  firstTapIndex?: number;
}

export interface LevelCellConfig {
  index: number;
  direction: Direction;
  kind?: 'locked' | 'golden' | 'timer' | 'bomb' | 'secret';
  unlockGroup?: number;
}

export interface LevelConfig {
  id: string;
  levelNo: number;
  title: string;
  subject: string;
  maskImage: string;
  revealImage: string;
  thumbnail: string;
  board: LevelBoardConfig;
  moves: number;
  cellsTarget: number;
  mechanics: string[];
  idleHintDelayMs: number;
  guidance: LevelGuidanceConfig;
  cells: LevelCellConfig[];
  artStatus?: string;
  sourceImagegenFile?: string;
  palette?: string[];
}
