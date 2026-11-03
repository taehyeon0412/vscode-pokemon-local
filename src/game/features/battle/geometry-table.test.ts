import { describe, expect, it } from 'vitest';
import { battleGeometry } from './model';

/**
 * battleGeometry 회귀 표 (ideas 1686) — 크기 × 상대 그림 64 / 83 × 야생 · 트레이너 칸마다 위 한 줄 말 (숨김 · 줄 수 · 자리 · 위 붐빔) · 메뉴 (자리 · 아래 끝 · 상대 HP 덮음) 를 한 줄로.
 * 바꾸면 이 표가 달라져 테스트가 실패 → 의도한 것이면 `npx vitest run -u` 로 표를 고치고 `python dev/geometry-diff.py` 로 나빠진 칸 수를 봄 (634 — liftMenu 견줌 하나만 있던 것)
 */
const WIDTHS = [240, 260, 300, 340, 400, 480, 560, 640, 720, 860, 1200, 1860];
const HEIGHTS = [150, 160, 170, 187, 200, 230, 260, 315];

function row(w: number, h: number, px: number, foeTrainer: boolean): string {
  const uiScale = 1.3;
  const g = battleGeometry({ widthPx: w, bodyPx: h - 26, scale: 2, uiScale, ground: 23, foeX: Math.max(48, Math.round(w * 0.45)) + 44 * 2, meSpritePx: 64, foeSpritePx: px, heroPx: 40, heroWidthPx: 32, gapPx: 8, foeTrainer });
  const msg = g.msgSide ? 'side' : g.msgRight ? 'right' : 'top';
  const menu = g.menuInBar ? 'bar' : g.menuSide ? 'side' : 'top';
  // 메뉴가 상대 HP 묶음 (위 필살기 게이지 줄까지) 을 덮음 — 가로로 겹치고 세로 (아래에서 잰 값 — CSS bottom) 가 겹침 (bugs 2733 과 같은 재기 · 메뉴는 menuLeft 부터 오른쪽 끝)
  const menuPx = Math.round(19 * uiScale);
  const across = g.foeHpX - g.foeHpWide / 2 < w - 6 && g.foeHpX + g.foeHpWide / 2 > g.menuLeft;
  const over = menu === 'top' && across && g.menuBottom < g.foeHpBottom + g.hpBlockPx && g.menuBottom + menuPx > g.foeHpBottom ? 1 : 0;
  return `${w}x${h} ${px}${foeTrainer ? ' T' : ''} | hide=${g.msgHidden ? 1 : 0} lines=${g.msgLines} msgTop=${g.msgTop} busy=${g.topBusy ? 1 : 0} msg=${msg} menu=${menu} menuB=${g.menuBottom} over=${over}`;
}

describe('battleGeometry 회귀 표 (ideas 1686)', () => {
  it('크기 × 64 / 83 × 야생 · 트레이너 — 바뀐 칸은 표 비교로 (의도면 -u 뒤 dev/geometry-diff.py)', async () => {
    const lines: string[] = [];
    for (const w of WIDTHS) for (const h of HEIGHTS) for (const px of [64, 83]) for (const t of [false, true]) lines.push(row(w, h, px, t));
    await expect(lines.join('\n') + '\n').toMatchFileSnapshot('./__snapshots__/battle-geometry.txt');
  });
});
