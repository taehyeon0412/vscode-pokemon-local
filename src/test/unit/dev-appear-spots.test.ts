/**
 * 시험 창 place=appear 흔적 자리 표 (dev/game-host.js APPEAR_SPOTS — bugs 636 2026-11-04) 가 엔진과 같은지.
 * 화면은 길 위치가 그 흔적 자리와 꼭 같을 때만 튀어나온 포켓몬을 그림 — 표가 길 · 만남 규칙과 어긋나면 사진에 포켓몬이 다시 사라짐.
 * 병원 · 상점 자리는 시드대로 (시험 창이 facilities 를 비움) 라 saved 없이 견줌.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createWild, planWild } from '../../game/core/rules/encounter';
import { stageLayout } from '../../game/core/rules/stage';
import type { Monster, StageId } from '../../game/core/save';

const HOST = readFileSync(join(__dirname, '..', '..', '..', 'dev', 'game-host.js'), 'utf8');
const TABLE = /const APPEAR_SPOTS = (\{[\s\S]*?\n\});/.exec(HOST)?.[1] ?? '{}';
const SPOTS = JSON.parse(TABLE) as Record<string, [StageId, number, number, Monster]>;
const KINDS = ['grass', 'tree', 'water', 'ground', 'sky', 'shadow'];

describe('시험 창 place=appear 흔적 자리', () => {
  it('흔적 6종 × 보통 · 크게 · 반짝 18줄', () => {
    expect(Object.keys(SPOTS).sort()).toEqual(KINDS.flatMap((k) => [k, `${k}-strong`, `${k}-shiny`]).sort());
  });

  it.each(Object.entries(SPOTS))('%s — 그 자리에 그 흔적 · 야생은 엔진 createWild 그대로', (key, [stage, seed, at, wild]) => {
    const spot = stageLayout(stage, seed).spots.find((s) => s.kind === 'wild' && s.at === at);
    expect(spot, `${stage} 시드 ${seed} ${at} 에 야생 흔적이 없음 — 표를 다시 찾기`).toBeDefined();
    const plan = planWild(stage, seed, spot!, 0);
    const [kind, variant] = key.split('-');
    expect({ trace: plan.trace, strong: variant === 'strong' ? plan.strong : undefined, shiny: plan.shiny }).toEqual({
      trace: kind,
      strong: variant === 'strong' ? true : undefined,
      shiny: variant === 'shiny',
    });
    if (!variant) expect(plan.strong).toBe(false);
    expect(wild).toEqual(createWild(stage, seed, spot!, 0));
  });
});
