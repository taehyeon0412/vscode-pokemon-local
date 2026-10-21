/**
 * S08 트레이너 만남 — 1:1 / 3:3 고르기 · 3마리 고르기 (orders #17 — 디자인 4안 "만남 · 고르기"). 기능 뼈대 — 모양은 디자인팀 (pg-team-choice-*).
 * 주 버튼 (Enter) = 지난번 고른 방식 (처음 1:1) · 3:3 = 키 3 · 3:3 을 고르면 상성 좋은 셋이 미리 체크 → 1 ~ 5 로 넣고 빼기 · Enter = 시작 (늦어도 teamPickAutoMs 뒤 저절로).
 * 엔진 입력은 그대로 (team-mode · team-pick · space) — 키는 main.ts.
 */
import { BALANCE, TIMING } from '../../../core/balance';
import { teamLock, teamPickOf, type GameInput, type GameState } from '../../../core/engine';
import { speciesOf } from '../../../data';
import { Button } from '../../../ui/Button';
import { Sprite } from '../../../ui/Sprite';

/** 3:3 을 고를 수 있는 만남인지 (본편 스위치 · 개발 모드 (임시) 3:3 미리 켜기) */
export function teamChoiceOn(state: GameState): boolean {
  const st = state.runtime.stage;
  const on = BALANCE.team.on || state.runtime.dev?.team === true;
  // 체육관 대기실 — 관장 3:3 에 나갈 셋 (도전 = 대기실 주 버튼)
  if (st?.phase === 'lobby') return on && state.save.location.screen === 'gym' && teamPickOf(state) !== null;
  return st?.phase === 'trainer' && st.ms >= TIMING.trainerAlertMs && on && state.save.pendingEncounter?.kind === 'trainer';
}

export function TeamChoice({ state, media, onInput }: { state: GameState; media: string; onInput(i: GameInput): void }) {
  const st = state.runtime.stage;
  if (st?.phase !== 'trainer' && st?.phase !== 'lobby') return null;
  const save = state.save;
  const lock = teamLock(state);
  const pick = teamPickOf(state);
  const lobby = st.phase === 'lobby';
  const team = lobby || (st.team ?? save.settings.teamMode === true);
  if ((lobby || st.team) && pick) {
    // 3마리 고르기 — 팀 순서 키 1 ~ 5 · 고른 순서 = 싸울 때 발밑 판 키
    const left = st.phase === 'trainer' ? Math.max(0, 1 - (st.pickMs ?? 0) / TIMING.teamPickAutoMs) : 0;
    return (
      <div class={`pg-team-choice pg-team-pick${lobby ? ' pg-team-pick-lobby' : ''}`}>
        {save.party.map((uid, i) => {
          const m = save.monsters[uid];
          if (!m) return null;
          const order = pick.indexOf(uid);
          const down = m.hp <= 0;
          return (
            <button key={uid} type="button" class={`pg-team-pk${order >= 0 ? ' pg-on' : ''}${down ? ' pg-down' : ''}`} disabled={down} onClick={() => onInput({ kind: 'team-pick', uid })} title={`${speciesOf(m.species)?.name.ko ?? m.form} Lv${m.level} — ${i + 1} 넣고 빼기`}>
              <span class="pg-team-key">{i + 1}</span>
              <Sprite media={media} form={m.form} shiny={m.shiny} scale={1} crop={24} />
              <span class="pg-team-pk-lv">Lv{m.level}</span>
              {order >= 0 && <span class="pg-team-ord">{order + 1}</span>}
            </button>
          );
        })}
        {/* 대기실은 도전 (대기실 주 버튼 · Enter) 으로 시작 — 여기엔 몇 마리 골랐는지만 */}
        {lobby ? (
          <span class="pg-team-count">{`관장 3:3 ${pick.length}/${BALANCE.team.size}`}</span>
        ) : (
          <Button extraClass="pg-team-start" onClick={() => onInput({ kind: 'space' })} disabled={pick.length === 0} title="고른 셋으로 시작 (Enter)">
            <span class="pg-menu-key">Enter</span> 시작 {`${pick.length}/${BALANCE.team.size}`}
            <span class="pg-team-left" style={{ width: `${Math.round(left * 100)}%` }} />
          </Button>
        )}
      </div>
    );
  }
  // 1:1 / 3:3 — 주 버튼 = 지난번 고른 방식 · 다른 쪽은 작은 버튼
  const why = lock === 'few' ? '살아 있는 포켓몬이 3마리 있어야 3:3' : lock === 'narrow' ? '패널을 넓히면 3:3' : null;
  if (st.phase !== 'trainer') return null;
  const left = Math.max(0, 1 - st.ms / TIMING.trainerMeetMs);
  return (
    <div class="pg-team-choice">
      <Button
        secondary={team}
        extraClass="pg-team-mode"
        onClick={() => {
          // 1:1 은 바로 시작
          onInput({ kind: 'team-mode', on: false });
          onInput({ kind: 'space' });
        }}
        title="1:1 토너먼트"
      >
        {!team && <span class="pg-menu-key">Enter</span>} 1:1
      </Button>
      <Button secondary={!team} extraClass={`pg-team-mode${why ? ' pg-locked' : ''}`} disabled={!!why} onClick={() => onInput({ kind: 'team-mode', on: true })} title={why ?? '3:3 실시간 팀 배틀 (3)'}>
        <span class="pg-menu-key">{team ? 'Enter' : '3'}</span> 3:3
      </Button>
      {!why && <span class="pg-team-left" style={{ width: `${Math.round(left * 100)}%` }} />}
    </div>
  );
}
