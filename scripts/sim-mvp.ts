/**
 * MVP 한 바퀴 시뮬레이션 (단계 11 숫자 맞추기) — 스타팅을 고르는 데서 관장 · MVP 끝 카드까지 엔진만으로 자동으로 (그림 없음).
 * 실행: npx vite-node scripts/sim-mvp.ts -- [판 수=3] [잡기 on|off=on] [연타 on|off=off]
 *
 * 플레이어 규칙 — 코딩하면서 곁눈으로 보는 사람:
 * - 자동 전투 켬 · 선제공격 (Space) 안 누름 · 힘대결 연타는 옵션
 * - 이긴 뒤 마지막 기회: 아직 안 잡은 종이고 팀이 5마리보다 적으면 몬스터볼 (좋은 타이밍에 누름)
 * - 병원: 팀 HP 가 60% 아래거나 쓰러진 포켓몬이 있으면 들어가 회복 · 상점: 상처약 3개 · 몬스터볼 5개까지 (300원은 남김)
 * - 부탁: 늘 도움 · 결과: 1.5초 보고 계속 · 새 기술: 위력이 더 세면 가장 약한 기술 대신 · 진화: 함 (센 기술을 남김)
 * - 포인트: 공격 · HP 번갈아 · 대기실: 처음엔 바로 도전, 지면 1-3 을 한 번 더 걷고 다시 도전
 */
import { BALANCE, TIMING } from '../src/game/core/balance';
import { canParry, canRiposte, type BattleState } from '../src/game/core/engine/battle';
import { applyInput, step } from '../src/game/core/engine/play';
import { createGameState, type GameState } from '../src/game/core/engine/state';
import { maxHpOf } from '../src/game/core/rules/bag';
import { leaderTeam } from '../src/game/core/rules/trainer';
import { STAGE_IDS, type Monster, type Save, type StageId } from '../src/game/core/save';
import { moveOf, speciesOf } from '../src/game/data';
import { createStartSave, starterList } from '../src/game/features/starter/model';

const STEP = TIMING.simStepMs;
const MAX_MS = 6 * 60 * 60 * 1000; // 6시간 넘으면 못 깬 것으로
const args = process.argv.slice(2).filter((a) => a !== '--');
const RUNS = Number(args[0] ?? 3);
const CATCH = (args[1] ?? 'on') === 'on';
const MASH = (args[2] ?? 'off') === 'on';
/** 패링 — none = 안 함 · half = 상대 공격마다 반쯤 완벽 · perfect = 늘 완벽 (+ 반격) (orders #26 — 완벽 패링도 필살기 게이지 R1) */
const PARRY = (args[3] ?? 'none') as 'none' | 'half' | 'perfect';
/** 스타팅 하나만 (도감 번호) · 질 때마다 한 줄 (어디 · 상대 · 내 팀) — 벽 찾기 (기획 2026-10-21) */
const ONLY = args[4] ? Number(args[4]) : null;
const LOG_DEFEATS = ONLY !== null || process.env.SIM_LOG === 'defeat';

type Where = StageId | 'gym';
interface StageStat {
  ms: number;
  /** 전투 시간 (야생 · 트레이너) */
  battleMs: number;
  /** 처음 걷는 길에서 만난 야생 (진 뒤 다시 걸은 곳 빼고) */
  newWild: number;
  /** 처음 끝까지 걸어 깬 데까지 걸린 시간 */
  firstClearMs: number;
  defeats: number;
  /** 트레이너한테 진 수 (나머지는 야생) */
  trainerDefeats: number;
  /** 내 필살기 쓴 수 */
  ults: number;
  /** 힘대결 (기술 · 필살기) */
  clashes: number;
  /** 완벽 패링 */
  perfects: number;
  /** 사람이 눌러야 하는 멈춤 (새 기술 · 진화 고르기 · 부탁 · 클리어 · 패배 — 마지막 기회는 6초 뒤 저절로 지나가서 뺌) */
  pauses: number;
  wild: number;
  trainers: number;
  caught: number;
}
interface RunResult {
  starter: string;
  seed: number;
  done: boolean;
  totalMs: number;
  stages: Record<Where, StageStat>;
  gymTries: number;
  firstGymLevels: number[];
  winLevels: number[];
  moneyAtGym: number;
  /** 처음 필살기를 쓴 때 (분, 없으면 -1) */
  firstUltMin: number;
  spent: number;
  potionsUsed: number;
  team: number;
}

const blank = (): StageStat => ({ ms: 0, battleMs: 0, newWild: 0, firstClearMs: 0, defeats: 0, trainerDefeats: 0, ults: 0, clashes: 0, perfects: 0, pauses: 0, wild: 0, trainers: 0, caught: 0 });
const party = (save: Save): Monster[] => save.party.map((u) => save.monsters[u]).filter((m): m is Monster => !!m);
const hpRatio = (save: Save) => {
  const t = party(save);
  const max = t.reduce((a, m) => a + maxHpOf(m), 0);
  return max > 0 ? t.reduce((a, m) => a + m.hp, 0) / max : 0;
};
const power = (id: number) => moveOf(id)?.power ?? 0;
const where = (save: Save): Where => (save.location.screen === 'stage' ? save.location.stageId : 'gym');

function decide(s: GameState, mem: { resultMs: number; lostGymOnce: boolean; grindNext: boolean; parryKey: string; parryYes: boolean }): GameState {
  const st = s.runtime.stage;
  const save = s.save;
  if (!st) return s;
  switch (st.phase) {
    case 'walk': {
      // 포인트 — 공격 · HP 번갈아
      for (const m of party(save)) {
        if (m.unspentPoints > 0) return applyInput(s, { kind: 'points', uid: m.uid, stat: m.unspentPoints % 2 ? 'attack' : 'hp' });
      }
      return s;
    }
    case 'battle': {
      const b = st.battle;
      if (b.phase === 'last' && CATCH && b.kind === 'wild') {
        const isNew = !save.dex.caught.includes(b.foe.species);
        if (isNew && save.party.length < BALANCE.partySize && (save.bag['poke-ball'] ?? 0) > 0) return applyInput(s, { kind: 'battle', input: { kind: 'ball', ball: 'poke-ball' } });
      }
      if (b.phase === 'catch' && b.catch && b.catch.pressMs === null && b.catch.ms >= TIMING.catchRingMs - STEP) return applyInput(s, { kind: 'space' });
      if (MASH && b.phase === 'clash' && b.clash && b.clash.winner === null && Math.random() < 0.4) return applyInput(s, { kind: 'space' });
      // 패링 — 상대 공격 하나마다 한 번 정함 (반쯤 = 50%) · 완벽 (ms 0) 이면 반격 기회도 씀
      if (PARRY !== 'none' && (canParry(b) || canRiposte(b))) {
        const key = b.anim ? `${b.anim.side}${b.t - b.anim.ms}` : mem.parryKey;
        if (key !== mem.parryKey) {
          mem.parryKey = key;
          mem.parryYes = PARRY === 'perfect' || Math.random() < 0.5;
        }
        if (mem.parryYes) return applyInput(s, { kind: 'battle', input: { kind: 'parry', ms: 0 } });
      }
      return s;
    }
    case 'request':
      return st.result ? s : applyInput(s, { kind: 'request', help: true });
    case 'facility': {
      if (!st.inside) {
        const want = st.kind === 'hospital' ? hpRatio(save) < 0.6 || party(save).some((m) => m.hp <= 0) : save.money >= 500 && ((save.bag.potion ?? 0) < 3 || (save.bag['poke-ball'] ?? 0) < 5);
        return applyInput(s, { kind: 'facility', enter: want });
      }
      if (st.kind === 'hospital') {
        const healed = applyInput(s, { kind: 'heal' });
        return applyInput(healed, { kind: 'facility-leave' });
      }
      let cur = s;
      for (let i = 0; i < 10; i++) {
        const b = cur.save.bag;
        const item = (b.potion ?? 0) < 3 && cur.save.money >= BALANCE.shopPrices.potion + 300 ? 'potion' : (b['poke-ball'] ?? 0) < 5 && cur.save.money >= BALANCE.shopPrices['poke-ball'] + 300 ? 'poke-ball' : null;
        if (!item) break;
        const next = applyInput(cur, { kind: 'buy', item });
        if (next === cur) break;
        cur = next;
      }
      return applyInput(cur, { kind: 'facility-leave' });
    }
    case 'result':
      mem.resultMs += STEP;
      if (mem.resultMs < 1500) return s;
      mem.resultMs = 0;
      return applyInput(s, { kind: 'result-continue' });
    case 'choice': {
      const c = save.pendingChoices[0];
      if (c?.kind === 'learn') {
        const m = save.monsters[c.uid];
        if (!m) return applyInput(s, { kind: 'learn', replace: null });
        let weakest = 0;
        m.moves.forEach((x, i) => {
          if (power(x.moveId) < power(m.moves[weakest]!.moveId)) weakest = i;
        });
        const better = power(c.moveId) > power(m.moves[weakest]?.moveId ?? 0);
        return applyInput(s, { kind: 'learn', replace: better ? weakest : null });
      }
      if (c?.kind === 'evolve') {
        // "어…? ○○의 모습이…!" 에서 기다림 (ms < 0) — 보기를 눌러 진화 시작 (ideas #33 — 빠지면 판이 여기서 멈춤, 기획 #25)
        if (st.ms < 0) return applyInput(s, { kind: 'evolve-watch' });
        if (st.ms < TIMING.evolveAnimMs) return applyInput(s, { kind: 'evolve-skip' });
        const m = save.monsters[c.uid];
        // 남길 수 = 4 - 새 기술 수 (엔진 keepCount 와 같은 어림) — 다 넘기면 엔진이 지금 기술 순서대로 앞에서부터 남김
        const room = Math.max(0, BALANCE.moveSlots - c.newMoves.filter((id) => !(m?.moves ?? []).some((x) => x.moveId === id)).length);
        const keep = (m?.moves ?? []).map((x) => x.moveId).sort((a, b) => power(b) - power(a)).slice(0, room);
        return applyInput(s, { kind: 'evolve', keep });
      }
      return s;
    }
    case 'defeat':
      return applyInput(s, { kind: 'defeat-continue' });
    case 'clear': {
      const loc = save.location;
      if (loc.screen !== 'stage') return s;
      const next = STAGE_IDS[STAGE_IDS.indexOf(loc.stageId) + 1] ?? 'gym';
      return applyInput(s, { kind: 'travel', to: next });
    }
    case 'lobby':
      if (mem.grindNext) {
        mem.grindNext = false;
        return applyInput(s, { kind: 'travel', to: 'forest-3' });
      }
      // 대기실 회복 (관장전은 져도 돈을 안 잃고 회복됨 — 사람은 회복하고 도전)
      if (hpRatio(save) < 1) return applyInput(s, { kind: 'heal' });
      return applyInput(s, { kind: 'challenge' });
    default:
      return s;
  }
}

function runOnce(dex: number, seed: number): RunResult {
  let s = createGameState(createStartSave(0, seed, dex, { gender: 'male' }), seed);
  s = applyInput(s, { kind: 'auto-battle', on: true });
  const stages = Object.fromEntries([...STAGE_IDS, 'gym'].map((k) => [k, blank()])) as Record<Where, StageStat>;
  const mem = { resultMs: 0, lostGymOnce: false, grindNext: false, parryKey: '', parryYes: false };
  const r: RunResult = { starter: speciesOf(dex)?.name.ko ?? String(dex), seed, done: false, totalMs: 0, stages, gymTries: 0, firstGymLevels: [], winLevels: [], moneyAtGym: -1, firstUltMin: -1, spent: 0, potionsUsed: 0, team: 0 };
  let prevPhase: string | undefined;
  let prevBattle: string | null = null;
  let lastKind: string | null = null;
  let prevAnim: unknown = null;
  let prevPerfects = 0;
  let lastBattle: BattleState | null = null;
  /** 처음 길 야생 — 진 뒤 같은 자리를 다시 걸을 때 두 번 세지 않게 (스테이지 · 시드 · 자리) */
  const counted = new Set<string>();
  const reach: Record<string, number> = {};
  let prevMoney = s.save.money;
  let prevPotions = s.save.bag.potion ?? 0;
  for (let t = 0; t < MAX_MS; t += STEP) {
    s = decide(s, mem);
    s = step(s, STEP).state;
    const w = where(s.save);
    stages[w].ms += STEP;
    const st = s.runtime.stage;
    const phase = st?.phase;
    // 돈 · 상처약 (줄면 쓴 것 — 졌을 때 잃은 돈도 포함)
    if (s.save.money < prevMoney) r.spent += prevMoney - s.save.money;
    prevMoney = s.save.money;
    const potions = s.save.bag.potion ?? 0;
    if (potions < prevPotions) r.potionsUsed += prevPotions - potions;
    prevPotions = potions;
    const prog = s.save.location.screen === 'stage' ? (s.save.stages[s.save.location.stageId]?.progress ?? 0) : 0;
    if (st?.phase === 'battle' && st.battle.kind !== 'gym') stages[w].battleMs += STEP;
    if (st?.phase === 'battle') {
      const key = `${st.battle.kind}:${st.battle.foe.uid}`;
      if (prevBattle === null) {
        if (st.battle.kind === 'wild') {
          stages[w].wild++;
          const seed = s.save.location.screen === 'stage' ? s.save.stages[s.save.location.stageId]?.seed : 0;
          const spotKey = `${w}:${seed}:${prog.toFixed(5)}`;
          if (prog >= (reach[w] ?? 0) - 1e-6 && !counted.has(spotKey)) {
            counted.add(spotKey);
            stages[w].newWild++;
          }
        }
        else if (st.battle.kind === 'trainer') stages[w].trainers++;
        else {
          r.gymTries++;
          if (r.gymTries === 1) {
            r.firstGymLevels = party(s.save).map((m) => m.level);
            r.moneyAtGym = s.save.money;
          }
        }
      }
      prevBattle = key;
      lastKind = st.battle.kind;
      lastBattle = st.battle;
      const an = st.battle.anim;
      // 내 필살기 — 연출로 나가거나 상대도 필살기로 맞받아 바로 힘대결이 되거나
      const ultClash = st.battle.phase === 'clash' && st.battle.clash?.kind === 'ult' && st.battle.clash.ms === 0;
      if ((an && an !== prevAnim && an.side === 'me' && an.action.kind === 'ult' && an.ms === 0) || ultClash) {
        stages[w].ults++;
        if (r.firstUltMin < 0) r.firstUltMin = t / 60000;
      }
      prevAnim = an;
      if (st.battle.phase === 'clash' && st.battle.clash?.ms === 0) stages[w].clashes++;
      if ((st.battle.perfects ?? 0) > prevPerfects) stages[w].perfects += (st.battle.perfects ?? 0) - prevPerfects;
      prevPerfects = st.battle.perfects ?? 0;
      if (st.battle.result === 'catch' && st.battle.overMs === 0) stages[w].caught++;
    } else {
      prevBattle = null;
      prevPerfects = 0;
    }
    if (phase !== prevPhase) {
      if (phase === 'defeat') {
        if (LOG_DEFEATS && lastBattle) {
          const b = lastBattle;
          const foes = [b.foe, ...b.foeQueue].map((m) => `${speciesOf(m.species)?.name.ko ?? m.species} Lv${m.level}`).join(' · ');
          const mine = party(s.save).map((m) => `${speciesOf(m.species)?.name.ko ?? m.species} Lv${m.level} ${Math.round((m.hp / Math.max(1, maxHpOf(m))) * 100)}%`).join(' · ');
          const pend = s.save.pendingEncounter;
          console.log(`짐 ${r.starter} ${w} ${(t / 60000).toFixed(1)}분 · ${b.kind} ${b.foeName ?? ''} [${foes}] · 쓰러뜨림 ${b.foeDown.length} · 내 팀 [${mine}] · 돈 ${s.save.money}${pend ? ` · 남은 만남 ${pend.kind}` : ''}`);
        }
        stages[w].defeats++;
        if (lastKind === 'trainer') stages[w].trainerDefeats++;
        if (st?.phase === 'defeat' && st.gym) mem.grindNext = true;
      }
      if (phase === 'clear' && !stages[w].firstClearMs) stages[w].firstClearMs = stages[w].ms;
      if (phase === 'choice' || phase === 'request' || phase === 'clear' || phase === 'defeat') stages[w].pauses++;
      if (phase === 'badge') {
        r.done = true;
        r.totalMs = t;
        r.winLevels = party(s.save).map((m) => m.level);
        r.team = s.save.party.length;
        return r;
      }
    }
    if (w !== 'gym') reach[w] = Math.max(reach[w] ?? 0, prog);
    prevPhase = phase;
  }
  r.totalMs = MAX_MS;
  r.winLevels = party(s.save).map((m) => m.level);
  r.team = s.save.party.length;
  return r;
}

const min = (ms: number) => (ms / 60000).toFixed(1);
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const results: RunResult[] = [];
const starters = starterList();
const started = Date.now();
for (const sp of starters.filter((x) => ONLY === null || x.dex === ONLY)) {
  for (let i = 0; i < RUNS; i++) {
    const r = runOnce(sp.dex, 1000 + i * 7919 + sp.dex);
    results.push(r);
  }
}
const ace = Math.max(...leaderTeam().map((m) => m.level));
console.log(`판 ${results.length} (스타팅 ${starters.length} × ${RUNS}) · 잡기 ${CATCH ? '함' : '안 함'} · 연타 ${MASH ? '함' : '안 함'} · 패링 ${PARRY} · 계산 ${((Date.now() - started) / 1000).toFixed(0)}초 · 관장 에이스 Lv ${ace}`);
console.log(`끝까지 간 판 ${results.filter((r) => r.done).length} / ${results.length}`);
for (const w of [...STAGE_IDS, 'gym'] as Where[]) {
  const xs = results.map((r) => r.stages[w]);
  console.log(
    `${w.padEnd(9)} 시간 ${min(avg(xs.map((x) => x.ms)))}분 (최대 ${min(Math.max(...xs.map((x) => x.ms)))}) · 전투 ${min(avg(xs.map((x) => x.battleMs)))}분 · 전투 한 번 ${(avg(xs.map((x) => x.battleMs)) / Math.max(1, avg(xs.map((x) => x.wild + x.trainers))) / 1000).toFixed(0)}초 · 처음 길 야생 ${avg(xs.map((x) => x.newWild)).toFixed(1)} · 짐 ${avg(xs.map((x) => x.defeats)).toFixed(1)}번 (트레이너 ${avg(xs.map((x) => x.trainerDefeats)).toFixed(1)} · 최대 ${Math.max(...xs.map((x) => x.defeats))}) · 야생 ${avg(xs.map((x) => x.wild)).toFixed(1)} · 트레이너 ${avg(xs.map((x) => x.trainers)).toFixed(1)} · 잡음 ${avg(xs.map((x) => x.caught)).toFixed(1)} · 필살기 ${avg(xs.map((x) => x.ults)).toFixed(1)} · 힘대결 ${avg(xs.map((x) => x.clashes)).toFixed(1)} · 완벽 패링 ${avg(xs.map((x) => x.perfects)).toFixed(1)} · 멈춤 ${avg(xs.map((x) => x.pauses)).toFixed(1)}`,
  );
}
const done = results.filter((r) => r.done);
const lead = (ls: number[]) => (ls.length ? Math.max(...ls) : 0);
console.log(`전체 시간 ${min(avg(done.map((r) => r.totalMs)))}분 (가장 짧게 ${min(Math.min(...done.map((r) => r.totalMs)))} · 길게 ${min(Math.max(...done.map((r) => r.totalMs)))})`);
console.log(`관장 도전 ${avg(results.map((r) => r.gymTries)).toFixed(1)}번 · 첫 도전 때 가장 높은 레벨 ${avg(results.map((r) => lead(r.firstGymLevels))).toFixed(1)} · 팀 평균 ${avg(results.map((r) => avg(r.firstGymLevels))).toFixed(1)} · 이긴 때 가장 높은 레벨 ${avg(done.map((r) => lead(r.winLevels))).toFixed(1)}`);
const ultMins = results.map((r) => r.firstUltMin).filter((m) => m >= 0);
console.log(`첫 필살기 ${ultMins.length ? min(avg(ultMins) * 60000) : '-'}분 (늦게 ${ultMins.length ? min(Math.max(...ultMins) * 60000) : '-'} · 한 바퀴 동안 안 쓴 판 ${results.length - ultMins.length})`);
console.log(`첫 도전 때 돈 ${avg(results.map((r) => r.moneyAtGym)).toFixed(0)}원 · 쓴 돈 (진 것 포함) ${avg(results.map((r) => r.spent)).toFixed(0)}원 · 상처약 쓴 수 ${avg(results.map((r) => r.potionsUsed)).toFixed(1)} · 끝날 때 팀 ${avg(results.map((r) => r.team)).toFixed(1)}마리`);
for (const [g, from, to] of [['풀', 0, 6], ['불꽃', 6, 12], ['물', 12, 18]] as const) {
  const names = starters.slice(from, to).map((x) => speciesOf(x.dex)?.name.ko ?? '');
  const rs = results.filter((r) => names.includes(r.starter));
  console.log(`  ${g} 스타팅: ${[...STAGE_IDS, 'gym'].map((w) => `${w} ${avg(rs.map((r) => r.stages[w as Where].defeats)).toFixed(1)} (트 ${avg(rs.map((r) => r.stages[w as Where].trainerDefeats)).toFixed(1)})`).join(' · ')} · 전체 ${min(avg(rs.map((r) => r.totalMs)))}분`);
}
console.log('스타팅별 (전체 분 · 짐 합계 · 관장 도전):');
for (const sp of starters) {
  const rs = results.filter((r) => r.starter === (speciesOf(sp.dex)?.name.ko ?? ''));
  const defeats = rs.map((r) => Object.values(r.stages).reduce((a, x) => a + x.defeats, 0));
  console.log(`  ${sp.name.padEnd(5)} ${min(avg(rs.map((r) => r.totalMs)))}분 · 짐 ${avg(defeats).toFixed(1)} · 도전 ${avg(rs.map((r) => r.gymTries)).toFixed(1)}${rs.some((r) => !r.done) ? ' · 못 깸 있음' : ''}`);
}
