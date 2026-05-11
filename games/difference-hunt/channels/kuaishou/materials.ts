import { defineKuaishouMaterials } from '../../../../mini-pack/src/index';

export default defineKuaishouMaterials({
  appid: process.env.KUAISHOU_APPID ?? 'kwai_game_test_appid',
  projectName: 'difference-hunt',
  rewardedAdUnitId: process.env.KUAISHOU_REWARDED_AD_UNIT_ID,
  iconPath: 'icon.png',
});
