import { defineConfig } from 'vitest/config';

// 자동 테스트 — 계산 규칙 · 세이브 · 확장 ↔ 웹뷰 흐름 (VS Code 없이 몇 초 안에)
// 실제 VS Code 를 띄우는 테스트는 npm run test:integration (src/test/integration)
export default defineConfig({
  esbuild: { jsx: 'automatic', jsxImportSource: 'preact' },
  test: {
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    environment: 'node',
  },
});
