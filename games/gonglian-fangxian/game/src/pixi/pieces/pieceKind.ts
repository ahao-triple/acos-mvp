/**
 * PieceSprite 的 kind 缓存比较与归类，抽成 pure function 让 vitest 直接覆盖。
 *
 * 设计：
 *   - sameKind(cached, cell)：纯比较，不分配对象。PieceSprite.sync 每帧调，要 0 GC 压力。
 *   - classifyCell(cell)：分配 CachedKind 对象。只在 kind 真变化时调一次（每个 piece 一生
 *     大概 1-3 次：初始建模 / normal → special 升级 / 销毁前的 empty）。
 *
 * 与 PieceSprite 解耦的好处：
 *   - kind 比较逻辑改了 (例如新增 piece 类型) 时，先写测试再改实现，红绿循环
 *   - 不依赖 PixiJS / DOM / canvas，jsdom 跑得极快
 */
import type { BlockerKind, BoardCell, PieceKind } from '../../core/types';

export type CachedKind =
  | { type: 'normal'; pieceKind: PieceKind }
  | { type: 'special'; pieceKind: PieceKind }
  | { type: 'blocker'; blockerKind: BlockerKind };

/** 已缓存的 kind 是否仍能描述当前 cell。null cached 总是 false。 */
export function sameKind(cached: CachedKind | null, cell: BoardCell): boolean {
  if (!cached) return false;
  if (cell.kind === 'normal') return cached.type === 'normal' && cached.pieceKind === cell.pieceKind;
  if (cell.kind === 'special') return cached.type === 'special' && cached.pieceKind === cell.pieceKind;
  if (cell.kind === 'blocker') return cached.type === 'blocker' && cached.blockerKind === cell.blockerKind;
  // empty / 未知 kind：cached 无法描述，需要 PieceSprite 清空几何
  return false;
}

/** cell → CachedKind。empty / 不支持的 kind 返回 null，调用方应清空 sprite。 */
export function classifyCell(cell: BoardCell): CachedKind | null {
  if (cell.kind === 'normal') return { type: 'normal', pieceKind: cell.pieceKind };
  if (cell.kind === 'special') return { type: 'special', pieceKind: cell.pieceKind };
  if (cell.kind === 'blocker') return { type: 'blocker', blockerKind: cell.blockerKind };
  return null;
}
