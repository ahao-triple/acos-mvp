import { defineGameConfig } from '../../mini-pack/src/index';

export default defineGameConfig({
  title: '共联防线软件',
  platform: 'douyin',
  entry: 'game/src/main.ts',
  publicDir: 'game/public',
  outDir: 'builds/douyin',
  orientation: 'portrait',
  canvas: {
    width: 750,
    height: 1334,
  },
  douyin: {
    appid: process.env.DOUYIN_APPID ?? '',
    projectName: 'gonglian-fangxian',
    rewardedAdUnitId: process.env.DOUYIN_REWARDED_AD_UNIT_ID ?? '',
  },
});
