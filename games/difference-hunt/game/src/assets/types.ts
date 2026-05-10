export interface CocosPoint {
  x: number;
  y: number;
}

export interface CocosSize {
  width: number;
  height: number;
}

export interface DifferenceTarget {
  id: string;
  image: string;
  cocos: CocosPoint;
  size: CocosSize;
}

export interface DifferenceLevel {
  levelNo: number;
  title: string;
  background: string;
  backgroundSize: CocosSize;
  center: CocosPoint;
  targets: DifferenceTarget[];
}
