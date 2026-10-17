/**
 * 세이브 파일 — VS Code 가 이 확장에 주는 전역 저장 폴더(globalStorageUri)의 save.json.
 *
 * globalState 대신 파일인 까닭 (단계 1 실제 VS Code 테스트 · 코드 리뷰):
 * - VS Code 를 끌 때 globalState 쓰기는 끝나지 않음 → 파일은 끌 때 동기로 바로 씀
 * - globalState 는 확장 하나에 한 덩어리라, 다른 창이 다른 키(일반 모드 포켓몬 목록)를 쓸 때 들고 있던 옛 세이브까지 같이 다시 씀
 * - 창 사이에 늦게 퍼짐 → 파일은 다른 창에서 바로 보임
 * 쓰기는 모두 동기 (몇 KB 라 1ms 남짓) — 쓰기 순서가 뒤바뀌는 일이 없음.
 * 임시 파일에 쓰고 디스크에 확실히 넣은(fsync) 뒤 이름을 바꿈 → 쓰다가 꺼져도 반쯤 쓴 파일이 save.json 이 되지 않음.
 * 바꾸기 전 세이브는 save.json.bak 으로 남겨 두고, save.json 을 읽지 못하면 .bak 을 읽음 (정전 · 블루스크린 대비).
 */
import { closeSync, copyFileSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, renameSync, rmSync, writeSync } from 'fs';
import { dirname } from 'path';

export interface SaveStorage {
  /** 없으면 undefined. 글자가 JSON 이 아니면 { unreadable: 글자 } (망가진 세이브로 보관되게) */
  read(): unknown;
  write(value: unknown): void;
}

export class FileSaveStorage implements SaveStorage {
  constructor(private readonly path: string) {}

  read(): unknown {
    const main = readJson(this.path);
    if (main.kind === 'ok') return main.value;
    // save.json 이 없거나 깨졌으면 바로 전 세이브 (.bak) — 그것도 없으면 깨진 글자를 그대로 (보관되게)
    const bak = readJson(`${this.path}.bak`);
    if (bak.kind === 'ok') return bak.value;
    return main.kind === 'unreadable' ? { unreadable: main.text.slice(0, 200_000) } : undefined;
  }

  write(value: unknown): void {
    if (existsSync(this.path) && readJson(this.path).kind === 'ok') {
      retry(() => copyFileSync(this.path, `${this.path}.bak`));
    }
    writeAtomic(this.path, JSON.stringify(value), { durable: true });
  }
}

function readJson(path: string): { kind: 'missing' } | { kind: 'ok'; value: unknown } | { kind: 'unreadable'; text: string } {
  if (!existsSync(path)) return { kind: 'missing' };
  const text = readFileSync(path, 'utf8');
  try {
    return { kind: 'ok', value: JSON.parse(text) as unknown };
  } catch {
    return { kind: 'unreadable', text };
  }
}

/** 동기로 잠깐 쉼 (윈도우에서 백신 · 색인 프로그램이 파일을 잠깐 잡고 있을 때 다시 하려고) */
function pause(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

const RETRYABLE = new Set(['EPERM', 'EBUSY', 'EACCES']);

/** 윈도우에서 다른 프로그램이 잠깐 잡고 있으면 조금씩 쉬며 몇 번 다시 */
function retry<T>(fn: () => T): T {
  for (let attempt = 0; ; attempt++) {
    try {
      return fn();
    } catch (e) {
      if (attempt >= 5 || !RETRYABLE.has((e as { code?: string }).code ?? '')) throw e;
      pause(10 * (attempt + 1));
    }
  }
}

/**
 * 임시 파일(프로세스마다 다른 이름)에 쓰고 이름을 바꿈.
 * durable: 이름을 바꾸기 전에 내용을 디스크에 확실히 넣음 (fsync) — 정전에도 0바이트 파일이 남지 않게
 */
export function writeAtomic(path: string, text: string, options: { durable?: boolean } = {}): void {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.${process.pid}.tmp`;
  try {
    const fd = openSync(tmp, 'w');
    try {
      writeSync(fd, text, 0, 'utf8');
      if (options.durable) fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
    retry(() => renameSync(tmp, path));
  } catch (e) {
    rmSync(tmp, { force: true });
    throw e;
  }
}
