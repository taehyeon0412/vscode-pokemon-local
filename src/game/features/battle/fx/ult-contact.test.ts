/**
 * 하드플랜트 쓰러짐 = 큰 덩굴이 닿는 때 (ideas 719 · orders #149 · U2 표시 = 실제)
 * 3:3 장면 전환 · 합동은 박자표 (메가진화 펑을 자기 둘레 터짐으로 잼 → 기운 줄기에 피해) 대신 1:1 처럼 처음 닿는 때 · 덩굴은 몸 밑에서 솟는 것만 맞힘
 * ult/*.js 는 묶음 (main-bundle) 으로만 돌아 줄을 읽어 셈
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(__dirname, '../../../../..');
const bridge = readFileSync(join(root, 'ult/bridge.js'), 'utf8');
const sky = readFileSync(join(root, 'ult/fx-sky.js'), 'utf8');
const bundle = readFileSync(join(root, 'extension/media/main-bundle.js'), 'utf8');

const CONTACT = "const fxContactHit = (e) => !!e?.[2]?.venus && e[1] === 'ultpillar';";
const NEXT = '!(next && Math.abs(r.x - next.x) < dx)';

describe('하드플랜트 — 큰 덩굴이 닿는 때 피해 · 쓰러짐', () => {
  it('닿는 때로 피해 = 이상해꽃 하드플랜트만 (솔라빔 · 다른 포켓몬 하드플랜트는 박자표 그대로)', () => {
    expect(bridge).toContain(CONTACT);
    const contact = new Function(`${CONTACT} return fxContactHit;`)() as (e: unknown) => boolean;
    expect(contact(['하드플랜트', 'ultpillar', { kind: 'vine', c: 'grass', venus: 1, tc: 'grass' }])).toBe(true);
    expect(contact(['솔라빔', 'ultbeam', { c: 'solar', venus: 1, tc: 'solar' }])).toBe(false);
    expect(contact(['하드플랜트', 'ultpillar', { kind: 'vine', n: 4 }])).toBe(false);
    expect(contact(['하드플랜트', 'ultbloom', { mode: 'vine' }])).toBe(false);
    expect(contact(undefined)).toBe(false);
  });

  it('3:3 — 닿는 때면 처음 맞음에 피해 (기운 줄기 · 박자표 타이머 없음) · 못 닿으면 큰 맞음 1초 뒤 한 번', () => {
    expect(bridge).toContain('const contact = !!tm && fxContactHit(entry);');
    expect(bridge).toContain('onHit: tm && !contact ? null : onHit');
    // 닿는 때 갈래가 자기 둘레 줄기 · 타이머 갈래보다 먼저
    const at = bridge.indexOf('if (contact) {');
    expect(at).toBeGreaterThan(0);
    expect(bridge.indexOf('} else if (tm.self && tm.flash >= 0) {')).toBeGreaterThan(at);
    expect(bridge.slice(at, at + 400)).toMatch(/if \(fxGame === g && !g\.hit\) \{\s*g\.hit = true;\s*hitNow\(\);/);
    // 못 닿을 때 = 덩굴 파도 끝 · 박자표 큰 맞음 가운데 늦은 쪽 1초 뒤 (박자표를 다시 재 큰 맞음이 메가진화 펑이 돼도 덩굴보다 먼저 쓰러지지 않게)
    expect(bridge.slice(at, at + 400)).toContain('Math.max(at, charge + introMs + shift + FX_CONTACT_WAVE_MS) + FX_CONTACT_LATE_MS');
    expect(Number(bridge.match(/const FX_CONTACT_LATE_MS = (\d+);/)?.[1])).toBe(1000);
  });

  it('덩굴 파도 끝 (FX_CONTACT_WAVE_MS) = runHardPlant 마지막 덩굴 (TS + 0.15 + GAP × (NV − 1))', () => {
    const run = sky.slice(sky.indexOf('function runHardPlant('));
    const num = (re: RegExp) => Number(run.match(re)?.[1]);
    const last = (num(/const TS = ([\d.]+) \+ XG;/) + 0.15 + num(/const GAP = ([\d.]+);/) * (num(/const NV = (\d+);/) - 1)) * 1000;
    expect(run).toContain('const TV = TS + 0.15;');
    expect(Number(bridge.match(/const FX_CONTACT_WAVE_MS = (\d+);/)?.[1])).toBe(Math.round(last));
  });

  it('합동 — 마무리 고리 · 파편도 실제로 닿을 때 (박자표 시각 타이머 아님)', () => {
    expect(bridge).toMatch(/const onHitJ = contact \? \(\) => \{\s*onHit\?\.\(\);\s*finale\?\.\(\);\s*\} : onHit;/);
    expect(bridge).toContain('this.ult(lead.s, dst, onHitJ, ');
    expect(bridge).toMatch(/if \(contact\) \{\s*finale = ring;\s*\} else \{\s*setTimeout\(ring, hitAt\);/);
  });

  it('덩굴은 몸 밑에서 솟는 것만 맞힘 — 다음 덩굴이 더 가까우면 그때 (한 칸 앞 덩굴에 0.15초 일찍 맞던 것)', () => {
    const run = sky.slice(sky.indexOf('function runHardPlant('));
    const loop = run.slice(0, run.indexOf("hit(r, vd, 'lift');"));
    expect(loop).toContain('const next = spots[i + 1];');
    expect(loop).toContain(`if (dx < sp.w * 3 + r.w * 0.5 && ${NEXT}) {`);
  });

  it('묶음에도 들어감 (make-moves.py)', () => {
    expect(bundle).toContain(CONTACT);
    expect(bundle).toContain('onHit: tm && !contact ? null : onHit');
    expect(bundle).toContain(NEXT);
  });
});
