import { defineDouyinMaterials } from '../../../../mini-pack/src/index';

export default defineDouyinMaterials({
  appid: process.env.DOUYIN_APPID ?? '',
  projectName: 'difference-hunt',
  rewardedAdUnitId: process.env.DOUYIN_REWARDED_AD_UNIT_ID ?? '',
  iconPath: 'icon.png',
});
