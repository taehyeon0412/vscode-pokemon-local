// 게임 모드 글꼴 받기 — Pretendard (SIL OFL 1.1) → extension/media/fonts/
//
//   node scripts/fetch-fonts.mjs      버전 · 해시가 고정돼 있어 늘 같은 파일 (버전을 바꾸면 해시도 같이 고침)
//
// - 가변 글꼴 하나 (굵기 45 ~ 920 · 한글 11,172자) — game.css 의 @font-face 가 ../fonts/PretendardVariable.woff2 로 부름
// - 라이선스 전문은 글꼴 옆에 (OFL: 글꼴과 함께 나눠야 함) + extension/THIRD-PARTY-NOTICES.txt (scripts/make-notices.mjs)
import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const VERSION = '1.3.9';
const BASE = `https://cdn.jsdelivr.net/npm/pretendard@${VERSION}/dist`;
const OUT = join(ROOT, 'extension', 'media', 'fonts');
/** 받을 파일 → 저장 이름 · sha256 (jsDelivr 파일 목록의 해시, base64) */
const FILES = [
  { from: 'web/variable/woff2/PretendardVariable.woff2', to: 'PretendardVariable.woff2', sha256: 'lZnxL9QvwLzhzVC0egwCLhCNeqZN0NG7DtRPMoLZALQ=' },
  { from: 'LICENSE.txt', to: 'Pretendard-LICENSE.txt', sha256: 'sEU4yavsOaPbdRCM8K8P2cdwMv6Kos84NFtNJQ6Y444=' },
];

mkdirSync(OUT, { recursive: true });
for (const f of FILES) {
  const res = await fetch(`${BASE}/${f.from}`);
  if (!res.ok) throw new Error(`${f.from} 받기 실패: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const got = createHash('sha256').update(buf).digest('base64');
  if (got !== f.sha256) throw new Error(`${f.from} 해시가 다름 (${got}) — 버전을 바꿨으면 해시도 고침`);
  writeFileSync(join(OUT, f.to), buf);
  console.log(`${f.to} ${Math.round(buf.length / 1024)}KB`);
}
