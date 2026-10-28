import { describe, expect, it } from 'vitest';
import { OVERLAY_INPUTS } from './overlay-inputs';

describe('판이 떠 있을 때 받는 입력 (main.ts 가 그 밖은 버림)', () => {
  it('지도에서 다음 지역 고르기 · 이동 (orders #66 — 고르기가 버려져 새 지역이 영영 안 열리던 것, 코드 리뷰어)', () => {
    expect(OVERLAY_INPUTS).toContain('region-pick');
    expect(OVERLAY_INPUTS).toContain('travel');
  });
  it('필살기 연출 켬 · 끔 (#97 — 설정 판 · 위쪽 줄 버튼)', () => {
    expect(OVERLAY_INPUTS).toContain('team-cutscene');
  });
  it('놓아주기 (#121 — 내 포켓몬 판의 확인 상자)', () => {
    expect(OVERLAY_INPUTS).toContain('release');
  });
});
