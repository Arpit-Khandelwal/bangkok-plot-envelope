import type { HtmlTagDescriptor, Plugin } from 'vite';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

const MAP_MODULE = 'src/map/MapView.tsx';

/**
 * Build-only page-load tuning for index.html:
 *  - the app stylesheet no longer blocks the first paint (index.html carries the critical CSS
 *    inline; src/main.tsx waits for the sheet before replacing the static shell);
 *  - the lazy map chunk, the chunks it imports and its stylesheet are preloaded in parallel with
 *    the entry script, instead of only after the entry has run and called import().
 */
function pageLoadHints(): Plugin {
  return {
    name: 'page-load-hints',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html, context) {
        const bundle = context.bundle ?? {};
        const chunks = Object.values(bundle).filter((output) => output.type === 'chunk');
        const mapChunk = chunks.find((chunk) => chunk.facadeModuleId?.endsWith(MAP_MODULE));
        const tags: HtmlTagDescriptor[] = [];

        const url = (fileName: string) => `/${fileName}`;

        if (mapChunk) {
          const entry = chunks.find((chunk) => chunk.isEntry);
          const alreadyLoaded = new Set(entry ? [entry.fileName, ...entry.imports] : []);
          const mapFiles = [mapChunk.fileName, ...mapChunk.imports.filter((file) => !alreadyLoaded.has(file))];
          for (const file of mapFiles) {
            tags.push({ tag: 'link', attrs: { rel: 'modulepreload', crossorigin: '', fetchpriority: 'low', href: url(file) }, injectTo: 'head' });
          }
          for (const css of mapChunk.viteMetadata?.importedCss ?? []) {
            tags.push({ tag: 'link', attrs: { rel: 'preload', as: 'style', crossorigin: '', fetchpriority: 'low', href: url(css) }, injectTo: 'head' });
          }
        }

        const deferred = html.replace(
          /<link rel="stylesheet" crossorigin href="(\/assets\/[^"]+\.css)">/g,
          (_match, href: string) =>
            `<link rel="stylesheet" crossorigin href="${href}" media="print" onload="this.media='all'" data-app-css>` +
            `<noscript><link rel="stylesheet" crossorigin href="${href}"></noscript>`,
        );
        return { html: deferred, tags };
      },
    },
  };
}

export default defineConfig({
  plugins: [react(), pageLoadHints()],
  worker: { format: 'es' },
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
    // Correctness tests must not fail because the machine is busy. Timing budgets live in the
    // *.perf tests, which run on their own.
    testTimeout: 60_000,
    // Timing budgets are only meaningful without 40 other test files competing for the CPU.
    // They run on their own with `pnpm test:perf`.
    exclude: process.env.PERF_TESTS ? [] : ['src/**/*.perf.test.ts'],
  },
});
