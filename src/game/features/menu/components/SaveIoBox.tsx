/**
 * 세이브 내보내기 · 가져오기 (orders #33 · gdd S20 ④ · U6) — 불러오기 확인 상자 · 망가진 파일 안내 · 결과 한 줄.
 * 확장이 파일 창을 열고 (webview-session saveIO), 화면은 고르기 · 알리기만. 판 위 가운데 상자 (길 위 상자와 같은 판).
 * 확인 = [Enter 불러오기] (지금 세이브는 백업 파일로 따로) · [Esc 그만두기] — 결과 한 줄은 3초 뒤 저절로 닫힘 (U1 — 1초 넘게).
 * 묻는 상자 · 오류 상자가 떠 있는 동안은 게임이 멈추고 (main.ts) 키는 모두 이 상자가 받음 — 결과 한 줄은 키를 안 가져감 (개발 #48).
 */
import { useEffect } from 'preact/hooks';
import { speciesOf } from '../../../data';
import { Button } from '../../../ui/Button';
import { formatMoney, formatPlayTime } from '../../../ui/format';
import { KeyCap } from '../../../ui/KeyCap';
import type { TitleInfo } from '../../../shared/messages';

/** 확장이 보낸 불러오기 상태 (webview-session SaveIoView 와 같은 모양 — 화면 층은 웹뷰를 안 가져옴) */
export interface SaveIoState {
  /** fixes = 읽으며 고친 곳 수 · lost = 이 버전에 없어 빠지는 포켓몬 수 (webview-session SaveIoView — 개발 #48) */
  ask?: { name: string; summary: TitleInfo['summary']; fixes?: number; lost?: number };
  error?: string;
  name?: string;
  result?: { ok: boolean; text: string };
}

const RESULT_MS = 3000;

type Act = 'import-confirm' | 'import-cancel' | 'dismiss';

export function SaveIoBox({ io, onAct }: { io: SaveIoState; onAct(kind: Act): void }) {
  // 묻는 상자 · 오류 상자만 키를 받음 (판 (설정) 의 Esc 닫기 · 게임 키보다 먼저 — capture): Enter · Esc = 고름, 그 밖의 키는 게임에 안 넘김 (Tab 은 버튼 사이 이동).
  //   결과 한 줄 (3초) 은 안 받음 — 내보낸 직후 Esc 가 설정 판을 안 닫고 게임 Enter 가 먹히던 것 (개발 #48)
  const asking = !!(io.ask || io.error);
  useEffect(() => {
    if (!asking) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Tab') return;
      e.stopPropagation();
      if (e.key !== 'Enter' && e.key !== 'Escape') return;
      e.preventDefault();
      if (e.repeat) return;
      if (io.ask) onAct(e.key === 'Enter' ? 'import-confirm' : 'import-cancel');
      else onAct('dismiss');
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [asking, io, onAct]);
  useEffect(() => {
    if (!io.result) return;
    const t = window.setTimeout(() => onAct('dismiss'), RESULT_MS);
    return () => window.clearTimeout(t);
  }, [io.result, onAct]);
  if (io.result) {
    return (
      <div class={`pg-banner pg-saveio pg-saveio-result${io.result.ok ? '' : ' pg-saveio-fail'}`} role="status">
        {io.result.text}
      </div>
    );
  }
  if (io.ask) {
    const s = io.ask.summary;
    const lead = s?.lead ? `${speciesOf(s.lead.species)?.name.ko ?? s.lead.form} Lv ${s.lead.level}` : null;
    return (
      // 버튼 줄이 150 높이에서도 보이게 세 줄 (물음 + 보관 안내 / 요약 / 버튼) · 파일 이름은 title (240 × 150 에서 상자가 길어져 [그만두기] 가 잘리던 것)
      <div class="pg-banner pg-saveio pg-two" role="dialog" aria-label="세이브 불러오기" title={`${io.ask.name}${s ? ` — ${formatMoney(s.money)} · 플레이 ${formatPlayTime(s.playTimeMs)}` : ''}`}>
        <span class="pg-line pg-saveio-q">
          <b>이 세이브로 바꿀까요?</b>
          <span class="pg-dim">지금 것은 백업해 둬요</span>
        </span>
        {/* 읽으며 고친 곳 · 이 버전에 없어 빠지는 포켓몬 (다른 PC 의 더 새 빌드 세이브 — 말없이 빠지던 것, 개발 #48) · 빠지면 빨강 */}
        {(io.ask.fixes || io.ask.lost) && (
          <span class="pg-line pg-saveio-note">
            {io.ask.fixes ? <span class="pg-dim">고친 곳 {io.ask.fixes}</span> : null}
            {io.ask.lost ? <span class="pg-saveio-lost">포켓몬 {io.ask.lost}마리가 이 버전에 없어 빠져요</span> : null}
          </span>
        )}
        {s && (
          <span class="pg-line pg-saveio-sum">
            {lead && <span>{lead}</span>}
            {s.where && <span>{s.where}</span>}
            <span>배지 {s.badges.length}</span>
            {/* 좁으면 (480 아래) 돈 · 플레이 시간을 뺌 — 150 높이에서 버튼 줄이 잘리지 않게 (title 에는 늘) */}
            <span class="pg-long">{formatMoney(s.money)}</span>
            <span class="pg-dim pg-long">플레이 {formatPlayTime(s.playTimeMs)}</span>
          </span>
        )}
        <span class="pg-line pg-saveio-act">
          <Button onClick={() => onAct('import-confirm')} title="Enter — 이 세이브로 바꾸고 게임에 다시 들어가요">
            <KeyCap k="Enter" /> 불러오기
          </Button>
          <Button secondary onClick={() => onAct('import-cancel')} title="Esc — 지금 세이브 그대로">
            <KeyCap k="Esc" /> 그만두기
          </Button>
        </span>
      </div>
    );
  }
  return (
    <div class="pg-banner pg-saveio pg-saveio-fail pg-two" role="alert">
      <span class="pg-line">
        <b>불러오지 못했어요</b>
        {io.name && <span class="pg-dim">{io.name}</span>}
      </span>
      <span class="pg-line pg-saveio-act">
        <span>{io.error}</span>
        <Button secondary onClick={() => onAct('dismiss')} title="Enter · Esc">
          확인
        </Button>
      </span>
    </div>
  );
}
