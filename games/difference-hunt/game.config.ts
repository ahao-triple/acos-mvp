import { defineGameConfig } from '../../mini-pack/src/index';

export default defineGameConfig({
  title: '找茬闯关',
  platform: 'douyin',
  entry: 'game/src/main.ts',
  publicDir: 'game/public-pack',
  outDir: 'builds/douyin',
  orientation: 'portrait',
  canvas: {
    width: 750,
    height: 1334,
  },
  douyin: {
    appid: process.env.DOUYIN_APPID ?? '',
    projectName: 'difference-hunt',
    rewardedAdUnitId: process.env.DOUYIN_REWARDED_AD_UNIT_ID ?? '',
  },
});
