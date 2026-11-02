/**
 * dev 도구가 머리 없는 브라우저에 포커스 흉내를 켜는지 (#140 2026-11-02) — 포커스 없이 뜬 판은 document.timeline 이 0 에 멈춰
 * CSS 애니메이션이 안 끝나고 쌓여 멈칫 · 연속 캡처가 실제와 달라짐. CDP 로 페이지를 여는 도구 (Page.enable) 는 Emulation.setFocusEmulationEnabled 도.
 * 실제 VS Code 에 붙는 도구 (vscode-*.py) 는 뺌 — 흉내 없이 진짜 포커스 그대로 재야 해서.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const DEV = join(__dirname, '..', '..', '..', 'dev');

describe('dev 도구 포커스 흉내', () => {
  it('Page.enable 을 부르는 도구는 setFocusEmulationEnabled 도 부름', () => {
    const tools = readdirSync(DEV).filter((name) => name.endsWith('.py') && !name.startsWith('vscode-'));
    const cdp = tools.filter((name) => readFileSync(join(DEV, name), 'utf8').includes('"Page.enable"'));
    expect(cdp.length).toBeGreaterThan(5);
    expect(cdp.filter((name) => !readFileSync(join(DEV, name), 'utf8').includes('"Emulation.setFocusEmulationEnabled"'))).toEqual([]);
  });
});
