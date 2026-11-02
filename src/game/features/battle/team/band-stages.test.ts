import { describe, expect, it } from 'vitest';
import { bandNextStep, bandStages, type BandStage } from './TeamBand';

/** 넘칠 때마다 한 걸음씩 — 마지막까지 켜지는 단계 차례 */
function walk(kind: Parameters<typeof bandStages>[0], faint: string | null, faintShort: string | null, faintCount: string | null): BandStage[][] {
  const stages = bandStages(kind);
  const out: BandStage[][] = [];
  for (let step = 0; step < stages.length; ) {
    step = bandNextStep(stages, step, faint, faintShort, faintCount);
    out.push(stages.slice(0, step));
  }
  return out;
}

describe('띠 줄이기 단계 — 쓰러짐 말 두 걸음 (ideas 747)', () => {
  it('편을 말하는 말 바로 뒤에 "N마리" · 그 뒤에도 얼굴 빼기 · 이름 빼기가 이어 돎 (300 맥 상대 합동 띠 — "2마리" 로 내려가도 넘친 조합)', () => {
    const steps = walk('joint', '상대 이상해꽃 · 상대 거북왕 쓰러졌다!', '상대 2마리 쓰러졌다!', '2마리 쓰러졌다!');
    expect(steps.map((s) => s.at(-1))).toEqual(['short', 'faintShort', 'faintCount', 'noface', 'shorter']);
    expect(walk('ult', '상대 이상해꽃 · 상대 거북왕 쓰러졌다!', '상대 2마리 쓰러졌다!', '2마리 쓰러졌다!').map((s) => s.at(-1))).toEqual(['short', 'faintShort', 'faintCount', 'noface', 'shorter']);
    // VS · 이겼다 도 N마리 뒤에 원래 다음 단계 그대로
    expect(walk('vs', '내 1 · 상대 2 쓰러졌다!', '내 1 · 상대 2 쓰러졌다!', '3마리 쓰러졌다!').map((s) => s.at(-1))).toEqual(['vsTight', 'faintShort', 'faintCount', 'short', 'noFaint']);
    expect(walk('win', '내 2마리 쓰러졌다!', '내 2마리 쓰러졌다!', '2마리 쓰러졌다!').map((s) => s.at(-1))).toEqual(['short', 'faintShort', 'faintCount', 'vsTight', 'noface']);
  });

  it('줄일 것이 없는 걸음은 건너뜀 — 쓰러짐 말 없음 · 한 마리 (N마리 없음) · 줄인 말과 같으면', () => {
    expect(walk('joint', null, null, null).map((s) => s.at(-1))).toEqual(['short', 'noface', 'shorter']);
    expect(walk('joint', '상대 레디바 쓰러졌다!', '레디바 쓰러졌다!', null).map((s) => s.at(-1))).toEqual(['short', 'faintShort', 'noface', 'shorter']);
    expect(walk('joint', '통통코 · 소미안 쓰러졌다!', '2마리 쓰러졌다!', '2마리 쓰러졌다!').map((s) => s.at(-1))).toEqual(['short', 'faintShort', 'noface', 'shorter']);
    // 마지막 걸음은 할 일이 없어도 켜짐 (747 전부터 — 줄일 게 없어 화면은 같음)
    expect(walk('vs', null, null, null).map((s) => s.at(-1))).toEqual(['vsTight', 'short', 'noFaint']);
  });
});
