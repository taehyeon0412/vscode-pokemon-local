import { describe, expect, it } from 'vitest';
import boxesJson from '../../../data/generated/sprite-boxes.json';
import { walkArtBoxOf } from '../../../data/sprite-boxes';
import { cropPlace } from '../../../ui/Sprite';
import { spritePx } from '../../../ui/sprite-path';
import { cutinArtH } from './TeamCutin';

describe('합동 컷인 큰 그림 창 (걷기 그림 — 아트 디렉터 1675b)', () => {
  it('모든 포켓몬 · 내 쪽 · 상대 쪽 (좌우 뒤집음) × 배율 1 · 2 · 3: 걷기 장면을 다 합친 그림이 창 안 (대기 그림 위 끝으로 재 차오꿀 머리 3칸 × k · 라이츄 상대 꼬리 2칸 × k 가 잘리던 것)', () => {
    const bad: string[] = [];
    for (const f of Object.keys(boxesJson)) {
      const wb = walkArtBoxOf(f)!;
      const n = spritePx(f, 1);
      // 자료 크기가 그림보다 작게 적힌 모습은 뺌 (arceus_bug — forms.json 32 · 그림 64, bugs 2731 개발 몫)
      if (wb[2] > n || wb[3] > n) continue;
      for (const k of [1, 2, 3]) {
        for (const faceLeft of [false, true]) {
          const crop = cutinArtH(f, k);
          const cw = n * k;
          const { left, top } = cropPlace(f, crop, cw, { action: 'walk', faceLeft, zoom: k, bottom: true, bottomPad: 2 * k });
          const [l, r] = faceLeft ? [left + (n - wb[2]) * k, left + (n - wb[0]) * k] : [left + wb[0] * k, left + wb[2] * k];
          if (top + wb[1] * k < 0 || l < 0 || r > cw) bad.push(`${f} ×${k}${faceLeft ? ' 상대' : ''} 위 ${top + wb[1] * k} 가로 ${l}~${r} / ${cw}`);
        }
      }
    }
    expect(bad).toEqual([]);
  });
});
