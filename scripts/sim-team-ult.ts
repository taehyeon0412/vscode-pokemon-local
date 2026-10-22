/**
 * 3:3 필살기 횟수 시뮬 (2026-10-21 기획 #88 — 태현 님 "시뮬레이션을 돌려봐야 알것같아") — 필살기 게이지 속도마다 판 (1-2 · 1-3 · 관장) 별
 * 필살기 횟수 · 필살기 장면을 넣은 한 판 길이 · 그중 필살기 장면 비율 · 이기는 비율 (자동 전투 = 같은 편 찬 포켓몬은 늘 합동).
 * 실행: npx vite-node scripts/sim-team-ult.ts -- [판 수=60] [single]
 *   single = 게이지 속도는 그대로 두고 한 마리 필살기 배율 (team.ultSingleScale — 기획 R7 원작 대상) 별로
 * 필살기 장면 (보는 중 — 연출이 맞을 때까지 엔진을 붙잡음):
 *   혼자 = 기 모으기 0.8 + 컷인 0.9 + 그 필살기가 처음 맞는 때 (ult/ult-hit.json 에서 무작위) + 맞은 뒤 엔진 남은 0.88초
 *   합동 = 멘트 1.5 + 기 모으기 0.8 + 컷인 0.9 + 참가자 중 가장 늦게 맞는 때 + 합체 뒤 1.55초
 *   필살기 힘겨루기 = 엔진 3초 + 이긴 쪽이 뚫고 나가 터지는 1.5초 (합동으로 이기면 위 합동 장면을 더함)
 */
import ultHit from '../ult/ult-hit.json';
import { BALANCE, TIMING } from '../src/game/core/balance';
import { Rng } from '../src/game/core/engine/rng';
import { startTeamBattle, teamDone, teamStep } from '../src/game/core/engine/team';
import { createMonster, wildMoves } from '../src/game/core/rules/monster';
import { leaderTeam, trainerTeam } from '../src/game/core/rules/trainer';
import { REGIONS } from '../src/game/core/rules/region';
import { sampleSave } from '../src/test/fixtures/save';

const argv = process.argv.slice(2).filter((a) => a !== '--');
const runs = Number(argv[0] ?? 60);
const SINGLE = argv[1] === 'single';
const HITS = Object.values(ultHit as Record<string, [number, number]>).map((v) => v[0]).filter((h) => h >= 0);
const LEAD = 800 + 900;
const SOLO_AFTER = TIMING.ultAnimMs - Math.round(TIMING.ultAnimMs * 0.6);
const JOINT_AFTER = TIMING.team.jointMs - TIMING.team.jointHitMs;
const CLASH_AFTER = 1500;
const team = BALANCE.team as { ultGainScale: number; ultSingleScale: number };
const base = team.ultGainScale;
const baseSingle = team.ultSingleScale;

const rows: string[] = [];
for (const scale of SINGLE ? [1, 1.5, 2, 2.5] : [1.2, 1.0, 0.8, 0.6, 0.5]) {
  if (SINGLE) team.ultSingleScale = scale;
  else team.ultGainScale = scale;
  for (const [label, lv, stage] of [['1-2', 9, 'forest-2'], ['1-3', 12, 'forest-3'], ['관장', 16, 'gym']] as const) {
    let real = 0;
    let scene = 0;
    let wins = 0;
    let solo = 0;
    let joint = 0;
    let clashes = 0;
    for (let seed = 1; seed <= runs; seed++) {
      const rng = new Rng(seed * 7919);
      const pickHit = new Rng(seed * 104729);
      const hit = () => HITS[Math.floor(pickHit.next() * HITS.length)]!;
      const mk = (uid: string, dex: number) => createMonster({ uid, dex, level: lv, moves: wildMoves(dex, lv, rng), rng, caughtAt: 'forest-1' });
      const mine = [mk('m1', [1, 4, 7][seed % 3]!), mk('m2', 16), mk('m3', 10 + (seed % 3) * 3)];
      const save = sampleSave({ monsters: Object.fromEntries(mine.map((m) => [m.uid, m])), party: mine.map((m) => m.uid) });
      const foes = stage === 'gym' ? leaderTeam(REGIONS.forest) : trainerTeam(stage, seed, seed % 3, 3, BALANCE.team.size);
      let b = startTeamBattle(save, foes, stage === 'gym' ? 'gym' : 'trainer', '상대');
      let t = 0;
      let extra = 0;
      let seen = 0;
      while (!teamDone(b) && t < 900_000) {
        b = teamStep(b, TIMING.simStepMs, rng, { auto: true, away: false });
        t += TIMING.simStepMs;
        for (const e of b.log) {
          if (e.id <= seen) continue;
          if (e.t === 'ult' && e.joint) {
            joint++;
            const h = Math.max(...e.joint.winners.map(() => hit()));
            // 엔진은 합동 마무리를 jointMs 로 셈 — 보는 중엔 가장 늦게 맞는 때까지 붙잡음
            const len = LEAD + h + JOINT_AFTER;
            extra += Math.max(0, len - TIMING.team.jointMs);
            scene += len;
          } else if (e.t === 'ult') {
            solo++;
            const len = LEAD + hit() + SOLO_AFTER;
            extra += Math.max(0, len - TIMING.ultAnimMs);
            scene += len;
          } else if (e.t === 'gather') {
            scene += TIMING.team.gatherMs;
          } else if (e.t === 'ult-clash') {
            clashes++;
            scene += TIMING.team.ultClashMs + CLASH_AFTER;
            extra += CLASH_AFTER;
          }
        }
        seen = b.logSeq;
      }
      real += t + extra;
      if (b.result === 'win') wins++;
    }
    const per = (x: number) => (x / runs).toFixed(1);
    rows.push(
      `| ${scale} | ${label} | ${per(solo + joint)} (혼자 ${per(solo)} · 합동 ${per(joint)} · 힘겨루기 ${per(clashes)}) | ${(real / runs / 1000).toFixed(0)}초 | ${Math.round((scene / real) * 100)}% | ${wins}/${runs} |`,
    );
  }
}
team.ultGainScale = base;
team.ultSingleScale = baseSingle;
console.log(`| ${SINGLE ? '한 마리 필살기 배율' : '필살기 게이지 (1:1 의 배)'} | 판 | 필살기 (한 판) | 한 판 길이 (필살기 장면 포함) | 필살기 장면 비율 | 이김 |`);
console.log('|---|---|---|---|---|---|');
for (const r of rows) console.log(r);
