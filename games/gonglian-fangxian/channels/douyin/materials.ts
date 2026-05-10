import { defineDouyinMaterials } from '../../../../mini-pack/src/index';

export default defineDouyinMaterials({
  appid: process.env.DOUYIN_APPID ?? '',
  projectName: 'gonglian-fangxian',
  rewardedAdUnitId: process.env.DOUYIN_REWARDED_AD_UNIT_ID ?? '',
  iconPath: 'icon.png',
});
