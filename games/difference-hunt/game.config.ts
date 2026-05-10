import { defineGameConfig } from "../../mini-pack/src/index";

export default defineGameConfig({
  title: "就你眼神好",
  platform: "vivo",
  entry: "game/src/main.ts",
  publicDir: "game/public-pack",
  outDir: "builds/vivo",
  orientation: "portrait",
  canvas: {
    width: 750,
    height: 1334,
  },
  douyin: {
    appid: process.env.DOUYIN_APPID ?? "",
    projectName: "difference-hunt",
    rewardedAdUnitId: process.env.DOUYIN_REWARDED_AD_UNIT_ID ?? "",
  },
  vivo: {
    packageName: "com.jnsy.jnysh.vivominigame",
    iconPath: "game/public-pack/icon.png",
  },
});
