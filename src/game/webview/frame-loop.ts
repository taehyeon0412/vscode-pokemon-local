/** 그리기 박자 — requestAnimationFrame 으로 돌고, 지난 시간을 넘겨줌 (패널이 안 보이면 브라우저가 알아서 멈춤) */
export class FrameLoop {
  private handle: number | null = null;
  private last: number | null = null;

  /** onError: 프레임에서 오류가 나 멈췄을 때 (확장에 넘겨 아무도 계산하지 않는 채로 두지 않게) */
  constructor(private readonly onFrame: (dtMs: number) => void, private readonly onError: (e: unknown) => void = () => undefined) {}

  get running(): boolean {
    return this.handle !== null;
  }

  start(): void {
    if (this.handle !== null) return;
    this.last = null;
    const tick = (t: number) => {
      const dt = this.last === null ? 0 : t - this.last;
      this.last = t;
      try {
        this.onFrame(dt);
      } catch (e) {
        // 매 프레임 같은 오류를 내지 않게 멈춤 — 확장이 다시 start 를 보내면 다시 돎
        console.error('[pokemon-game] 프레임 오류로 멈춤', e);
        this.stop();
        this.onError(e);
        return;
      }
      if (this.handle !== null) this.handle = requestAnimationFrame(tick);
    };
    this.handle = requestAnimationFrame(tick);
  }

  stop(): void {
    if (this.handle !== null) cancelAnimationFrame(this.handle);
    this.handle = null;
    this.last = null;
  }
}
