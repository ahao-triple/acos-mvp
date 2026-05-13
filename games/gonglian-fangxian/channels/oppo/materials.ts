import { defineOppoMaterials } from "../../../../mini-pack/src/index";

export default defineOppoMaterials({
  packageName: "com.jnsy.qmbg.oppominigame",
  iconPath: "icon.png",
  versionName: "1.0.0",
  versionCode: 1,
  // TODO(oppo): replace with the production OPPO rewarded video ad unit id.
  rewardedAdUnitId: "oppo-rewarded-placeholder",
  // TODO(oppo): replace with the production OPPO release signing directory.
  releaseSignDir: "../../oppo-pem",
  homePage: "/logo.png",
});
