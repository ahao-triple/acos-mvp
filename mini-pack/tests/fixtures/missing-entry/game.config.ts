import { defineGameConfig } from '../../../src/index.js';

export default defineGameConfig({
  title: '共联防线',
  entry: 'game/src/main.ts',
  publicDir: 'game/public',
  orientation: 'portrait',
  canvas: {
    width: 750,
    height: 1334,
  },
});
