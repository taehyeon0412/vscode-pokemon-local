/**
 * 3:3 발밑 칩 붙잡기 회귀 (2026-11-03 기획 — 같은 종류 다섯 번: 1927 · 1933 · 2732 · 1935 …) — 엔진을 실제로 돌려 걸음마다
 * 화면과 같은 규칙 (model fullChipSlot · soonChip · foeWarn) 으로 칩을 세고, 상태 경계 (run ↔ 끼어들기 창 · 모으기 · 힘겨루기) 에서
 * 칩이 짧게 꺼졌다 다시 켜지지 않는지 (깜빡임) · 시나리오가 그 경계를 정말 지나는지 봄. 판 = team-runs 15 · 16 과 같은 누르기 (칩 칸은 안 누름).
 */
import { describe, expect, it } from 'vitest';
import { TIMING } from '../../../core/balance';
import { Rng } from '../../../core/engine/rng';
import { startTeamBattle, teamFoeNext, teamInput, teamStep, teamZSlot, type TeamBattle } from '../../../core/engine/team';
import { sampleMonster, sampleSave } from '../../../../test/fixtures/save';
import { foeWarn, fullChipSlot, plateState, soonChip } from './model';

const STEP = TIMING.simStepMs;
/** 꺼졌다 다시 켜지는 틈이 이보다 짧으면 깜빡임 (U1 — 문턱이 둘 이상인 표시는 한 번 보이면 유지) */
const FLICKER_MS = 300;

type Policy = 'none' | 'gather-other' | 'interject-other';

function battle(): TeamBattle {
  const mons = [0, 1, 2].map((i) => sampleMonster({ uid: `m${i}`, species: [1, 4, 7][i]!, form: ['bulbasaur', 'charmander', 'squirtle'][i]!, level: 12 }));
  const foes = [0, 1, 2].map((i) => sampleMonster({ uid: `f${i}`, species: [16, 19, 165][i]!, form: ['pidgey', 'rattata', 'ledyba'][i]!, level: 12 }));
  const b = startTeamBattle(sampleSave({ monsters: Object.fromEntries(mons.map((m) => [m.uid, m])), party: mons.map((m) => m.uid) }), foes, 'trainer', '상대', mons.map((m) => m.uid));
  // 오래 버티게 (판이 일찍 끝나 경계를 못 지나지 않게)
  const tough = (f: TeamBattle['me'][number]) => ({ ...f, hp: 9999, maxHp: 9999 });
  return { ...b, me: b.me.map(tough), foe: b.foe.map(tough) };
}

/** 그 편 살아 있는 칸 게이지 가득 (개발 메뉴 gauge-full 과 같음) */
function fill(b: TeamBattle, side: 'me' | 'foe'): TeamBattle {
  return { ...b, [side]: b[side].map((f) => (f.hp > 0 ? { ...f, ult: 1 } : f)) };
}

interface Trace {
  /** 칩 칸마다 보인 구간 [시작, 끝) */
  full: Map<number, [number, number][]>;
  soon: Map<number, [number, number][]>;
  /** 칩 칸 판이 join (창 · 모으기 · 힘겨루기) 이었던 걸음 수 */
  joinSteps: number;
  phases: Set<string>;
  zMiss: string[];
  /** 그 칸 판이 아직 금 (ready · join) 인데 칩만 빠진 때 (1935) · "곧" 이 예고가 남았는데 빠진 때 (1927 · 1933) */
  dropped: string[];
}

function play(seed: number, policy: Policy): Trace {
  let b = battle();
  const rng = new Rng(seed);
  const tr: Trace = { full: new Map(), soon: new Map(), joinSteps: 0, phases: new Set(), zMiss: [], dropped: [] };
  const open = (m: Map<number, [number, number][]>, k: number, t: number) => {
    const runs = m.get(k) ?? [];
    const last = runs[runs.length - 1];
    if (last && last[1] === t) last[1] = t + STEP;
    else runs.push([t, t + STEP]);
    m.set(k, runs);
  };
  let kept: number | null = null;
  const soon: { since: number; on: boolean }[] = [];
  let pressed = false;
  for (let t = 0; t < 40_000 && b.phase !== 'over'; t += STEP) {
    // 게이지 — 내 편 2 · 11 · 20 · 29초 · 상대는 seed 만큼 어긋나게 (창이 칩보다 먼저 · 나중에 열리는 경우 둘 다)
    if (t % 9000 === 2000) b = fill(b, 'me');
    if (t % 9000 === (2000 + seed * 450) % 9000) b = fill(b, 'foe');
    // 누르기 — 칩이 있는 칸은 안 누름 (그 칸 판이 join 으로 남는 장면을 만들려고)
    if (policy === 'gather-other' && b.phase === 'run' && kept !== null) {
      const other = [0, 1, 2].find((i) => i !== kept && plateState(b, 'me', i) === 'ready');
      if (other !== undefined) b = teamInput(b, { kind: 'ult', slot: other }, rng);
    }
    if (policy === 'interject-other') {
      const win = b.phase === 'ult' && b.ult?.side === 'foe' && b.ult.window > 0 && !b.ult.hit;
      if (win && !pressed && kept !== null) {
        const other = [0, 1, 2].find((i) => i !== kept && plateState(b, 'me', i) === 'join');
        if (other !== undefined) {
          b = teamInput(b, { kind: 'ult', slot: other }, rng);
          pressed = true;
        }
      }
      if (!win) pressed = false;
      if (b.phase === 'clash') b = teamInput(b, { kind: 'space' }, rng);
    }
    b = teamStep(b, STEP, rng, { auto: false, away: false });
    tr.phases.add(b.phase);
    const was: number | null = kept;
    kept = fullChipSlot(b, kept);
    if (kept !== null && was === null && kept !== teamZSlot(b)) tr.zMiss.push(`${t}ms 칩 ${kept} · Z ${teamZSlot(b)}`);
    if (was !== null && kept !== was && ['ready', 'join'].includes(plateState(b, 'me', was))) tr.dropped.push(`${t}ms 다 참 칸 ${was} · 판 ${plateState(b, 'me', was)} · ${b.phase}`);
    if (kept !== null) {
      open(tr.full, kept, t);
      if (plateState(b, 'me', kept) === 'join') tr.joinSteps++;
    }
    // "곧" 칩 — 화면 (TeamLayer warnShow) 과 같은 셈: 상대 필살기 중엔 "!" 차례 없음
    const first = b.phase === 'ult' && b.ult?.side === 'foe' ? -1 : (teamFoeNext(b) ?? -1);
    b.foe.forEach((_, i) => {
      const w = foeWarn(b, i);
      const on0 = !!soon[i]?.on;
      soon[i] = soonChip(soon[i] ?? { since: 0, on: false }, w, t, i === first);
      const on = !!w && !(w.full && i === first) && soon[i]!.on;
      if (on) open(tr.soon, i, t);
      else if (on0 && w && !(w.full && i === first)) tr.dropped.push(`${t}ms 곧 칸 ${i} · ${w.pct}% · ${b.phase}`);
    });
  }
  return tr;
}

/** 같은 칸에서 꺼졌다 FLICKER_MS 안에 다시 켜진 틈 */
function flickers(m: Map<number, [number, number][]>): string[] {
  const out: string[] = [];
  for (const [k, runs] of m) for (let i = 1; i < runs.length; i++) if (runs[i]![0] - runs[i - 1]![1] < FLICKER_MS) out.push(`칸 ${k} · ${runs[i - 1]![1]} → ${runs[i]![0]}ms`);
  return out;
}

describe('3:3 발밑 칩 붙잡기 — 엔진을 돌려 걸음마다 (1927 · 1933 · 1935)', () => {
  for (const policy of ['none', 'gather-other', 'interject-other'] as const) {
    it(`${policy} — "다 참" · "곧" 칩이 상태가 남았는데 빠지거나 깜빡이지 않음 · "다 참" 은 먼저 찬 칸 (seed 1 ~ 5)`, () => {
      let join = 0;
      for (const seed of [1, 2, 3, 4, 5]) {
        const tr = play(seed, policy);
        expect(flickers(tr.full), `seed ${seed} 다 참`).toEqual([]);
        expect(flickers(tr.soon), `seed ${seed} 곧`).toEqual([]);
        expect(tr.zMiss, `seed ${seed}`).toEqual([]);
        expect(tr.dropped, `seed ${seed}`).toEqual([]);
        expect(tr.full.size, `seed ${seed} 칩이 한 번도 안 뜸`).toBeGreaterThan(0);
        join += tr.joinSteps;
        if (policy === 'interject-other') expect([...tr.phases]).toContain('clash');
      }
      // 시나리오가 정말 경계를 지나는지 — 칩 칸 판이 join 인 채 칩이 남은 걸음이 있어야 (없으면 이 테스트가 1935 를 못 봄)
      expect(join).toBeGreaterThan(0);
    });
  }
});
