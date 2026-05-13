import type { SaveData } from './save';
import { addMoves } from '../core/session';
import type { GameSession } from '../core/types';
import type { PlatformAdapter, PlatformResult } from '../platform/types';
import { debugLog } from './debugLog';

export type InventoryItem = keyof SaveData['items'];

export interface SessionRewardOutcome {
  granted: boolean;
  feedback: string;
  session: GameSession;
}

export interface SaveRewardOutcome {
  granted: boolean;
  feedback: string;
  save: SaveData;
}

const adItemLabels: Record<InventoryItem, string> = {
  extraMoves: '补给步数',
  bomb: '炸开',
  suck: '吸走',
  shuffle: '重排',
};

export async function requestExtraMoves(session: GameSession, platform: PlatformAdapter): Promise<SessionRewardOutcome> {
  const result = await platform.showRewardedAd('extra_moves');
  debugLog('rewarded_ad_result', {
    reason: 'extra_moves',
    status: result.status,
    fallbackGrant: shouldGrantAdFallback(result),
    message: result.message ?? null,
  });

  if (result.status === 'success' || shouldGrantAdFallback(result)) {
    return {
      granted: true,
      feedback: result.status === 'success' ? '已获得 5 步补给。' : adFallbackRewardFeedback(result, '5 步补给'),
      session: addMoves(session, 5),
    };
  }

  return {
    granted: false,
    feedback: adFeedback(result),
    session,
  };
}

export async function claimAdItemReward(save: SaveData, item: InventoryItem, platform: PlatformAdapter): Promise<SaveRewardOutcome> {
  const result = await platform.showRewardedAd('reward');
  debugLog('rewarded_ad_result', {
    reason: 'power_up_item',
    item,
    status: result.status,
    fallbackGrant: shouldGrantAdFallback(result),
    message: result.message ?? null,
  });

  if (result.status !== 'success' && !shouldGrantAdFallback(result)) {
    return {
      granted: false,
      feedback: adFeedback(result),
      save,
    };
  }

  return {
    granted: true,
    feedback: result.status === 'success' ? `已获得${adItemLabels[item]}道具。` : adFallbackRewardFeedback(result, `${adItemLabels[item]}道具`),
    save: {
      ...save,
      items: {
        ...save.items,
        [item]: save.items[item] + 1,
      },
    },
  };
}

export async function claimDesktopReward(save: SaveData, platform: PlatformAdapter): Promise<SaveRewardOutcome> {
  if (save.desktopRewardClaimed) {
    return { granted: false, feedback: '加桌已完成。', save };
  }

  const result = await platform.addDesktopShortcut();
  if (result.status !== 'success') {
    return {
      granted: false,
      feedback: platformFeedback(result, '当前环境暂不支持添加到桌面。', '添加到桌面未完成。'),
      save,
    };
  }

  return {
    granted: true,
    feedback: '已添加到桌面。',
    save: {
      ...save,
      desktopRewardClaimed: true,
    },
  };
}

export async function claimFavoriteReward(save: SaveData, platform: PlatformAdapter): Promise<SaveRewardOutcome> {
  if (save.favoriteRewardClaimed) {
    return { granted: false, feedback: '加常用奖励已领取。', save };
  }

  const result = await platform.showFavoriteGuide();
  if (result.status !== 'success') {
    return {
      granted: false,
      feedback: platformFeedback(result, '当前环境暂不支持添加到常用。', '添加到常用未完成，暂未获得奖励。'),
      save,
    };
  }

  return {
    granted: true,
    feedback: '已领取加常用补给。',
    save: {
      ...save,
      items: {
        ...save.items,
        extraMoves: save.items.extraMoves + 1,
      },
      favoriteRewardClaimed: true,
    },
  };
}

export async function claimSidebarReward(save: SaveData, platform: PlatformAdapter): Promise<SaveRewardOutcome> {
  if (save.sidebarRewardClaimed) {
    return { granted: false, feedback: '侧边栏任务已完成。', save };
  }

  if (!(await platform.didEnterFromSidebar())) {
    const result = await platform.requestSidebarEntry();
    if (result.status === 'success') {
      return {
        granted: false,
        feedback: '已打开侧边栏。请从侧边栏卡片重新进入《全民爆梗游戏软件》后再次点击任务。',
        save,
      };
    }

    return {
      granted: false,
      feedback: platformFeedback(result, '当前环境暂不支持侧边栏跳转。', '侧边栏跳转未完成。'),
      save,
    };
  }

  return {
    granted: true,
    feedback: '已完成侧边栏任务。',
    save: {
      ...save,
      sidebarRewardClaimed: true,
    },
  };
}

function adFeedback(result: PlatformResult): string {
  if (result.status === 'cancelled') {
    return '未完整观看，暂未获得奖励。';
  }

  if (result.message) {
    return result.message;
  }

  if (result.status === 'unsupported') {
    return '当前环境暂不支持广告，稍后再试。';
  }

  return '广告暂时不可用，稍后再试。';
}

function shouldGrantAdFallback(result: PlatformResult): boolean {
  return result.status === 'unsupported' || result.status === 'failed';
}

function adFallbackRewardFeedback(result: PlatformResult, rewardLabel: string): string {
  const prefix = result.message ? `${result.message}，` : '广告暂不可用，';
  return `${prefix}已直接发放${rewardLabel}。`;
}

function platformFeedback(result: PlatformResult, unsupported: string, failed: string): string {
  if (result.message) {
    return result.message;
  }

  return result.status === 'unsupported' ? unsupported : failed;
}
