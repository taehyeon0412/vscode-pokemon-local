// @ts-check
// 코드 규칙 검사 — 특히 층 사이 의존 방향 (core → features → host · webview 한 방향, src/game/README.md)
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

/** 가져오면 안 되는 것 — 이름 → 정규식 · 이유 */
const BAN = {
  vscode: { regex: '^vscode$', message: 'VS Code 는 확장 쪽(host)에서만 써요.' },
  preact: { regex: '^preact(/.*)?$', message: '화면 컴포넌트(preact)는 ui · features/*/components · webview 에서만 써요.' },
  node: { regex: '^(node:)?(fs|path|os|child_process|crypto|util)$', message: '규칙 · 상태(core)는 Node 를 모르게 — 확장 쪽 · 웹뷰 쪽 어디서든 돌아야 해요.' },
  host: { regex: '(^|/)host(/|$)', message: '확장 쪽(host)은 다른 층이 가져오지 않아요.' },
  webview: { regex: '(^|/)webview(/|$)', message: '웹뷰 쪽(webview)은 다른 층이 가져오지 않아요.' },
  ui: { regex: '(^|/)ui(/|$)', message: '공통 부품(ui)은 화면 층에서만 가져와요.' },
  components: { regex: '(^|/)components(/|$)', message: '화면 컴포넌트는 화면 층에서만 가져와요.' },
  features: { regex: '(^|/)features(/|$)', message: '규칙 · 상태(core)는 기능(features)을 모르게 — 의존은 core → features 한 방향이에요.' },
  core: { regex: '(^|/)core(/|$)', message: '데이터(data)는 가장 아래 층 — 규칙 · 상태(core)를 가져오지 않아요.' },
  shared: { regex: '(^|/)shared(/|$)', message: '규칙 · 상태(core)는 메시지(shared)를 모르게 — shared 가 core 를 가져와요.' },
};

/** @param {(keyof typeof BAN)[]} names */
const ban = (...names) => ({
  'no-restricted-imports': ['error', { patterns: names.map((n) => BAN[n]) }],
});

export default tseslint.config(
  {
    ignores: [
      'node_modules/**', 'extension/**', 'dist/**', '.test-out/**', '.vscode-test/**',
      'dev/**', 'ult/**', 'moves.js', 'docs/**', 'moves-data/**',
      // 팀 워크트리 (저장소의 다른 사본 — 그 안에서 따로 검사, collab-worktree.md)
      '.claude/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': 'error',
      eqeqeq: ['error', 'always'],
      'no-console': ['error', { allow: ['warn', 'error'] }],
    },
  },
  // 데이터는 가장 아래 층 — 아무것도 가져오지 않음
  { files: ['src/game/data/**'], rules: ban('vscode', 'preact', 'node', 'host', 'webview', 'ui', 'components', 'features', 'shared', 'core') },
  { files: ['src/game/core/**'], rules: ban('vscode', 'preact', 'node', 'host', 'webview', 'ui', 'components', 'features', 'shared') },
  { files: ['src/game/shared/**'], rules: ban('vscode', 'preact', 'node', 'host', 'webview', 'ui', 'components', 'features') },
  // boot.js (일반 모드에서도 포켓몬 보기가 뜰 때마다 읽힘) 에 들어가는 메시지 파일 — 게임 코드 (core) 는 type 으로만 (값으로 가져오면 엔진 · 데이터가 통째로 딸려 감 — 코드 리뷰어)
  {
    files: ['src/game/shared/messages.ts', 'src/game/webview/boot.ts', 'src/game/webview/vscode-api.ts'],
    rules: {
      '@typescript-eslint/no-restricted-imports': ['error', {
        patterns: [{ regex: '^(?!.*/core/engine/notices$).*(^|/)(core|data)(/|$)', allowTypeImports: true, message: 'boot.js 에 들어가는 파일 — 게임 코드는 type 으로만 (값은 core/engine/notices 처럼 가져오는 것이 없는 파일에서)' }],
      }],
    },
  },
  { files: ['src/game/features/**/model.ts', 'src/game/features/**/model/**'], rules: ban('vscode', 'preact', 'node', 'host', 'webview', 'ui', 'components') },
  { files: ['src/game/ui/**', 'src/game/features/**/components/**'], rules: ban('vscode', 'node', 'host', 'webview') },
  { files: ['src/game/webview/**'], rules: ban('vscode', 'node', 'host') },
  {
    files: ['src/game/host/**'],
    rules: {
      ...ban('preact', 'webview', 'ui', 'components'),
      // VS Code 1.73 의 확장 쪽은 Node 16 — 타입(@types/node 18)에는 있어도 실제로는 없는 것
      'no-restricted-globals': ['error',
        { name: 'structuredClone', message: 'Node 16 (VS Code 1.73)에는 없어요.' },
        { name: 'fetch', message: 'Node 16 (VS Code 1.73)에는 없어요.' },
      ],
    },
  },
  {
    // 도구 스크립트 · 테스트는 Node 에서 돌고 console 로 알림
    files: ['scripts/**', 'src/test/**'],
    languageOptions: { globals: { process: 'readonly', console: 'readonly', __dirname: 'readonly', fetch: 'readonly' } },
    rules: { 'no-console': 'off' },
  },
);
