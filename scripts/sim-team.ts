/**
 * 3:3 실시간 팀 배틀 시뮬 (2026-10-21 orders #17) — 한 판 길이 · 이기는 비율 · 필살기 · 힘겨루기 수 (자동 전투).
 * 실행: npx vite-node scripts/sim-team.ts -- [판 수=60]
 * 목표: 한 판 1분 안팎 (gdd 4.7 끝) — BALANCE.team.damageScale · gaugeScale · ultGainScale 로 맞춤
 */
import { BALANCE, TIMING } from '../src/game/core/balance';
import { Rng } from '../src/game/core/engine/rng';
import { startTeamBattle, teamDone, teamStep } from '../src/game/core/engine/team';
import { createMonster, wildMoves } from '../src/game/core/rules/monster';
import { leaderTeam, trainerTeam } from '../src/game/core/rules/trainer';
import { sampleSave } from '../src/test/fixtures/save';

const runs = Number(process.argv.slice(2).filter((a) => a !== '--')[0] ?? 60);
for (const [label, lv, stage] of [['1-2', 9, 'forest-2'], ['1-3', 12, 'forest-3'], ['관장', 16, 'gym']] as const) {
  let total = 0;
  let wins = 0;
  let ults = 0;
  let ultClashes = 0;
  let moveClashes = 0;
  for (let seed = 1; seed <= runs; seed++) {
    const rng = new Rng(seed * 7919);
    const mk = (uid: string, dex: number) => createMonster({ uid, dex, level: lv, moves: wildMoves(dex, lv, rng), rng, caughtAt: 'forest-1' });
    // 스타팅 (풀 · 불꽃 · 물 번갈아) + 구구 + 숲 벌레
    const team = [mk('m1', [1, 4, 7][seed % 3]!), mk('m2', 16), mk('m3', 10 + (seed % 3) * 3)];
    const save = sampleSave({ monsters: Object.fromEntries(team.map((m) => [m.uid, m])), party: team.map((m) => m.uid) });
    const foes = stage === 'gym' ? leaderTeam() : trainerTeam(stage, seed, seed % 3, 3, BALANCE.team.size);
    let b = startTeamBattle(save, foes, stage === 'gym' ? 'gym' : 'trainer', '상대');
    let t = 0;
    let lastPhase = b.phase;
    let lastClashes = 0;
    while (!teamDone(b) && t < 600_000) {
      b = teamStep(b, TIMING.simStepMs, rng, { auto: true, away: false });
      t += TIMING.simStepMs;
      if (b.phase === 'ult' && lastPhase !== 'ult') ults++;
      if (b.phase === 'clash' && lastPhase !== 'clash') ultClashes++;
      if (b.moveClashes.length > lastClashes) moveClashes++;
      lastClashes = b.moveClashes.length;
      lastPhase = b.phase;
    }
    total += t;
    if (b.result === 'win') wins++;
  }
  const per = (x: number) => (x / runs).toFixed(1);
  console.log(`${label} Lv${lv}: 한 판 ${(total / runs / 1000).toFixed(1)}초 · 이김 ${wins}/${runs} · 필살기 ${per(ults)} · 필살기 힘겨루기 ${per(ultClashes)} · 기술 힘겨루기 ${per(moveClashes)}`);
}
