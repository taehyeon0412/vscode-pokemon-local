import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { sampleMonster, sampleSave } from '../../../../test/fixtures/save';
import { startBattle, type BattleAction, type BattleState } from '../../../core/engine/battle';
import { createGameState, type GameState } from '../../../core/engine';
import { TIMING } from '../../../core/balance';
import { battleAnimKey } from './hold';
import { clearImpact, hurtEarlyAt, setHurtEarly, setImpact, setUltSkip, spaceInput, ultSkippable } from './parry';

/** 전투 중 행동 하나 (side · 행동) 가 도는 상태 */
function inAction(side: 'me' | 'foe', action: BattleAction): { state: GameState; b: BattleState } {
  const wild = sampleMonster({ uid: 'w', species: 4, form: 'charmander', caughtAt: 'forest-1' });
  const save = sampleSave({ pendingEncounter: { kind: 'wild', monster: wild, start: 'normal' } });
  const b0 = startBattle(save, wild, 'normal');
  const b: BattleState = { ...b0, phase: 'anim', anim: { side, action, ms: 100, dur: 900, counter: false } };
  const s = createGameState(save, 1);
  return { b, state: { ...s, runtime: { ...s.runtime, stageId: 'forest-1', stage: { phase: 'battle', battle: b } } } };
}

describe('Space — 패링 · 필살기 건너뛰기 (fx/parry)', () => {
  afterEach(() => {
    setUltSkip(null);
    clearImpact();
  });

  it('상대 공격 중 맞는 순간을 알면 패링 (맞기까지 남은 ms), 모르면 그냥 Space', () => {
    const { state, b } = inAction('foe', { kind: 'attack' });
    expect(spaceInput(state, 0)).toEqual({ kind: 'space' });
    setImpact(battleAnimKey(b), 500, 0);
    expect(spaceInput(state, 380)).toEqual({ kind: 'battle', input: { kind: 'parry', ms: 120 } });
  });

  it('필살기 연출 중 Space = 건너뛰기를 한 번만 부름 (2026-10-20) — 필살기가 아니면 안 부름', () => {
    let n = 0;
    setUltSkip(() => {
      n += 1;
    });
    const move = inAction('me', { kind: 'move', moveId: 52 });
    expect(spaceInput(move.state, 0)).toEqual({ kind: 'space' });
    expect(n).toBe(0);
    const ult = inAction('me', { kind: 'ult' });
    // 화면 "Space 넘기기" 칸 — 다시 보는 필살기 (quick) 이고 그 행동일 때만
    expect(ultSkippable(ult.b)).toBe(false);
    setUltSkip(() => {
      n += 1;
    }, battleAnimKey(ult.b), true);
    expect(ultSkippable(ult.b)).toBe(true);
    expect(ultSkippable(move.b)).toBe(false);
    expect(spaceInput(ult.state, 0)).toEqual({ kind: 'space' });
    expect(ultSkippable(ult.b)).toBe(false);
    expect(spaceInput(ult.state, 0)).toEqual({ kind: 'space' });
    expect(n).toBe(1);
  });
});

describe('닿는 기술 박자 (bugs 1903 ~ 1905 · ux-rules U2 · 원칙 4)', () => {
  const css = readFileSync(join(__dirname, '../../../webview/game.css'), 'utf8');
  const fxSrc = readFileSync(join(__dirname, '../components/BattleFx.ts'), 'utf8');
  const frames = (name: string): string => {
    const at = css.indexOf(`@keyframes ${name} {`);
    expect(at).toBeGreaterThanOrEqual(0);
    return css.slice(at, css.indexOf('\n}', at));
  };
  const contactAt = Number(fxSrc.match(/const CONTACT_AT = ([\d.]+);/)?.[1]);
  const lag = Number(fxSrc.match(/const CONTACT_IMPACT_LAG_MS = (\d+);/)?.[1]);
  it('달려들기 — 자국 · 패링 원 (CONTACT_AT) 때 몸이 상대에 닿아 있고 · 돌아가기는 다가가기의 1/3 넘게 (한 장면에 3배 넘게 튀지 않게) · 96% 에 다 돌아옴', () => {
    const k = frames('pg-lunge');
    const [rest, arrive, leave, back] = k.match(/0%, (\d+)% \{[^}]*\}\s*(\d+)% \{[^}]*--pg-dx[^}]*\}[\s\S]*?(\d+)% \{[^}]*--pg-dx[^}]*linear[^}]*\}[\s\S]*?(\d+)%, 100% \{/)!.slice(1).map(Number) as [number, number, number, number];
    expect(arrive).toBeLessThan(contactAt * 100);
    expect(leave).toBeGreaterThanOrEqual(contactAt * 100);
    expect(back).toBeLessThanOrEqual(96);
    expect(((back - leave) / 100) * TIMING.moveAnimMs).toBeGreaterThanOrEqual(140);
    expect(arrive - rest).toBeLessThanOrEqual(3 * (back - leave));
  });
  it('맞는 빛은 자국 뒤 60ms 안 — 패링 원 (= 자국) 이 맞는 빛보다 한 장면 (80ms) 넘게 먼저 닫히지 않게', () => {
    expect(lag).toBeGreaterThan(0);
    expect(lag).toBeLessThanOrEqual(60);
  });
  it('맞음 밀림은 정수 px 걸음 (step-end) — 부드러운 곡선의 소수 자리 (4.23px) 없음 · 번쩍 (pg-hurt) 은 자리를 안 옮김', () => {
    expect(css).toMatch(/\.pg-hurt \{\s*animation: pg-hurt-x [\d.]+s step-end both, pg-hurt /);
    expect(frames('pg-hurt')).not.toMatch(/transform/);
    const px = [...frames('pg-hurt-x').matchAll(/\* ([\d.]+)px\)/g)].map((m) => Number(m[1]));
    expect(px.length).toBeGreaterThan(2);
    for (const v of px) expect(Number.isInteger(v)).toBe(true);
    // 첫 장면부터 밀림 (0% 가 0 이면 25ms 서 있어 맞은 반응이 늦어 보임 — 1906)
    expect(frames('pg-hurt-x')).toMatch(/0% \{ transform: translateX\(calc\(var\(--pg-back, -1\) \* [1-9]/);
  });
  it('맞는 쪽 번쩍 · 밀림 = 맞는 빛 때 (bugs 1906) — 엔진 피해 숫자 (행동 끝) 를 기다리지 않음 · 행동 끝에 처음부터 다시 돌지 않음 · 그 한 방에 쓰러지면 맞은 모습부터 (-late)', () => {
    const burst = fxSrc.indexOf('if (dst && hit) fx.impact(dst, move.hitType, move.big, move.m.name, hit);');
    const early = fxSrc.indexOf('if (hit && !hit.none && hurts) setHurtEarly(other(side), performance.now());');
    expect(burst).toBeGreaterThan(0);
    expect(early).toBeGreaterThan(burst);
    expect(fxSrc.slice(burst, early)).not.toMatch(/at\(/);
    const layer = readFileSync(join(__dirname, '../components/BattleLayer.tsx'), 'utf8');
    expect(layer).toMatch(/const hurt = \(early !== null && now >= early && now - early < HURT_MS\) \|\| b\.popups\.some/);
    expect(layer).toMatch(/<span key=\{b\.anim && b\.anim\.side !== side \? '' : animKey\(b\)\} class=\{cls\}/);
    expect(layer).toMatch(/const koLate = ko\.wait > 0 \|\| koAfterHit\.current === true;/);
    expect(layer.match(/pg-ko\$\{koLate \? ' pg-ko-late' : ''\}/g)?.length).toBe(2);
  });
  it('hurtEarlyAt — 적은 쪽만', () => {
    setHurtEarly('foe', 1234);
    expect(hurtEarlyAt('foe')).toBe(1234);
    expect(hurtEarlyAt('me')).toBeNull();
  });
});
