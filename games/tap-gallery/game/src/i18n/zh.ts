import type { ToolName } from '../app/controller';

export const zhText = {
  title: '点点画廊',
  level: (levelNo: number) => `第 ${levelNo} 关`,
  moves: (movesLeft: number) => `${movesLeft} 步`,
  energy: (energy: number) => `体力 ${energy}`,
  coins: (coins: number) => `金币 ${coins}`,
  buttons: {
    levels: '关卡',
    continue: '继续',
    retry: '重试',
  },
  tools: {
    hint: '提示',
    bomb: '炸弹',
    magnet: '磁铁',
    hammer: '锤子',
    freeze: '冻结',
  } satisfies Record<ToolName, string>,
  results: {
    winTitle: '完成',
    failedTitle: '步数用尽',
  },
  screens: {
    gallery: '图鉴',
  },
  guidance: {
    tap: '点击',
  },
  cells: {
    locked: '锁定',
    timerBadge: '时',
    bombBadge: '爆',
  },
  messages: {
    inactiveLevel: '关卡未激活。',
    noMovesLeft: '步数用尽。',
    noMoveAvailable: '没有可用步骤。',
    levelLocked: '关卡未解锁。',
    notEnoughEnergy: '体力不足。',
    continueUsed: '本次续步已使用。',
    extraMovesUnavailable: '暂时无法获得额外步数。',
    extraMovesReward: '+8 步',
    toolUnavailable: '道具不足。',
    timeExpired: '时间耗尽。',
    rewardedAdsUnavailable: '浏览器预览中无法播放激励广告。',
  },
};
