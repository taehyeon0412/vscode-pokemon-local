/**
 * S08 트레이너 만남 — 1:1 / 3:3 고르기 · 3마리 고르기 (orders #17 — 디자인 4안 "만남 · 고르기", 시안 #choose).
 * 만남 = "승부다!" 상자 둘째 줄 (TeamMeet — StageScreen 이 TrainerBanner 안에 넣음, 상자 밖에 두면 VS 이름을 가리던 것) · 3마리 고르기 = 위 가운데 판 (TeamChoice).
 * 주 버튼 (Enter) = 지난번 고른 방식 (처음 1:1) · 3:3 = 키 3 · 3:3 을 고르면 상성 좋은 셋이 미리 체크 → 1 ~ 5 로 넣고 빼기 · Enter = 시작 (늦어도 teamPickAutoMs 뒤 저절로).
 * 엔진 입력은 그대로 (team-mode · team-pick · space) — 키는 main.ts.
 */
import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import { BALANCE, TIMING } from '../../../core/balance';
import { teamChoiceMeet, teamFoesOf, teamLock, teamMainOf, teamPickOf, type GameInput, type GameState } from '../../../core/engine';
import { speciesOf } from '../../../data';
import { TypeTags } from '../components/TypeTag';
import { Button } from '../../../ui/Button';
import { KeyCap } from '../../../ui/KeyCap';
import { Sprite } from '../../../ui/Sprite';

/** 3:3 을 고를 수 있는 만남인지 (본편 스위치 · 개발 모드 (임시) 3:3 미리 켜기) */
export function teamChoiceOn(state: GameState): boolean {
  const st = state.runtime.stage;
  const on = BALANCE.team.on || state.runtime.dev?.team === true;
  // 체육관 대기실 — 관장 3:3 에 나갈 셋 (도전 = 대기실 주 버튼)
  // 고르는 중에 패널이 좁아져 잠겨도 (picking) 판은 그대로 — "넓히면 3:3" 안내 (개발팀 03f8982 — 넓히면 그대로 3:3)
  if (st?.phase === 'lobby') return on && state.save.location.screen === 'gym' && (teamPickOf(state) !== null || (st.picking === true && teamLock(state) !== null));
  return st?.phase === 'trainer' && st.ms >= TIMING.trainerAlertMs && on && state.save.pendingEncounter?.kind === 'trainer';
}

/** 좁은 패널 (400px 아래) — 칸 그림 위주 · 글 줄임 (시안 240 × 150) */
const NARROW_PX = 400;
/** 판 줄이기 (넘치면 한 단계 — 폭 경계를 손으로 고르지 않음, ux-rules U4) — 넘친 쪽만:
 *  칸 묶음이 패널 밖 → 칸 Lv → 칸 "필살기" 글 → 칸 이름 (그림 위주 64px 칸 — 5글자 이름 · Lv 100 이면 480 × 150 에서 판이 패널 밖이던 것, 픽셀 검사원)
 *  제목 줄이 칸 묶음보다 넓음 (오른쪽 끝선이 어긋나던 것) → 상대 타입 동그라미 → 짧은 제목 → "상대" 글 → 제목 이름표 */
// cols = 칸 폭을 열마다 (가장 넓은 칸 하나에 셋 다 맞추면 5글자 이름 하나 · Lv 100 에 400 에서 다섯 칸 이름이 다 빠지던 것 — U518)
const CELL_STEPS = ['tight', 'cols', 'ordword', 'lv', 'name'] as const;
const HEAD_STEPS = ['label', 'types', 'tag'] as const;

/**
 * 만남 둘째 줄 — "승부다!" 상자 안 (4안). 주 버튼 (Enter) = 지난번 고른 방식 · 다른 쪽 작은 버튼 · 주 버튼 아래 금 막대 = "!" 뒤 고르는 시간 (teamChoiceMs) 12걸음 — 다 줄면 주 버튼 방식 (엔진).
 * 3:3 옆 "상대 3 · 돈 ×1.5" — ◓ 가 하나인 트레이너도 3:3 이면 셋 (기획 #24-2 · U5). 고르면 (vsAt) 상자째 VS 로
 */
export function teamMeetOn(state: GameState): boolean {
  const st = state.runtime.stage;
  if (st?.phase !== 'trainer' || st.vsAt !== undefined || st.pick) return false;
  // 잠긴 만남 (3마리 미만 · 좁음) 도 그림 — [Enter 1:1] + 회색 3:3 + "3마리 필요" (gdd S08 ④ 잠김 · 엔진은 예전 4초 박자, UX 리뷰어 2차)
  return teamChoiceMeet(state) || (teamChoiceOn(state) && teamLock(state) !== null && state.save.settings.autoBattle !== true);
}
export function TeamMeet({ state, onInput }: { state: GameState; onInput(i: GameInput): void }) {
  const st = state.runtime.stage;
  if (st?.phase !== 'trainer' || !teamMeetOn(state)) return null;
  const lock = teamLock(state);
  // 잠겼으면 (3마리 미만 · 좁음) 주 버튼 = 1:1 (엔진도 1:1 로 시작 — 코드 리뷰어) · 이번 판 3:3 에서 진 트레이너도 1:1 (teamMainOf — 기획 #27 R8)
  const team = lock === null && (st.team ?? teamMainOf(state));
  const narrow = (state.runtime.view?.w ?? 1000) < NARROW_PX;
  // 체육관 알림 · 대기실과 같은 말 "싸울 수 있는 3마리" (쓰러진 포켓몬이 있을 때 "3마리가 있어야" 와 "살아 있는 3마리면" 이 따로 놀던 것 — 개발 UX #59)
  const why = lock === 'few' ? (narrow ? '싸울 3마리 필요' : '싸울 수 있는 3마리면 3:3') : lock === 'narrow' ? '넓히면 3:3' : null;
  const left = Math.ceil(Math.max(0, Math.min(1, (TIMING.trainerAlertMs + TIMING.teamChoiceMs - st.ms) / TIMING.teamChoiceMs)) * 12) / 12;
  // 잠겼으면 고를 게 없어 막대 없음 (예전 박자)
  const bar = why ? null : <span class="pg-team-left" style={{ width: `${Math.round(left * 100)}%` }} />;
  const n = BALANCE.team.size;
  return (
    <span class="pg-line pg-team-meet">
      <Button
        secondary={team}
        extraClass="pg-team-mode"
        // 1:1 은 바로 VS — 한 입력 (team-mode + space 로 나누면 하나만 먹혀 3:3 이 시작될 수 있던 것, 개발팀 92c4e03)
        onClick={() => onInput({ kind: 'team-mode', on: false, go: true })}
        title="1:1 승부 — 한 마리씩"
      >
        {/* 3:3 이 주 버튼이면 1:1 = 키 1 (엔진 92c4e03 뒤 — 키 칸이 없어 마우스로만 보이던 것, UX 리뷰어 2차) */}
        <KeyCap k={team ? '1' : 'Enter'} />
        {narrow ? '1:1' : '1:1 승부'}
        {!team && bar}
      </Button>
      <Button secondary={!team} extraClass={`pg-team-mode${why ? ' pg-locked' : ''}`} disabled={!!why} onClick={() => onInput({ kind: 'team-mode', on: true })} title={why ?? `3:3 팀 배틀 — 셋이 같이 싸움 · 상대도 ${n}마리 · 돈 ×${BALANCE.team.moneyScale} (3)`}>
        {/* 잠겼으면 키 칸 없음 (눌릴 것처럼 보이지 않게 — 점선 테두리 + "3마리 필요") */}
        {!why && <KeyCap k={team ? 'Enter' : '3'} />}
        {/* 좁고 잠겼으면 "3:3" 만 (옆 "싸울 3마리 필요" 가 240 에서 상자 끝 5px 앞까지 와 맥 글자면 넘침 — 개발 UX #59) */}
        {narrow ? (why ? '3:3' : '3:3 팀') : '3:3 팀 배틀'}
        {team && bar}
      </Button>
      <span class="pg-dim pg-team-meet-note">{why ?? (narrow ? `상대 ${n}` : `상대 ${n} · 돈 ×${BALANCE.team.moneyScale}`)}</span>
    </span>
  );
}

/** 3마리 고르기 (트레이너 만남에서 3:3 · 체육관 대기실) — 4안 판: 제목 줄 (제목 · 상대 셋 · 1:1 로) · 칸 3열 (팀 다섯 = 2줄 · 여섯째 자리 = 시작 버튼).
 *  칸 = 자리 키 (늘 보임 · 고르면 금색 칠) + 그림 24 + 이름 + 고른 순서 "필살기 N" (좁으면 오른쪽 금 테두리 숫자). 150 높이 안에 (시작 줄을 따로 두면 187 에서도 잘리던 것) */
export function TeamChoice({ state, media, onInput }: { state: GameState; media: string; onInput(i: GameInput): void }) {
  const st = state.runtime.stage;
  // 폭 = 창 폭 (runtime.view 는 배율이 바뀔 때만 갱신돼 패널을 넓혀도 줄인 단계가 남던 것 — UX 리뷰어)
  const [w, setW] = useState(() => window.innerWidth);
  useLayoutEffect(() => {
    const on = () => setW(window.innerWidth);
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  const head = useRef<HTMLDivElement>(null);
  const fitKey = `${w}|${st?.phase}|${state.save.party.length}`;
  const fitRef = useRef({ key: '', cell: 0, head: 0 });
  if (fitRef.current.key !== fitKey) fitRef.current = { key: fitKey, cell: 0, head: 0 };
  const [, refit] = useState(0);
  const cut: readonly string[] = [...CELL_STEPS.slice(0, fitRef.current.cell), ...HEAD_STEPS.slice(0, fitRef.current.head)];
  // 넘치면 한 단계 + 정수 px — 칸 폭 = 가장 넓은 칸 (올림) · 판 폭은 (패널 − 판) 이 짝수가 되게 (minmax(0, 1fr) · translateX(−50%) 면 소수 px 로 1px 테두리 · 글이 흐리던 것 — 아트 디렉터)
  const box = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = box.current;
    const room = el?.parentElement?.clientWidth ?? 0;
    if (!el || room <= 0) return;
    const grid = el.querySelector<HTMLElement>('.pg-team-grid');
    if (grid && !el.classList.contains('pg-team-pick-n')) {
      grid.style.removeProperty('--pg-team-cell');
      // cols 단계부터는 열마다 제 폭 (repeat(3, max-content)) — 그 전엔 가장 넓은 칸에 셋 다 맞춤
      const cw = cut.includes('cols') ? 0 : Math.max(0, ...Array.from(grid.querySelectorAll<HTMLElement>('.pg-team-pk'), (c) => c.scrollWidth));
      if (cw > 0) grid.style.setProperty('--pg-team-cell', `${cw}px`);
    }
    el.style.width = '';
    const w = Math.ceil(el.getBoundingClientRect().width);
    const headW = head.current?.scrollWidth ?? 0;
    const gridW = grid?.scrollWidth ?? 0;
    const f = fitRef.current;
    // 칸 묶음 (+ 판 여백 22) 이 패널 밖이면 칸부터 · 아니면 제목 줄이 칸보다 넓을 때 제목 줄
    // 판 값 = 길 위 상자 (최대 폭 = 패널 − 16 — 대기실 상자 → 같은 자리 고르기 판이 바뀔 때 바깥 끝이 움직이던 것, 아트 디렉터 2차)
    if (gridW + 22 > room - 16 && f.cell < CELL_STEPS.length) {
      f.cell += 1;
      refit((v) => v + 1);
      return;
    }
    if (((gridW > 0 && headW > gridW + 1) || w > room - 16) && f.head < HEAD_STEPS.length) {
      f.head += 1;
      refit((v) => v + 1);
      return;
    }
    if (w < room - 16) el.style.width = `${w + ((room - w) % 2)}px`;
  });
  if (st?.phase !== 'trainer' && st?.phase !== 'lobby') return null;
  const save = state.save;
  // 고르는 중에 잠기면 (좁아짐) 엔진은 고르기를 이어 감 — 판은 고른 셋을 그대로 보이고 시작만 막음 ("넓히면 3:3", 개발팀 03f8982 · 판이 통째로 사라지던 것)
  const lock = teamLock(state);
  const pick = teamPickOf(state) ?? (lock === null ? null : st.phase === 'trainer' ? (st.pick ?? null) : st.phase === 'lobby' && st.picking ? (st.pick ?? []) : null);
  const lobby = st.phase === 'lobby';
  // 3마리 고르기는 VS 전 (고른 뒤 VS — 개발팀 29b90b4 만남 순서) · 대기실은 늘
  if (!(lobby || (st.phase === 'trainer' && st.team && st.vsAt === undefined)) || !pick) return null;
  const narrow = w < NARROW_PX || cut.includes('name');
  // 상대 셋 — 그림 + 타입 동그라미 (gdd S08 ⑦ · 4.7, 기획 #24-1 — 내 팀만 그리던 것) · 좁으면 그림만
  const foes = teamFoesOf(state) ?? [];
  // 시작 막대 — 10초 12걸음 (만남 막대와 같은 걸음)
  const left = st.phase === 'trainer' ? Math.ceil(Math.max(0, 1 - (st.pickMs ?? 0) / TIMING.teamPickAutoMs) * 12) / 12 : 0;
  const n = BALANCE.team.size;
  // 설명 글은 지움 — 자판 칸 (자리 키) 과 "필살기 [1]" 이 같은 뜻을 말함 (원칙 5 · "=" 를 쓴 설명서 글, 아트 디렉터) · 판 title 로만
  const keys = `1 ~ ${Math.min(5, save.party.length)} 로 넣고 빼기 · 고른 순서대로 싸울 때 필살기 키 1 · 2 · 3`;
  return (
    <div class={`pg-team-choice pg-team-pick${lobby ? ' pg-team-pick-lobby' : ''}${narrow ? ' pg-team-pick-n' : ''}${cut.includes('tight') ? ' pg-team-pick-tight' : ''}`} title={keys} ref={box}>
      <div class="pg-team-pick-head" ref={head}>
        {/* 제목 = 고르는 화면 이름표 (스타팅 고르기 머리와 같은 부품 — 6장, decide5) */}
        {/* 이름표 = 짧은 낱말 (대시 든 문장이던 것 — 5장, 아트 디렉터 2차) */}
        {!cut.includes('tag') && <span class="pg-pick-tag">{lobby ? `관장 ${n}:${n}` : '셋 고르기'}</span>}
        {foes.length > 0 && (
          <span class="pg-team-foes" title={`상대 — ${foes.map((f) => `${speciesOf(f.species)?.name.ko ?? f.form} Lv${f.level}`).join(' · ')}`}>
            {/* 좁으면 "상대" 글을 빼고 그림만 (240 에서 "1:1 로" 가 판 밖으로 밀리던 것 — 올리면 상대 이름) */}
            {/* "상대" (좁으면 "VS") — 빠지면 상대 셋이 "내가 고른 셋" 으로 읽히던 것 (UX 리뷰어) */}
            {/* "상대" (좁으면 "VS") = 빨강 낱말 · 셋은 트레이 하나 (내 칸과 다른 틀 — 칸마다 빨강 테두리면 주 버튼보다 먼저 보이던 것, 아트 디렉터 2차) */}
            <span class="pg-team-vs">{narrow || cut.includes('label') ? 'VS' : '상대'}</span>
            {foes.map((f) => (
              <span key={f.uid} class="pg-team-foe1">
                <Sprite media={media} form={f.form} shiny={f.shiny} scale={1} crop={24} center />
                {!narrow && !cut.includes('types') && <TypeTags types={speciesOf(f.species)?.types ?? []} />}
              </span>
            ))}
          </span>
        )}
        {lobby ? (
          <Button secondary extraClass="pg-team-back" onClick={() => onInput({ kind: 'lobby-back' })} title="대기실로 돌아가기 (Esc) — 고른 셋은 기억">
            {!narrow && <KeyCap k="Esc" />} 뒤로
          </Button>
        ) : (
          <Button secondary extraClass="pg-team-back" onClick={() => onInput({ kind: 'team-mode', on: false, go: true })} title="3:3 대신 1:1 로 바로 시작 (Esc)">
            {!narrow && <KeyCap k="Esc" />} 1:1 로
          </Button>
        )}
      </div>
      <div class="pg-team-grid">
        {save.party.map((uid, i) => {
          const m = save.monsters[uid];
          if (!m) return null;
          const order = pick.indexOf(uid);
          const down = m.hp <= 0;
          const name = speciesOf(m.species)?.name.ko ?? m.form;
          return (
            <button
              key={uid}
              type="button"
              class={`pg-team-pk${order >= 0 ? ' pg-on' : ''}${down ? ' pg-down' : ''}`}
              disabled={down}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onInput({ kind: 'team-pick', uid })}
              title={`${name} Lv${m.level}${down ? ' — 쓰러짐' : order >= 0 ? ` — 필살기 ${order + 1} (${i + 1} 로 빼기)` : ` — ${i + 1} 로 넣기`}`}
            >
              {/* 자리 키 = 자판 칸 (Enter · 3 과 같은 부품 — 고르면 금 테두리 · 금 글) · 고른 순서 = 싸울 때 발밑 판 키 그대로 (금 칠) — 칸마다 금 칠은 하나 (전투와 모양이 거꾸로이던 것 · 칠 칩 여섯이 주 버튼보다 밝던 것, 아트 디렉터) */}
              <span class={`pg-menu-key pg-team-slot${order >= 0 ? ' pg-on' : ''}`}>{i + 1}</span>
              {/* 좁은 칸 = 싸울 때 키 (금 칠) 를 그림 발밑에 — 전투 발밑 판 키와 같은 자리 (자리 키 · 금 키 숫자 둘이 나란히 "1 · 1" 로 읽히던 것, U517 · ideas #142) */}
              <span class="pg-team-pk-art">
                <Sprite media={media} form={m.form} shiny={m.shiny} scale={1} crop={24} />
                {narrow && order >= 0 && <span class="pg-team-key pg-team-key-on pg-team-pk-badge">{order + 1}</span>}
              </span>
              {!narrow && <span class="pg-team-pk-name">{name}</span>}
              {narrow ? null : order >= 0 ? (
                <span class="pg-team-ord">
                  {!cut.includes('ordword') && <span class="pg-team-ord-word">필살기</span>}
                  <span class="pg-team-key pg-team-key-on">{order + 1}</span>
                </span>
              ) : (
                !cut.includes('lv') && <span class="pg-team-pk-lv">Lv {m.level}</span>
              )}
            </button>
          );
        })}
        {/* 시작 = 셋째 열 마지막 줄 (팀 다섯이면 여섯째 자리) · 대기실은 "도전" (두 번째 Enter — 저절로 시작 없음, 막대 없음) */}
        {lock !== null && (
          // 잠김 안내 = 시작 칸 자리 (넓히면 그대로 3:3 · 3마리 미만은 고를 수 없음)
          <span class="pg-team-lockmsg" title={lock === 'narrow' ? '패널을 넓히면 3:3 으로 시작할 수 있어요' : '싸울 수 있는 포켓몬이 3마리면 3:3'}>
            {lock === 'narrow' ? '넓히면 3:3' : '싸울 3마리 필요'}
          </span>
        )}
        {lock === null && (
        <Button
          extraClass="pg-team-start"
          onClick={() => onInput(lobby ? { kind: 'challenge' } : { kind: 'space' })}
          title={lobby ? `고른 셋으로 관장에게 도전 (Enter) ${pick.length}/${n}` : `고른 셋으로 시작 (Enter — 모자라면 상성 좋은 순으로 채움 · 10초 뒤 저절로) ${pick.length}/${n}`}
        >
          {/* 좁으면 64px 칸에 Enter 칸까지는 안 들어가서 글만 (Enter 는 title) */}
          {!narrow && <KeyCap k="Enter" />}
          {`${lobby ? '도전' : '시작'} ${pick.length}/${n}`}
          {!lobby && <span class="pg-team-left" style={{ width: `${Math.round(left * 100)}%` }} />}
        </Button>
        )}
      </div>
    </div>
  );
}
