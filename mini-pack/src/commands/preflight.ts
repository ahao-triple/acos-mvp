import fs from 'node:fs/promises';
import path from 'node:path';

import { loadGameConfig } from '../core/config.js';
import { isUserError } from '../shared/errors.js';
import { logger } from '../shared/logger.js';
import type { PlatformName } from '../shared/types.js';

export interface PreflightOptions {
  projectRoot: string;
  platform: PlatformName;
}

export interface PreflightIssue {
  code:
    | 'MISSING_GAME_CONFIG'
    | 'INVALID_GAME_CONFIG'
    | 'MISSING_MATERIALS'
    | 'INVALID_MATERIALS'
    | 'MISSING_ICON'
    | 'MISSING_ENTRY'
    | 'MISSING_PUBLIC_DIR'
    | 'EMPTY_FIELD';
  path: string;
  message: string;
}

export interface PreflightResult {
  issues: PreflightIssue[];
}

const PLATFORM_LABEL: Record<PlatformName, string> = {
  vivo: 'vivo',
};

export async function runPreflight(options: PreflightOptions): Promise<PreflightResult> {
  const issues: PreflightIssue[] = [];
  const projectRoot = path.resolve(options.projectRoot);
  const platform = options.platform;

  let loaded: Awaited<ReturnType<typeof loadGameConfig>> | null = null;
  try {
    loaded = await loadGameConfig({ projectRoot, platform });
  } catch (error) {
    if (isUserError(error)) {
      const message = error.message;
      const detail = (error as { detail?: string }).detail;
      const fullMessage = detail ? `${message}\n${detail}` : message;
      const code = inferLoadErrorCode(fullMessage);
      issues.push({
        code,
        path: codeToPath(code, platform),
        message: codeToCnMessage(code, platform, fullMessage),
      });
      return { issues };
    }
    throw error;
  }

  try {
    await fs.access(loaded.paths.iconAbs);
  } catch {
    issues.push({
      code: 'MISSING_ICON',
      path: relPath(projectRoot, loaded.paths.iconAbs),
      message: `${PLATFORM_LABEL[platform]} 渠道图标不存在：${relPath(projectRoot, loaded.paths.iconAbs)}（请放置该 PNG 文件）`,
    });
  }

  if (loaded.vivoMaterials?.rewardedAdUnitId !== undefined && !loaded.vivoMaterials.rewardedAdUnitId.trim()) {
    issues.push({
      code: 'EMPTY_FIELD',
      path: relPath(projectRoot, loaded.paths.materialsAbs),
      message: 'materials.ts 中 rewardedAdUnitId 设置但为空（请填入 vivo 激励视频广告位 id，或删除该字段）',
    });
  }

  try {
    await fs.access(loaded.paths.entryAbs);
  } catch {
    issues.push({
      code: 'MISSING_ENTRY',
      path: loaded.game.entry,
      message: `游戏入口文件不存在：${loaded.game.entry}（请检查 game.config.ts 的 entry 字段）`,
    });
  }
  try {
    const stat = await fs.stat(loaded.paths.publicDirAbs);
    if (!stat.isDirectory()) throw new Error('not a directory');
  } catch {
    issues.push({
      code: 'MISSING_PUBLIC_DIR',
      path: loaded.game.publicDir,
      message: `公共资源目录不存在：${loaded.game.publicDir}（请检查 game.config.ts 的 publicDir 字段）`,
    });
  }

  return { issues };
}

export function reportPreflightIssues(issues: PreflightIssue[], platform: PlatformName, gameLabel: string): void {
  if (issues.length === 0) return;
  logger.error(
    `${PLATFORM_LABEL[platform]} 渠道物料未准备好，无法打包（${gameLabel}/channels/${platform}/）：`,
  );
  for (const issue of issues) {
    logger.error(`  - ${issue.message}`);
  }
  logger.error('请补齐后重试。');
}

function relPath(root: string, abs: string): string {
  return path.relative(root, abs).split(path.sep).join('/');
}

function inferLoadErrorCode(message: string): PreflightIssue['code'] {
  if (message.includes('Config file not found')) return 'MISSING_GAME_CONFIG';
  if (message.includes('Channel materials not found')) return 'MISSING_MATERIALS';
  if (message.includes('Invalid game.config.ts')) return 'INVALID_GAME_CONFIG';
  if (message.includes('Invalid channels/')) return 'INVALID_MATERIALS';
  return 'INVALID_GAME_CONFIG';
}

function codeToPath(code: PreflightIssue['code'], platform: PlatformName): string {
  switch (code) {
    case 'MISSING_GAME_CONFIG':
    case 'INVALID_GAME_CONFIG':
      return 'game.config.ts';
    case 'MISSING_MATERIALS':
    case 'INVALID_MATERIALS':
      return `channels/${platform}/materials.ts`;
    default:
      return '';
  }
}

function codeToCnMessage(code: PreflightIssue['code'], platform: PlatformName, original: string): string {
  switch (code) {
    case 'MISSING_GAME_CONFIG':
      return 'game.config.ts 不存在（请在游戏根目录创建该文件）';
    case 'INVALID_GAME_CONFIG':
      return `game.config.ts 校验失败：${original.split('\n').slice(1).join('; ')}`;
    case 'MISSING_MATERIALS':
      return `channels/${platform}/materials.ts 不存在（请创建并填写渠道物料）`;
    case 'INVALID_MATERIALS':
      return `channels/${platform}/materials.ts 校验失败：${original.split('\n').slice(1).join('; ')}`;
    default:
      return original;
  }
}
