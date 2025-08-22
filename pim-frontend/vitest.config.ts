import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/unit/**/*.spec.ts'],
  },
  css: {
    // Override PostCSS to avoid loading project postcss.config during unit tests
    postcss: { plugins: [] },
  },
});
