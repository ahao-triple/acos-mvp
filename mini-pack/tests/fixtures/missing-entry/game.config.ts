import { defineGameConfig } from '../../../src/index.js';

export default defineGameConfig({
  title: '共联防线',
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
    appid: '',
    projectName: 'gonglian-fangxian',
  },
});
