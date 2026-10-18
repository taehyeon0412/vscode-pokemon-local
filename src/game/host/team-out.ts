/**
 * S01 ② 📦 내 포켓몬 꺼내기 (확장 쪽) — 꺼냄 · 넣음 상태를 기억하고, 일반 모드 웹뷰에 팀을 보냄.
 *   꺼내기 → 세이브를 다시 읽어 (다른 창이 바꿨을 수 있음) 팀을 보냄 · 넣기 → 빈 목록
 *   웹뷰가 새로 뜨면 (패널을 다시 열거나 다시 로드) · 게임 모드에서 돌아오면 (레벨 · 진화 · 기술이 바뀜) 다시 보냄
 * 상태는 이 PC 에만 (globalState, 설정 동기화 안 함) — VS Code 를 다시 켜도 꺼낸 채로.
 * VS Code 를 모른다 (보내기 · 저장 · 제목줄 표시는 deps) → 자동 테스트에서 그대로 돌림.
 */
import type { Save } from '../core/save';
import { teamInMessage, teamOutMessage } from '../features/team/model';
import type { TeamOutMessage } from '../shared/team-out';

/** 꺼낼 세이브 — 없음 · 망가짐 · 더 새 버전이면 까닭만 */
export type TeamSave = { kind: 'ok'; save: Save } | { kind: 'none' | 'broken' | 'newer' };

export interface TeamOutDeps {
  post(message: TeamOutMessage): void;
  /** 세이브를 읽기만 */
  readSave(): Promise<TeamSave>;
  /** 꺼냄 상태 (이 PC 에만) */
  load(): boolean;
  store(on: boolean): void;
  /** 제목줄 📦 ↔ 넣기 버튼 (when 의 vscode-pokemon.teamOut) */
  setContext(on: boolean): void;
  /** 세이브가 없을 때 안내 */
  info(message: string): void;
}

export const NO_SAVE_TEXT = '게임 세이브가 없어요 — 🎮 게임 모드에서 스타팅을 고르면 꺼낼 수 있어요.';
export const BROKEN_SAVE_TEXT = '게임 세이브를 읽지 못해서 꺼낼 수 없어요 — 🎮 타이틀에서 상태를 확인해 주세요.';
export const NEWER_SAVE_TEXT = '더 새 버전 확장에서 만든 세이브라 꺼낼 수 없어요 — 확장을 업데이트해 주세요.';
const saveOf = (r: TeamSave): Save | null => (r.kind === 'ok' ? r.save : null);

export class TeamOut {
  private on: boolean;
  /** 보낼 때마다 +1 — 세이브를 읽는 사이에 넣기 · 다른 꺼내기가 오면 옛 결과는 버림 */
  private seq = 0;

  constructor(private readonly deps: TeamOutDeps) {
    this.on = deps.load();
    deps.setContext(this.on);
  }

  get isOut(): boolean {
    return this.on;
  }

  /** 📦 꺼내기 */
  async takeOut(): Promise<void> {
    const n = ++this.seq;
    const read = await this.deps.readSave();
    if (n !== this.seq) return;
    const msg = teamOutMessage(saveOf(read));
    if (msg.team.length === 0) {
      this.deps.info(read.kind === 'broken' ? BROKEN_SAVE_TEXT : read.kind === 'newer' ? NEWER_SAVE_TEXT : NO_SAVE_TEXT);
      return;
    }
    this.set(true);
    this.deps.post(msg);
  }

  /** 넣기 */
  putIn(): void {
    this.seq++;
    this.set(false);
    this.deps.post(teamInMessage());
  }

  /** 웹뷰가 새로 뜸 · 게임 모드에서 돌아옴 — 꺼낸 채면 지금 팀으로 다시 */
  async refresh(): Promise<void> {
    // 다른 창에서 꺼내기 · 넣기를 했을 수 있음 (상태는 창끼리 같이 씀)
    const kept = this.deps.load();
    if (kept !== this.on) {
      this.on = kept;
      this.deps.setContext(kept);
      // 다른 창에서 넣었으면 이 창 화면의 팀도 치움
      if (!kept) {
        this.seq++;
        this.deps.post(teamInMessage());
      }
    }
    if (!this.on) return;
    const n = ++this.seq;
    const read = await this.deps.readSave();
    if (n !== this.seq || !this.on) return;
    this.deps.post(teamOutMessage(saveOf(read)));
  }

  private set(on: boolean): void {
    if (this.on === on) return;
    this.on = on;
    this.deps.store(on);
    this.deps.setContext(on);
  }
}
