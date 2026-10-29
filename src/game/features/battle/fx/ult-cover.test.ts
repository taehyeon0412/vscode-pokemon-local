/**
 * 대상 다시 그리기 (#107 — 필살기가 맞는 포켓몬을 0.5초 넘게 덮지 않게, 기획 10-25 · 디자인 값)
 * ult/bridge.js 는 묶음 (main-bundle) 으로만 돌아 줄을 읽어 셈 · 구간 데이터 ult/ult-cover.json 은 dev/ult-cover.py --data · --write-data 가 만듦
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(__dirname, '../../../../..');
const bridge = readFileSync(join(root, 'ult/bridge.js'), 'utf8');
const tool = readFileSync(join(root, 'dev/ult-cover.py'), 'utf8');
const KEY_FILTER = "filter((k) => k !== 'c' && k !== 'track')";

describe('대상 다시 그리기', () => {
  it('열쇠 = 틀 · 옵션 (색 · track 빼고) — 다리와 재는 도구가 같은 식', () => {
    expect(bridge).toContain(KEY_FILTER);
    expect(tool).toContain(KEY_FILTER);
  });

  it('맞는 모습 = 디자인 값 (±2px · 0.12초마다 · 0.6초만 · 흰 실루엣 0.06초 한 번 — 깜빡임 1초 3번 아래)', () => {
    const m = bridge.match(/const FX_COVER_SHAKE = \{ px: ([\d.]+), step: ([\d.]+), sec: ([\d.]+), white: ([\d.]+) \};/);
    expect(m).not.toBeNull();
    const [px, step, sec, white] = m!.slice(1).map(Number);
    expect(px).toBe(2);
    expect(step).toBe(0.12);
    expect(sec).toBe(0.6);
    expect(white).toBeLessThanOrEqual(0.06);
    expect(bridge).toContain("const FX_COVER_RIM = '#1a1626';");
  });

  it('쓰러진 뒤 — 장 끝마다 쓰러진 그림 모양 + 1칸 위 연출을 지움 (1:1 벌러덩 · 회색 · 3:3 쓰러짐 · 다시 그리기 뒤 누운 모습이 덮이던 것 · 2칸째 바둑판 테는 톱니로 보여 뺌)', () => {
    expect(bridge).toMatch(/fxCutDown\(now\);\s*fxOnTopDraw\(now\);/);
    expect(bridge).toContain(".pg-fighter[data-ko] .pg-fx-body");
    expect(bridge).toContain("'pg-fainted'");
    expect(bridge).toContain("'pg-down'");
    expect(bridge).toContain("'pg-ko-late'");
    expect(bridge).toMatch(/for \(const q of fxGameDown\(\)\)/);
    expect(Number(bridge.match(/const FX_DOWN_PAD = (\d+);/)?.[1])).toBe(1);
    // 쓰러진 그림 자리는 화면 판 없이 (어둠만 깔면 검은 그림자) · 넘어짐을 기다리는 동안은 다시 그리기를 이어감
    expect(bridge).toMatch(/fxDownShape\(O, el, 0\)/);
    expect(bridge).toMatch(/ms \+ FX_COVER_WAIT_MS, gen/);
  });

  it('쓰러진 칸 지우기 뒤 — 화면 전체 판 · 꼭두각시를 지운 칸에 다시 (밝은 · 어두운 네모 자국 · 내리꽂는 몸이 일자로 잘리던 것, 디자인 UX 2 · 3바퀴)', () => {
    for (const f of ['ult/fx-sky.js', 'ult/fx-body.js', 'ult/duel-body.js']) {
      expect(readFileSync(join(root, f), 'utf8')).toMatch(/fxMonNote\(ctx, /);
    }
    const body = bridge.slice(bridge.indexOf('function fxCutDown()'));
    // 지울 모양 = 쓰러진 그림 모양 (네모 아님) → 그 안에 화면 전체 판 · 꼭두각시 → 모양으로 잘라 붙임
    expect(body).toMatch(/fxDownShape\(M, el, FX_DOWN_PAD\)/);
    expect(body.indexOf('fxScreenLayer(p)')).toBeLessThan(body.indexOf('fxMonDraws'));
    expect(body.indexOf('fxMonDraws')).toBeLessThan(body.indexOf("'destination-in'"));
    // 꼭두각시를 그리는 판 — 큰 캔버스 · 위 끝 층 · 합동 층 · 무대 상자 · 줄기 보기 (헤비봄버 꼭두각시는 위 끝 층에 그려져 못 적던 것)
    const main = bridge.slice(bridge.indexOf('function fxMainCtx'), bridge.indexOf('function fxMonNote'));
    for (const want of ['moveCtx', 'fxSoftTopL.ctx', 'fxJointTop.top.ctx', 'moveFrame.ctx', 'fxBeamView']) {
      expect(main).toContain(want);
    }
  });

  it('넘어짐 시작 — 늦게 넘어지는 판 이름까지 (pg-ko-late · pg-ko-down-late · pg-faint-late)', () => {
    const fn = bridge.slice(bridge.indexOf('function fxKoStarted'), bridge.indexOf('function fxCutDown'));
    const re = new RegExp(fn.match(/\/(\^pg-[^/]+)\//)?.[1] ?? '$^');
    for (const name of ['pg-ko', 'pg-ko-late', 'pg-ko-down', 'pg-ko-down-late', 'pg-faint-late']) {
      expect(re.test(name)).toBe(true);
    }
    const css = readFileSync(join(root, 'src/game/webview/game.css'), 'utf8');
    for (const m of css.matchAll(/animation-name: (pg-[\w-]+) !important/g)) {
      if (/ko|faint/.test(m[1] ?? '')) {
        expect(re.test(m[1] ?? '')).toBe(true);
      }
    }
  });

  it('위 끝 띠 — 줄마다 정확히 25 · 50 · 75 · 87.5% 남음 (어느 위 끝 · 칸 자리에서도)', () => {
    const fill = JSON.parse(bridge.match(/const FX_SOFT_FILL = (\[[^\]]+\]);/)?.[1] ?? '[]') as number[];
    const ord = JSON.parse(bridge.match(/const FX_SOFT_ORD8 = (\[[^\]]+\]);/)?.[1] ?? '[]') as number[];
    expect(fill).toEqual([0.25, 0.5, 0.75, 0.875]);
    for (let r = 0; r < fill.length; r++) {
      for (let x0 = 0; x0 < 8; x0++) {
        let keep = 0;
        for (let cx = x0; cx < x0 + 8; cx++) {
          keep += (ord[(cx + 3 * r) % 8] ?? 8) < (fill[r] ?? 0) * 8 ? 1 : 0;
        }
        expect(keep / 8).toBe(fill[r]);
      }
    }
    expect(bridge).toContain('FX_SOFT_ORD8[(cx + 3 * r) % 8] >= FX_SOFT_FILL[r] * 8');
  });

  it('필살기를 쓰는 쪽 HP 판은 바둑판 반 (완전히 숨기지 않음) — 연출이 판 아래로 깔리던 것', () => {
    const layer = readFileSync(join(root, 'src/game/features/battle/components/BattleLayer.tsx'), 'utf8');
    const css = readFileSync(join(root, 'src/game/webview/game.css'), 'utf8');
    expect(layer).toContain("under={b.anim?.action.kind === 'ult' && b.anim.side === 'me'}");
    expect(layer).toContain("under={b.anim?.action.kind === 'ult' && b.anim.side === 'foe'}");
    expect(css).toMatch(/\.pg-ult-under \{[^}]*mask-image: conic-gradient/);
    expect(css).not.toMatch(/\.pg-ult-under \{[^}]*(display: none|visibility: hidden|opacity: 0)/);
  });

  it('구간 데이터 — 본편 시작부터 0 넘게 · 길이 0.3초 넘게 · 1:1 (o) · 합동 (j)', () => {
    const path = join(root, 'ult/ult-cover.json');
    if (!existsSync(path)) return;
    const data = JSON.parse(readFileSync(path, 'utf8')) as Record<string, { o?: number[][]; j?: number[][] }>;
    for (const [key, v] of Object.entries(data)) {
      expect(() => JSON.parse(key)).not.toThrow();
      for (const runs of [v.o, v.j]) {
        for (const [a, n] of runs ?? []) {
          expect(a).toBeGreaterThanOrEqual(0);
          expect(n).toBeGreaterThanOrEqual(300);
        }
      }
    }
  });
});

describe('맞는 동안 대상 다시 그리기 — 꺼 둠 (#115 태현 님)', () => {
  it('FX_COVER_REDRAW = false · 데이터 · 그리는 코드는 남김 (켜고 끄는 값 하나)', () => {
    expect(bridge).toContain('const FX_COVER_REDRAW = false;');
    expect(bridge).toMatch(/fxInGame\(\) && \(FX_COVER_REDRAW \|\| window\.__fxCoverRedraw\)/);
    expect(bridge).toContain('function fxCoverRedraw(');
    expect(existsSync(join(root, 'ult/ult-cover.json'))).toBe(true);
  });
});

describe('필살기 동안 숨긴 진짜 그림 (#97 · bugs 1819)', () => {
  it('고정 칸 상자를 숨김 (게임이 그림을 다시 그려도 그대로) · ultHide(false) · 끝 타이머 · 연출 멈춤 (fxGameStop) 에 풂', () => {
    expect(bridge).toMatch(/ultHide = function \(pokemon, on\)/);
    expect(bridge).toMatch(/box\.style\.visibility = 'hidden';/);
    expect(bridge).toMatch(/const FX_HIDE_MAX_MS = \d+;/);
    expect(bridge).toMatch(/function fxGameStop\(kill\) \{\s*\/\/[^\n]*\n\s*fxHideAll\(\);/);
  });
  it('다이브 필살기는 게임 화면에서 끝에 제자리로 (bugs 1818)', () => {
    const body = readFileSync(join(root, 'ult/fx-body.js'), 'utf8');
    expect(body).toMatch(/pp\.home = ret \? \[xs, ys\] : \[tx, ty\];/);
    expect(body).toMatch(/pp\.finish\(pp\.home\[0\], pp\.home\[1\]\)/);
  });
});

describe('필살기를 멈춘 뒤 남은 꼭두각시 (bugs 2707)', () => {
  it('stopUlt 때 살아 있던 입자는 포켓몬 그림을 안 그림 (진짜 그림이 숨어 있으면 그대로) — 그리는 곳 셋 (fx-sky drawMon · fx-body · duel-body drawSprite) 모두', () => {
    expect(bridge).toMatch(/stopUlt\(\) \{[\s\S]{0,300}q\._noMon = true;[\s\S]{0,80}fxGameStop\(true\);/);
    expect(bridge).toContain("img.style.opacity === '0' || img.style.visibility === 'hidden'");
    for (const f of ['ult/fx-sky.js', 'ult/fx-body.js', 'ult/duel-body.js']) {
      expect(readFileSync(join(root, f), 'utf8'), f).toMatch(/typeof fxMonSkip === 'function' && fxMonSkip\(/);
    }
  });
});
