import { defineGameConfig } from '../../../src/index';

export default defineGameConfig({
  title: 'Fixture Game',
  entry: 'game/main.ts',
  publicDir: 'game/public-pack',
  orientation: 'portrait',
  canvas: { width: 750, height: 1334 },
});
