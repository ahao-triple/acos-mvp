import { defineConfig } from 'vitest/config';

export default defineConfig({
  publicDir: 'public-runtime',
  server: {
    host: '127.0.0.1',
    port: 5174,
  },
  test: {
    environment: 'node',
  },
});
