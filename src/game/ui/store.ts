/** 작은 상태 상자 — 값이 바뀌면 화면 컴포넌트에 알림 (useStore 로 씀) */
export class Store<T extends object> {
  private value: T;
  private readonly listeners = new Set<() => void>();

  constructor(initial: T) {
    this.value = initial;
  }

  get(): T {
    return this.value;
  }

  /** 바뀐 칸만 — 하나도 안 바뀌면 알리지 않음 */
  set(patch: Partial<T>): void {
    const keys = Object.keys(patch) as (keyof T)[];
    if (keys.every((k) => Object.is(this.value[k], patch[k]))) return;
    this.value = { ...this.value, ...patch };
    for (const fn of this.listeners) fn();
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }
}
