/**
 * 시드 랜덤 (mulberry32).
 * 상태가 숫자 하나라 게임 상태에 실어 확장 ↔ 웹뷰로 넘길 수 있고,
 * 같은 시드면 어디서 돌려도 같은 결과가 나온다 (안 볼 때 확장 쪽에서 이어 돌려도 같음).
 */
export class Rng {
  private s: number;

  constructor(seed: number) {
    this.s = seed >>> 0;
  }

  /** 지금 상태 — 저장해 두었다가 new Rng(state) 로 이어 감 */
  get state(): number {
    return this.s;
  }

  /** 0 이상 1 미만 */
  next(): number {
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** min 이상 max 이하 정수 */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  /** 확률 p (0~1) 로 참 */
  chance(p: number): boolean {
    return this.next() < p;
  }
}
