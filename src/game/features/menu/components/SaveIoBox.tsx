/**
 * 세이브 내보내기 · 가져오기 (orders #33 · gdd S20 ④ · U6) — 불러오기 확인 상자 · 망가진 파일 안내 · 결과 한 줄.
 * 확장이 파일 창을 열고 (webview-session saveIO), 화면은 고르기 · 알리기만. 판 위 가운데 상자 (길 위 상자와 같은 판).
 * 확인 = [Enter 불러오기] (지금 세이브는 백업 파일로 따로) · [Esc 그만두기] — 결과 한 줄은 3초 뒤 저절로 닫힘 (U1 — 1초 넘게).
 * 묻는 상자 · 오류 상자가 떠 있는 동안은 게임이 멈추고 (main.ts) 키는 모두 이 상자가 받음 — 결과 한 줄은 키를 안 가져감 (개발 #48).
 */
import { useEffect } from 'preact/hooks';
import { speciesOf } from '../../../data';
import { Button } from '../../../ui/Button';
import { confirmKey, onKeyboardButton, useShownAt } from '../../../ui/confirm-key';
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

/** 묻는 상자 키 → 할 일 — 빠지는 포켓몬이 있으면 (lost) Enter · Space 도 그만두기 · 불러오기는 버튼을 눌러야 (ideas 166 — 덮어쓰기 + 빠짐을 Enter 한 번에 하지 않게) */
export function askKeyAct(key: string, lost: number): 'import-confirm' | 'import-cancel' {
  return key === 'Escape' || lost > 0 ? 'import-cancel' : 'import-confirm';
}

export function SaveIoBox({ io, onAct, inPanel = false }: { io: SaveIoState; onAct(kind: Act): void; /** 설정 판이 열려 있음 — 결과 한 줄은 판이 보여 줌 (여기서는 3초 타이머만) */ inPanel?: boolean }) {
  // 묻는 상자 · 오류 상자만 키를 받음 (판 (설정) 의 Esc 닫기 · 게임 키보다 먼저 — capture): Enter · Esc = 고름, 그 밖의 키는 게임에 안 넘김 (Tab 은 버튼 사이 이동).
  //   결과 한 줄 (3초) 은 안 받음 — 내보낸 직후 Esc 가 설정 판을 안 닫고 게임 Enter 가 먹히던 것 (개발 #48)
  const asking = !!(io.ask || io.error || (io.result && !io.result.ok));
  const shownAt = useShownAt(io.ask ? `ask:${io.ask.name}` : io.error !== undefined ? 'error' : io.result ? 'result' : '');
  useEffect(() => {
    if (!asking) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Tab') return;
      e.stopPropagation();
      // 키보드로 간 버튼 (Tab 으로 [그만두기]) 에 포커스가 있으면 Enter · Space 는 그 버튼이 받음 — Tab 으로 [그만두기] 에 두고 Enter 가 불러오기 (덮어쓰기) 가 되던 것 (#117 테스터)
      if ((e.key === 'Enter' || e.code === 'Space') && onKeyboardButton(e)) return;
      // Space 도 Enter 처럼 (#117 — 연타 묶음 둘째부터 · 상자가 뜬 지 1초 안은 아님)
      const space = e.code === 'Space';
      if (e.key !== 'Enter' && e.key !== 'Escape' && !space) return;
      e.preventDefault();
      if (e.repeat || (space && !confirmKey(e, shownAt))) return;
      if (io.ask) onAct(askKeyAct(e.key, io.ask.lost ?? 0));
      else onAct('dismiss');
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [asking, io, onAct, shownAt]);
  useEffect(() => {
    // 실패는 저절로 안 닫힘 ([확인] 까지 — 사람이 할 일이 있는데 3초 뒤 사라져 다시 못 읽던 것, UX 새 화면 한 바퀴)
    if (!io.result || !io.result.ok) return;
    const t = window.setTimeout(() => onAct('dismiss'), RESULT_MS);
    return () => window.clearTimeout(t);
  }, [io.result, onAct]);
  if (io.result && !io.result.ok) {
    // 개발자 글 (괄호 안 Error · 경로) 은 title 로 · 화면은 쉬운 말
    const plain = io.result.text.replace(/\s*\((?:Error|[A-Z]{3,}|.*[\\/:]).*\)\s*$/, '');
    return (
      <div class="pg-banner pg-saveio pg-saveio-fail pg-two" role="alert" title={io.result.text}>
        <span class="pg-line">
          <b>{plain}</b>
        </span>
        <span class="pg-line pg-saveio-act">
          <span class="pg-dim">다른 폴더 · 파일로 다시 해 보세요</span>
          <Button secondary onClick={() => onAct('dismiss')} title="Enter · Esc">
            확인
          </Button>
        </span>
      </div>
    );
  }
  if (io.result) {
    if (inPanel) return null;
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
            {/* 문장은 크림 · 빠지는 수만 빨강 (지울 때 규칙 — 6장, 문장 전체가 빨강이던 것 · 아트 디렉터) · 330 아래는 "이 버전에 없어" 를 뺌 (맥 글자면 240 에서 줄이 늘어 버튼이 잘리던 것 — 픽셀 검사원) */}
            {io.ask.lost ? (
              <span>
                포켓몬 <span class="pg-saveio-lost">{io.ask.lost}마리</span>가 <span class="pg-w330">이 버전에 없어 </span>빠져요
              </span>
            ) : null}
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
        {/* 빠지는 포켓몬이 있으면 주 버튼 (Enter) = 그만두기 · 불러오기는 눌러야 (ideas 166) — 자리는 그대로 */}
        <span class="pg-line pg-saveio-act">
          {io.ask.lost ? (
            <>
              <Button secondary onClick={() => onAct('import-confirm')} title={`누르면 이 세이브로 바꿔요 — 포켓몬 ${io.ask.lost}마리가 빠져요`}>
                불러오기
              </Button>
              <Button onClick={() => onAct('import-cancel')} title="Enter · Esc — 지금 세이브 그대로">
                <KeyCap k="Enter" /> 그만두기
              </Button>
            </>
          ) : (
            <>
              <Button onClick={() => onAct('import-confirm')} title="Enter — 이 세이브로 바꾸고 게임에 다시 들어가요">
                <KeyCap k="Enter" /> 불러오기
              </Button>
              <Button secondary onClick={() => onAct('import-cancel')} title="Esc — 지금 세이브 그대로">
                <KeyCap k="Esc" /> 그만두기
              </Button>
            </>
          )}
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
