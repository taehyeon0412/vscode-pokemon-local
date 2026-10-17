/**
 * S02 타이틀 — 확장이 보낸 세이브 요약(TitleInfo)을 화면에 보일 것으로 (화면을 모름, 자동 테스트).
 * 안내 문구는 여기 한 곳에서 (확장은 까닭을 코드 값으로만 보냄).
 */
import { speciesOf } from '../../data';
import type { TitleInfo, TitleNotice } from '../../shared/messages';

export interface TitleSummary {
  /** 팀 맨 앞 포켓몬 */
  lead: { form: string; name: string; level: number } | null;
  badges: number;
  money: number;
  playTimeMs: number;
}

export interface TitleView {
  /** ① 새로 하기 · ② 이어 하기를 누를 수 있음 — 다른 창이 게임 중이면 둘 다 흐리게 (그 창이 끝나면 확장이 다시 보냄) */
  canStart: boolean;
  /** ② 이어 하기 — 읽을 수 있는 세이브가 있을 때만 (없으면 흐리게, mvp-spec S02 [제안]) */
  canContinue: boolean;
  /** 이어 하기가 흐릴 때 까닭 (버튼에 마우스를 올리면) */
  continueHint: string | null;
  /** ① 새로 하기 — 세이브가 있으면 "지금 저장이 지워져요" 확인 한 번 (읽지 못한 세이브도 지워지는 것은 같음) */
  confirmNew: boolean;
  /** 이어 하기 옆 요약 [제안] (배지는 타이틀에도 보임, U8) */
  summary: TitleSummary | null;
  /** 노란 안내 줄 — 패널이 낮아 첫 줄만 보이고, 나머지는 마우스를 올리면 */
  warnings: string[];
}

const BROKEN = '세이브를 읽지 못했어요 (원본은 백업해 뒀어요) — 새로 하기만 할 수 있어요';
const NEWER = '더 새 버전 확장에서 만든 세이브예요 — 확장을 업데이트하면 이어 할 수 있어요';
export const BUSY_WARNING = '다른 VS Code 창에서 게임 중이에요 — 그 창에서 일반 모드로 바꾸면 여기서 할 수 있어요';

export const NOTICE_TEXT: Record<TitleNotice, string> = {
  busy: BUSY_WARNING,
  'no-save': '이어 할 세이브가 없어요',
  locked: '세이브를 지금 쓸 수 없어요 (더 새 버전 세이브 · 백업 실패)',
  'write-failed': '세이브를 쓰지 못했어요 (디스크를 확인해 주세요)',
  'bad-save': '새 게임을 만들지 못했어요',
};

export function titleView(info: TitleInfo): TitleView {
  const s = info.save === 'ok' ? info.summary : null;
  const warnings: string[] = [];
  if (info.busy) warnings.push(BUSY_WARNING);
  if (info.save === 'broken') warnings.push(BROKEN);
  if (info.save === 'newer') warnings.push(NEWER);
  // 방금 누른 것이 안 된 까닭이 맨 앞 (같은 말이면 한 번만)
  if (info.notice) {
    const text = NOTICE_TEXT[info.notice];
    if (!warnings.includes(text)) warnings.unshift(text);
  }
  const continueHint = info.save === 'ok' ? null : info.save === 'none' ? '이어 할 세이브가 없어요' : info.save === 'broken' ? BROKEN : NEWER;
  return {
    canStart: !info.busy,
    canContinue: info.save === 'ok',
    continueHint,
    confirmNew: info.save !== 'none',
    summary: s
      ? {
          lead: s.lead ? { form: s.lead.form, name: speciesOf(s.lead.species)?.name.ko ?? s.lead.form, level: s.lead.level } : null,
          badges: s.badges.length,
          money: s.money,
          playTimeMs: s.playTimeMs,
        }
      : null,
    warnings,
  };
}
