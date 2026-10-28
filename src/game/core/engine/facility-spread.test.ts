import { describe, expect, it } from 'vitest';
import { sampleSave, viaJson } from '../../../test/fixtures/save';
import { BALANCE, TIMING } from '../balance';
import { spreadFacilities, stageLayout, trainerSpots } from '../rules/stage';
import { readSave, REGION_STAGE_IDS, type FacilitySpot, type StageProgress } from '../save';
import { step } from './play';
import { createGameState, type GameState } from './state';

const GAP = BALANCE.stageSameFacilityGap;
const [LO, HI] = BALANCE.stageFacilityRange;
// 자리는 소수 넷째 자리로 적어 경계에서 0.00003 모자랄 수 있음 (처음 뽑기도 같음)
const ROUND = 0.0001;
const run0 = { startMs: 0, caught: 0, trainers: 0, seen: [], reach: 0, retries: 0 };

describe('같은 시설 두 곳은 멀리 (#123 — 태현 님 "첫번에 상점에서 돈을 다 썼는데 두번째 상점이 의미가 있을까" → B)', () => {
  it('9 스테이지 × 1000판 — 같은 종류 둘 사이 간격 · 범위 안 · 트레이너 · 다른 시설과 떨어짐', () => {
    let pairs = 0;
    for (const id of REGION_STAGE_IDS) {
      const tr = trainerSpots(id);
      for (let seed = 1; seed <= 1000; seed++) {
        const f = stageLayout(id, seed).facilities;
        for (const kind of ['hospital', 'shop'] as const) {
          const same = f.filter((x) => x.kind === kind);
          expect(same.length).toBeLessThanOrEqual(2);
          if (same.length === 2) {
            pairs++;
            expect(same[1]!.at - same[0]!.at, `${id} ${seed} ${kind}`).toBeGreaterThanOrEqual(GAP - ROUND);
          }
        }
        for (const x of f) {
          expect(x.at).toBeGreaterThanOrEqual(LO);
          expect(x.at).toBeLessThanOrEqual(HI);
          for (const t of tr) expect(Math.abs(t - x.at), `${id} ${seed} 트레이너`).toBeGreaterThanOrEqual(0.04 - ROUND);
          for (const o of f) if (o.kind !== x.kind) expect(Math.abs(o.at - x.at), `${id} ${seed} 다른 시설`).toBeGreaterThanOrEqual(0.05 - ROUND);
        }
      }
    }
    // 둘인 판이 절반쯤 (병원 · 상점 1 ~ 2) — 옮기느라 빠지지 않음
    expect(pairs).toBeGreaterThan(REGION_STAGE_IDS.length * 1000 * 0.8);
    // 9000판이라 혼자 약 2초 — 전체 테스트를 같이 돌리면 5초 기본 시간을 넘을 수 있어 넉넉히
  }, 30_000);

  it('옮겨도 수 · 종류는 그대로 · 이미 멀면 그대로 · 시드마다 같은 결과', () => {
    const close: FacilitySpot[] = [{ kind: 'shop', at: 0.5 }, { kind: 'hospital', at: 0.36 }, { kind: 'shop', at: 0.56 }];
    const a = spreadFacilities('forest-1', 7, close);
    expect(a.map((f) => f.kind).sort()).toEqual(['hospital', 'shop', 'shop']);
    const shops = a.filter((f) => f.kind === 'shop');
    expect(shops[1]!.at - shops[0]!.at).toBeGreaterThanOrEqual(GAP - ROUND);
    expect(spreadFacilities('forest-1', 7, close)).toEqual(a);
    const far: FacilitySpot[] = [{ kind: 'shop', at: 0.32 }, { kind: 'shop', at: 0.7 }];
    expect(spreadFacilities('forest-1', 7, far)).toEqual(far);
  });

  it('코드 리뷰어 — 반올림만큼 모자란 간격은 그대로 (같은 목록) · 같은 종류 셋 넘는 손댄 세이브는 그대로 · 세이브는 종류마다 둘까지', () => {
    const almost: FacilitySpot[] = [{ kind: 'shop', at: 0.35 }, { kind: 'shop', at: 0.35 + GAP - 0.00005 }];
    expect(spreadFacilities('forest-1', 7, almost)).toBe(almost);
    const three: FacilitySpot[] = [{ kind: 'shop', at: 0.4 }, { kind: 'shop', at: 0.41 }, { kind: 'shop', at: 0.42 }];
    expect(spreadFacilities('forest-1', 7, three)).toBe(three);
    const many = Array.from({ length: 50 }, (_, i) => ({ kind: i % 2 ? 'shop' : 'hospital', at: 0.3 + i * 0.001 }));
    const r = readSave(viaJson({ ...sampleSave(), stages: { 'forest-1': { seed: 42, progress: 0, cleared: false, defeatedTrainers: [], facilities: many, run: { ...run0 } } } }));
    expect(r.kind === 'ok' && r.save.stages['forest-1']!.facilities.length).toBe(BALANCE.stageHospitals[1] + BALANCE.stageShops[1]);
  });

  it('붙어 적힌 옛 세이브 — 아직 안 지났으면 지금 고침 · 지났으면 이번 판 그대로 → 다음 판 처음에 고침', () => {
    const old: FacilitySpot[] = [{ kind: 'shop', at: 0.42 }, { kind: 'shop', at: 0.47 }, { kind: 'hospital', at: 0.62 }];
    const game = (progress: number): GameState => {
      const prog: StageProgress = { seed: 42, progress, cleared: false, defeatedTrainers: [], facilities: old.map((f) => ({ ...f })), run: { ...run0 } };
      const s = createGameState(sampleSave({ stages: { 'forest-1': prog } }), 7);
      return { ...s, runtime: { ...s.runtime, stage: { phase: 'walk' }, stageId: 'forest-1' } };
    };
    const shopGap = (g: GameState) => {
      const shops = g.save.stages['forest-1']!.facilities.filter((f) => f.kind === 'shop');
      return shops[1]!.at - shops[0]!.at;
    };
    const early = step(game(0.1), TIMING.simStepMs).state;
    expect(shopGap(early)).toBeGreaterThanOrEqual(GAP - ROUND);
    // 다시 불러와도 그대로 (세이브 검사가 받음)
    const back = readSave(viaJson(early.save));
    expect(back.kind === 'ok' && back.save.stages['forest-1']!.facilities).toEqual(early.save.stages['forest-1']!.facilities);
    // 둘째 상점을 지난 판 — 이번 판은 그대로 (지나온 자리가 앞으로 옮겨 다시 나오지 않게)
    const late = step(game(0.5), TIMING.simStepMs).state;
    expect(late.save.stages['forest-1']!.facilities).toEqual(old);
    // 졌다 병원 앞 (진행 0.1) 으로 돌아왔어도 이번 판에 0.5 까지 갔으면 그대로 (들른 상점이 옮겨 다시 나오지 않게 — 코드 리뷰어)
    const backAfterLoss = game(0.1);
    backAfterLoss.save.stages['forest-1']!.run.reach = 0.5;
    expect(step(backAfterLoss, TIMING.simStepMs).state.save.stages['forest-1']!.facilities).toEqual(old);
    // 다음 판 (진행 0 — freshRun 은 시설 자리를 그대로 들고 감) 에서 고침
    const next = step(game(0), TIMING.simStepMs).state;
    expect(shopGap(next)).toBeGreaterThanOrEqual(GAP - ROUND);
  });
});
