// 게임 모드 빌드 — src/game 을 묶어 extension/ 안으로 (사용자 PC 에서는 빌드하지 않음, vsix 에 결과만 들어감)
//
//   node scripts/build.mjs             개발용 (소스맵 있음)
//   node scripts/build.mjs --release   설치 · 릴리스용 (줄임, 소스맵 없음) — install.py 가 부름
//   node scripts/build.mjs --watch     고칠 때마다 다시 묶음 (F5 개발 창)
//   node scripts/build.mjs --tests     + 실제 VS Code 테스트 묶음 (.test-out/)
//   node scripts/build.mjs --release --tests --host-only   확장 쪽 (host.js) + 테스트 묶음만 — 웹뷰 묶음 (media/game) 은 그대로 (시험 창 캡처가 도는 중에도 dev/vscode-shot.py 를 돌리게)
import * as esbuild from 'esbuild';
import { rmSync, statSync } from 'node:fs';
import { relative } from 'node:path';

const args = new Set(process.argv.slice(2));
const release = args.has('--release');
const watch = args.has('--watch');
const tests = args.has('--tests');
const hostOnly = args.has('--host-only');

// VS Code 1.73 (package.json engines) = Electron 19 → 확장 쪽 Node 16 · 웹뷰 Chromium 102
const common = {
  bundle: true,
  minify: release,
  sourcemap: release ? false : 'linked',
  charset: 'utf8',
  legalComments: 'none',
  logLevel: watch ? 'silent' : 'info',
};

const targets = [
  {
    ...common,
    entryPoints: ['src/game/host/index.ts'],
    outfile: 'extension/out/game/host.js',
    platform: 'node',
    format: 'cjs',
    target: 'node16',
    external: ['vscode'],
  },
  {
    ...common,
    entryPoints: ['src/game/webview/boot.ts'],
    outfile: 'extension/media/game/boot.js',
    platform: 'browser',
    format: 'iife',
    target: 'chrome102',
  },
  {
    ...common,
    entryPoints: ['src/game/webview/main.ts'],
    outfile: 'extension/media/game/game.js',
    platform: 'browser',
    format: 'iife',
    target: 'chrome102',
    jsx: 'automatic',
    jsxImportSource: 'preact',
    // game.css 의 글꼴 url(../fonts/…) 은 묶지 않고 그대로 — 글꼴은 extension/media/fonts/ 에 (scripts/fetch-fonts.mjs)
    external: ['*.woff2'],
  },
];

if (tests) {
  const testCommon = { ...common, minify: false, sourcemap: 'inline', platform: 'node', format: 'cjs' };
  targets.push(
    {
      ...testCommon,
      entryPoints: ['src/test/integration/run-integration.ts'],
      outfile: '.test-out/run-integration.cjs',
      target: 'node20',
      external: ['@vscode/test-electron'],
    },
    {
      ...testCommon,
      entryPoints: ['src/test/integration/suite.ts'],
      outfile: '.test-out/integration-suite.cjs',
      target: 'node16',
      external: ['vscode'],
    },
    // 실제 VS Code 캡처 (기획 R17 — dev/vscode-shot.py)
    {
      ...testCommon,
      entryPoints: ['src/test/integration/run-shot.ts'],
      outfile: '.test-out/run-shot.cjs',
      target: 'node20',
      external: ['@vscode/test-electron'],
    },
    {
      ...testCommon,
      entryPoints: ['src/test/integration/shot-suite.ts'],
      outfile: '.test-out/shot-suite.cjs',
      target: 'node16',
      external: ['vscode'],
    },
  );
}

// 지난 빌드의 남은 파일 (예: 개발용 .map) 이 설치본에 섞이지 않게 비우고 시작
// --host-only: 웹뷰 묶음은 지우지도 다시 묶지도 않음
if (hostOnly) targets.splice(0, targets.length, ...targets.filter((t) => !t.outfile.startsWith('extension/media/game/')));
for (const dir of [...(hostOnly ? [] : ['extension/out/game', 'extension/media/game']), ...(tests ? ['.test-out'] : [])]) {
  rmSync(dir, { recursive: true, force: true });
}

if (watch) {
  // F5 개발 창이 빌드를 기다릴 수 있게 시작 · 끝을 알림 (.vscode/tasks.json 의 problemMatcher)
  // 묶음이 여러 개라, 하나라도 도는 동안은 "started", 모두 끝나면 "finished"
  let active = 0;
  const report = {
    name: 'watch-report',
    setup(build) {
      build.onStart(() => {
        if (active++ === 0) console.log('[watch] build started');
      });
      build.onEnd((result) => {
        for (const e of result.errors) {
          const loc = e.location;
          const where = loc ? `${relative(process.cwd(), loc.file)}:${loc.line}:${loc.column + 1}` : 'unknown:1:1';
          console.log(`[watch] error: ${where}: ${e.text}`);
        }
        if (--active === 0) console.log('[watch] build finished');
      });
    },
  };
  const contexts = await Promise.all(targets.map((t) => esbuild.context({ ...t, plugins: [report] })));
  await Promise.all(contexts.map((ctx) => ctx.watch()));
} else {
  await Promise.all(targets.map((t) => esbuild.build(t)));
  // 일반 모드 묶음 (media/main-bundle.js — make-moves.py 가 만드는 3.4 MB · 주석 그대로) 을 설치본용으로 줄여 따로 (#140 4/5 — 처음 켜기 · 메모리):
  //   이름은 그대로 (띄어쓰기 · 주석 · 문법만 줄임) · 저장소에는 안 올림 (.gitignore) · 첫 줄에 원본 크기 — 확장은 크기가 같을 때만 줄인 판을 씀 (extension.js mainBundleName)
  const minOut = 'extension/media/main-bundle.min.js';
  if (release && !hostOnly) {
    const size = statSync('extension/media/main-bundle.js').size;
    await esbuild.build({ entryPoints: ['extension/media/main-bundle.js'], outfile: minOut, bundle: false, minifyWhitespace: true, minifySyntax: true, charset: 'utf8', legalComments: 'none', logLevel: 'error', target: 'chrome102', banner: { js: `// main-bundle.js ${size}` } });
  } else if (!hostOnly) {
    // 개발 빌드 — 줄인 판을 지워 원본을 씀 (make-moves 로 고친 연출이 바로 보이게)
    rmSync(minOut, { force: true });
  }
}
