import { defineGameConfig } from '../../mini-pack/src/index';

export default defineGameConfig({
  title: '就你眼神好',
  entry: 'game/src/main.ts',
  publicDir: 'game/public-pack',
  orientation: 'portrait',
  canvas: { width: 750, height: 1334 },
  serverBaseUrl: 'https://ks-games.xfyccm.cn/api',
});
