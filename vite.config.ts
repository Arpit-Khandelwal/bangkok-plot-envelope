import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  worker: { format: 'es' },
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
    // Timing budgets are only meaningful without 40 other test files competing for the CPU.
    // They run on their own with `pnpm test:perf`.
    exclude: process.env.PERF_TESTS ? [] : ['src/**/*.perf.test.ts'],
  },
});
