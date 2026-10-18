/**
 * 실제 VS Code 테스트(src/test/integration)에서만 쓰는 손잡이.
 * 확장이 Test 모드로 켜졌을 때만 activate 의 반환값에 실림 — 사용자 PC 에서는 없음.
 */
import type { Save } from '../core/save';
import type { EnterResult, GameSession, SessionStats } from './game-session';
import type { SaveArchive } from './save-archive';
import type { SaveStorage } from './save-file';
import type { LoadResult, SaveStore } from './save-store';

export interface GameTestApi {
  ready: Promise<LoadResult>;
  debug(): {
    mode: string; owner: string; epoch: number; load: string; running: boolean; playTimeMs: number | null; money: number | null; stats: SessionStats;
    /** 스테이지 진행 % (스테이지에 있을 때) · 만난 종 수 · 가방 몬스터볼 수 */
    progress: number | null; seen: number; balls: number;
  };
  enterGame(): Promise<EnterResult>;
  exitGame(): Promise<void>;
  startNewSave(save: Save): Promise<'done' | 'busy' | 'failed'>;
  /** 시간 배속 (게임 중에만) */
  setSpeed(speed: number): boolean;
  /** 웹뷰가 보낸 것처럼 (타이틀 버튼 누르기 등 — 웹뷰 화면은 확장 쪽 테스트에서 누를 수 없어서) */
  fromWebview(message: unknown): void;
  /** 게임 상태의 세이브를 바꾸고 저장은 기다리게만 둠 — VS Code 를 끌 때(deactivate) 저장되는지 보려고 (게임 모드에서) */
  queueUnsaved(patch: Partial<Save>): boolean;
  flush(): Promise<boolean>;
  readStoredRaw(): unknown;
  writeStoredRaw(raw: unknown): void;
  /** 세이브 파일에서 다시 읽기 (확장을 다시 켠 것처럼) */
  reload(): Promise<LoadResult>;
  archiveCount(): Promise<number>;
  /** 일반 모드 웹뷰(main-bundle)에 포켓몬 목록을 물어봄 — 답이 오면 일반 모드가 살아 있음 */
  probeNormalWebview(): Promise<unknown>;
}

export function createTestApi(
  session: GameSession,
  store: SaveStore,
  storage: SaveStorage,
  archive: SaveArchive,
  ready: Promise<LoadResult>,
  probeNormalWebview: () => Promise<unknown>,
): GameTestApi {
  return {
    ready,
    debug() {
      const s = session.snapshot;
      const loc = s.state?.save.location;
      return {
        mode: s.mode, owner: s.owner, epoch: s.epoch, load: s.load, running: s.running,
        playTimeMs: s.state?.save.playTimeMs ?? null, money: s.state?.save.money ?? null, stats: { ...session.stats },
        progress: loc?.screen === 'stage' ? (s.state?.save.stages[loc.stageId]?.progress ?? null) : null,
        seen: s.state?.save.dex.seen.length ?? 0,
        balls: s.state?.save.bag['poke-ball'] ?? 0,
      };
    },
    enterGame: () => session.enterGame(),
    exitGame: () => session.exitGame(),
    startNewSave: (save) => session.startNewSave(save),
    setSpeed: (speed) => session.setSpeed(speed),
    fromWebview: (message) => session.handleMessage(message),
    queueUnsaved: (patch) => session.changeSave((s) => ({ ...s, ...patch })),
    flush: () => store.flush(),
    readStoredRaw: () => storage.read(),
    writeStoredRaw: (raw) => storage.write(raw),
    reload: () => session.init({ readOnly: true }),
    archiveCount: async () => (await archive.list()).length,
    probeNormalWebview,
  };
}
