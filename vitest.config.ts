import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // `.audit/` is the scratch area for data audits: captured competitor
    // bundles, before/after snapshots, and throwaway probe scripts. Anything
    // named *.test.ts in there is scaffolding, not part of the suite, and
    // collecting it would make `npm test` depend on scratch state.
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '.audit/**',
      // Playwright specs match vitest's default `*.spec.ts` glob; running them
      // here would try to drive a browser from the unit-test runner.
      'e2e/**',
      '**/.{idea,git,cache,output,temp}/**',
      '**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build,eslint,prettier}.config.*',
    ],
  },
});
