/**
 * 안 볼 때 계산 (mvp-spec 3.3 U2 · 9장) — 패널이 안 보이고 자동 전투가 켜져 있으면 확장 쪽에서 게임을 이어 돌린다.
 * 그림은 안 그리고 계산만. 웹뷰와 같은 advance 를 쓰므로 결과가 같다.
 */
import { TIMING } from '../core/balance';

export interface HeadlessRunnerOptions {
  intervalMs?: number;
  maxCatchUpMs?: number;
  now?: () => number;
}

export class HeadlessRunner {
  private timer: ReturnType<typeof setInterval> | null = null;
  private last = 0;
  private readonly intervalMs: number;
  private readonly maxCatchUpMs: number;
  private readonly now: () => number;

  constructor(private readonly onElapsed: (elapsedMs: number) => void, options: HeadlessRunnerOptions = {}) {
    this.intervalMs = options.intervalMs ?? TIMING.headlessIntervalMs;
    this.maxCatchUpMs = options.maxCatchUpMs ?? TIMING.headlessMaxCatchUpMs;
    this.now = options.now ?? Date.now;
  }

  get running(): boolean {
    return this.timer !== null;
  }

  start(): void {
    if (this.timer) return;
    this.last = this.now();
    this.timer = setInterval(() => {
      const t = this.now();
      // PC 가 잠들었다 깨면 몇 시간이 한 번에 지나가므로 상한까지만 따라잡음
      const elapsed = Math.min(Math.max(0, t - this.last), this.maxCatchUpMs);
      this.last = t;
      if (elapsed > 0) this.onElapsed(elapsed);
    }, this.intervalMs);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}
