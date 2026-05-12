import { defineGameConfig } from '../../mini-pack/src/index';

export default defineGameConfig({
  title: '共联防线软件',
  entry: 'game/src/main.ts',
  publicDir: 'game/public-pack',
  orientation: 'portrait',
  canvas: { width: 750, height: 1334 },
  serverBaseUrl: process.env.SERVER_BASE_URL || 'https://ks-games.xfyccm.cn/api',
});
