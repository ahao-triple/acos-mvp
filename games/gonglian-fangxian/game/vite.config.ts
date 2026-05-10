import { defineConfig } from 'vitest/config';

export default defineConfig({
  publicDir: 'public-pack',
  server: {
    host: '127.0.0.1',
    port: 5173,
  },
  test: {
    environment: 'jsdom',
  },
});
