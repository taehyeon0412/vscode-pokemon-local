/**
 * 개발 메뉴 (개발 모드 (임시), gdd 8장) — D 키 · 정보줄 "개발". ① 장면 바로 가기 ② 팀 만들기 (상대 팀도) ③ 상태 바꾸기 ④ 속도 ⑤ 3:3 미리 켜기.
 * 기능 뼈대 — 모양은 디자인팀 (클래스 pg-dev-*). 누르면 바로 게임 상태가 바뀜 (devApply), 장면을 고르면 판이 닫힘.
 */
import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import { BALANCE } from '../core/balance';
import type { GameState } from '../core/engine';
import { allSpecies, formsOfSpecies, speciesOf } from '../data';
import { pokemonFx } from '../features/battle/fx/bridge';
import { Panel, Row } from '../features/menu/components/Panel';
import { Button } from '../ui/Button';
import { Sprite } from '../ui/Sprite';
import type { DevAction, DevScene } from './actions';
import { DEV_FOES_MAX, devDefault } from './runtime';

const SCENES: { scene: DevScene; label: string }[] = [
  { scene: 'trainer-team', label: '3:3 트레이너전' },
  { scene: 'gym-team', label: '관장 3:3' },
  { scene: 'wild', label: '1:1 야생' },
  { scene: 'catch', label: '잡기' },
  { scene: 'evolve', label: '진화' },
  { scene: 'rival', label: '라이벌' },
  { scene: 'gym-enter', label: '체육관 들어가기' },
  { scene: 'lobby', label: '대기실' },
  { scene: 'stage-1', label: '1-1 시작' },
  { scene: 'stage-2', label: '1-2 시작' },
  { scene: 'stage-3', label: '1-3 시작' },
  // 해변 미리 보기 (orders #37 — 2번째 지역, 배경은 임시)
  { scene: 'beach-1', label: '해변 2-1' },
  { scene: 'beach-2', label: '해변 2-2' },
  { scene: 'beach-3', label: '해변 2-3' },
  { scene: 'beach-gym', label: '해변 체육관' },
];

let speciesList: { dex: number; name: string }[] | null = null;
/** 그림이 있는 포켓몬 전부 (도감 번호 순) · 이름 먼저 (칸 번호 옆에 숫자가 둘 붙던 것 — 아트 디렉터) · 번호는 No. (Lv · 개수로 읽히던 것 — UX 리뷰어) */
function speciesOptions(): { dex: number; name: string }[] {
  speciesList ??= allSpecies()
    .filter((dex) => formsOfSpecies(dex).length > 0)
    .sort((a, b) => a - b)
    .map((dex) => ({ dex, name: `${speciesOf(dex)?.name.ko ?? ''} No.${dex}` }));
  return speciesList;
}

function SpeciesSelect({ value, onPick }: { value: number | null; onPick(dex: number): void }) {
  return (
    <select class="pg-dev-select" value={value ?? ''} onChange={(e) => onPick(Number(e.currentTarget.value))}>
      {value === null && <option value="">— 포켓몬 —</option>}
      {speciesOptions().map((s) => (
        <option key={s.dex} value={s.dex}>
          {s.name}
        </option>
      ))}
    </select>
  );
}

function LevelInput({ value, onLevel }: { value: number; onLevel(level: number): void }) {
  return (
    <input
      class="pg-dev-level"
      type="number"
      min={1}
      max={100}
      value={value}
      title="레벨 (1 ~ 100) — Enter · 다른 곳을 누르면 바뀜"
      onChange={(e) => {
        const v = Number(e.currentTarget.value);
        if (Number.isFinite(v) && v >= 1) onLevel(v);
      }}
      onKeyDown={(e) => e.stopPropagation()}
    />
  );
}

type DevTab = 'scene' | 'team' | 'state' | 'speed';
const TABS: { tab: DevTab; label: string; title: string }[] = [
  { tab: 'scene', label: '장면', title: '장면 바로 가기' },
  { tab: 'team', label: '팀', title: '내 팀 · 상대 팀 만들기' },
  // "상태" 는 포켓몬에서 상태 이상으로 읽혀서 (UX 리뷰어) — 값을 바꾸는 탭
  { tab: 'state', label: '바꾸기', title: '게이지 · HP · 돈 · 볼 · 진화 직전' },
  { tab: 'speed', label: '속도', title: '걷기 · 전투 배속 · 멈춤' },
];
/** 마지막에 본 탭 — 판을 닫았다 열어도 그대로 (개발 모드 동안만) */
let lastTab: DevTab = 'scene';

/**
 * 모양 (디자인팀 2026-10-21 · 아트 디렉터 1차): 판 머리 줄 = D 키 칸 + 글자 탭 넷 (고른 탭 = 칠한 막대 + 아래 금색 2px — 이름표와 같은 모양이라 고른 것이 둘로 보이던 것) ·
 * 판 맨 아래 고정 줄 = 왼쪽 금색 한 줄 알림 · 오른쪽 끝 [끝내기] (위험한 것이 첫 자리에 있던 것 · "저장 안 됨" 은 꼬리표 하나가 말함) ·
 * 몸통은 고른 탭 하나만 (한 판에 버튼 서른 개가 줄줄이 · 187 에서 세 줄만 보이던 것). 장면 · 상태는 묶음 이름 (전투 · 장소 / 전투 · 가방) 으로 나눔
 */
export function DevPanel({ state, media, onDev, onEnd, onClose }: { state: GameState; media: string; onDev(a: DevAction): void; onEnd(): void; onClose(): void }) {
  const dev = state.runtime.dev ?? devDefault();
  const save = state.save;
  const fx = pokemonFx();
  const [addDex, setAddDex] = useState<number | null>(null);
  const [addLevel, setAddLevel] = useState(20);
  const [tab, setTab] = useState<DevTab>(lastTab);
  // 판 몸통이 아래로 더 있는지 — 반만 보이는 줄이 고장 난 배치처럼 보이던 것 (아트 디렉터 · 픽셀 검사원) → 아래 줄 왼쪽 "▼ 아래에 더"
  const probe = useRef<HTMLSpanElement>(null);
  const [more, setMore] = useState(false);
  useLayoutEffect(() => {
    const body = probe.current?.closest<HTMLElement>('.pg-panel-body');
    if (!body) return;
    // 몸통 높이를 끝까지 보이는 마지막 칸 (버튼 · 고르기 칸) 아래 끝 + 2px 로 잘라 반 줄이 안 보이게 (아트 디렉터 2차 — 남는 px 만큼 판이 짧아짐, 뜻은 ▼ 가 맡음) ·
    //   풀었다 줄이는 사이 브라우저가 스크롤 자리를 깎아서 끝까지 내리면 위로 되튀던 것 → 자리를 기억했다 되돌림 (UX 리뷰어 3차)
    const keep = body.scrollTop;
    body.style.maxHeight = '';
    const room = body.clientHeight;
    const top0 = body.getBoundingClientRect().top - body.scrollTop;
    let cut = 0;
    let over = false;
    body.querySelectorAll<HTMLElement>('.pg-button, select, input').forEach((el) => {
      const r = el.getBoundingClientRect();
      const b = Math.ceil(r.bottom - top0);
      if (b <= room && b > cut) cut = b;
      if (b > room) over = true;
    });
    // 다 들어가면 자르지 않음 (다 보이는데 3px 가짜 스크롤 막대가 뜨던 것 — UX 리뷰어 4차)
    if (over && cut > 0 && cut + 2 < room) body.style.maxHeight = `${cut + 2}px`;
    body.scrollTop = keep;
    // 알림이 새로 뜨면 (= 버튼을 눌렀으면) 누른 칸이 보이게 — 알림 줄이 늘며 몸통이 줄어 누른 칸이 아래로 숨던 것 (UX 리뷰어 3차 · 알림이 바뀔 때만 — 휠로 내리는 걸 막지 않게)
    const act = document.activeElement;
    if (sayShown.current !== say) {
      sayShown.current = say;
      if (say && act instanceof HTMLElement && body.contains(act)) act.scrollIntoView({ block: 'nearest' });
    }
    // 더 있음 = 보이는 칸 아래 끝 너머에 칸이 남았는지 (여백 때문에 늘 "더" 로 나오던 것)
    const check = () => {
      const t0 = body.getBoundingClientRect().top - body.scrollTop;
      const shown = body.scrollTop + body.clientHeight;
      let hidden = false;
      body.querySelectorAll<HTMLElement>('.pg-button, select, input').forEach((el) => {
        if (el.getBoundingClientRect().bottom - t0 > shown + 1) hidden = true;
      });
      // 끝까지 내렸으면 끔
      setMore(hidden && body.scrollTop + body.clientHeight < body.scrollHeight - 1);
    };
    check();
    body.addEventListener('scroll', check);
    window.addEventListener('resize', check);
    return () => {
      body.removeEventListener('scroll', check);
      window.removeEventListener('resize', check);
    };
  });
  const open = (t: DevTab) => {
    lastTab = t;
    setTab(t);
    // 탭을 바꾸면 맨 위부터 (지난 탭에서 내린 자리가 남아 전투 줄이 위에 숨던 것 — UX 리뷰어 3차)
    const body = probe.current?.closest<HTMLElement>('.pg-panel-body');
    if (body) body.scrollTop = 0;
  };
  const say0 = state.runtime.toast?.text.startsWith('개발 — ') ? state.runtime.toast.text.slice(5) : '';
  // 알림은 뜬 탭에서만 — 판이 열린 동안은 게임이 멈춰 알림이 안 사라져, 탭을 바꿔도 지난 알림이 남던 것 (UX 리뷰어 2차)
  const sayAt = useRef<{ text: string; tab: DevTab; toast: unknown; n: number }>({ text: '', tab: 'scene', toast: null, n: 1 });
  const toast = state.runtime.toast ?? null;
  if (say0 !== sayAt.current.text) sayAt.current = { text: say0, tab, toast, n: 1 };
  else if (say0 && toast !== sayAt.current.toast) sayAt.current = { ...sayAt.current, toast, n: sayAt.current.n + 1 };
  // 같은 버튼을 또 누르면 ×2 · ×3 (두 번째로 눌렸는지 알 수 없던 것 — UX 리뷰어 3차) · "Lv 20" 은 줄이 안 갈라지게
  const say = say0 && sayAt.current.tab === tab ? `${say0}${sayAt.current.n > 1 ? ` ×${sayAt.current.n}` : ''}`.replace(/Lv (\d)/g, 'Lv\u00a0$1') : '';
  const sayShown = useRef('');
  // 3:3 이 모두에게 켜져 있으면 (BALANCE.team.on — orders #59) 끌 수 없어 숨김 (꺼짐이라 써도 3:3 이 그대로이던 것 — 코드 리뷰어)
  const teamSwitch = (cls: string) => BALANCE.team.on ? null : (
    <Button secondary extraClass={`pg-dev-switch ${cls}${dev.team ? ' pg-on' : ''}`} onClick={() => onDev({ kind: 'team', on: !dev.team })} title="3:3 미리 켜기 — 개발 모드에서만 (트레이너 만남에서 1:1 / 3:3 고르기 · 관장 3:3)">
      {dev.team ? '3:3 켜짐' : '3:3 꺼짐'}
    </Button>
  );
  const phase = state.runtime.stage?.phase;
  const inBattle = phase === 'battle' || phase === 'team';
  const btn = (label: string, a: DevAction, title?: string, disabled = false) => (
    <Button key={label} secondary extraClass="pg-dev-btn" onClick={() => onDev(a)} title={title} disabled={disabled}>
      {label}
    </Button>
  );
  return (
    <Panel
      title="개발 모드"
      extra={
        <>
          <span class="pg-dev-tabs" role="tablist">
            {TABS.map((t) => (
              <Button key={t.tab} secondary extraClass={tab === t.tab ? 'pg-picked' : undefined} onClick={() => open(t.tab)} title={t.title}>
                {t.label}
              </Button>
            ))}
          </span>
          {/* 3:3 미리 켜기 = 스위치 (자동 전투 스위치와 같은 모양) — 머리 줄 D 칸 앞 (장면 탭 전투 줄에 넣으면 480 × 187 에서 줄이 늘어 반 줄이 보이던 것, 아트 디렉터 2차) */}
          {teamSwitch('pg-dev-team-head')}
          {/* 톱니 (설정 판으로 읽힘) 대신 D 키 칸 — 닫기 바로 옆 (탭 앞에 두면 "D = 장면" 으로 읽히던 것, UX 리뷰어) */}
          <span class="pg-dev-dkey" title="D = 개발 메뉴 열기 · 닫기">
            <span class="pg-menu-key">D</span>
          </span>
        </>
      }
      foot={
        <span class="pg-dev-foot">
          {say && <span class="pg-dev-say">{say}</span>}
          {more && <span class="pg-dev-more">▼ 아래에 더</span>}
          {/* 판이 열린 동안은 구석 꼬리표를 숨기고 (판 몸통이 반 줄 모자라던 것) "저장 안 됨" 을 여기 — UX 리뷰어 */}
          <span class="pg-dev-nosave">저장 안 됨</span>
          <Button secondary extraClass="pg-dev-btn pg-danger pg-dev-end" onClick={onEnd} title="개발 모드 끝내기 — 타이틀로 (개발 모드에서 한 것은 저장되지 않아요)">
            개발 끝내기
          </Button>
        </span>
      }
      onClose={onClose}
    >
      <span ref={probe} class="pg-dev-probe" />
      {tab === 'scene' && (
        <>
          <Row wrap label="전투">
            {SCENES.slice(0, 6).map((sc) => btn(sc.label, { kind: 'scene', scene: sc.scene }))}
            {/* 400px 아래는 3:3 스위치가 머리 줄에 안 들어가 전투 줄 끝 (첫 칸이면 혼자 한 줄을 써서 240 에서 장면이 둘만 보이던 것) */}
            {teamSwitch('pg-dev-team-body')}
          </Row>
          {/* 지역마다 한 줄 (해변 넷이 장소 줄 끝에 붙어 "아래에 더" 로 숨던 것 — #37) */}
          <Row wrap label="숲">
            {SCENES.slice(6, 11).map((sc) => btn(sc.label, { kind: 'scene', scene: sc.scene }))}
          </Row>
          <Row wrap label="해변">
            {SCENES.slice(11).map((sc) => btn(sc.label, { kind: 'scene', scene: sc.scene }))}
          </Row>
        </>
      )}
      {tab === 'team' && (
        <>
          {/* 내 팀 — 번호 · 그림 · 포켓몬 · 레벨 · 필살기 · HP · 빼기 */}
          <div class="pg-dev-team">
            <span class="pg-panel-label">내 팀</span>
            {save.party.map((uid, i) => {
              const m = save.monsters[uid];
              if (!m) return null;
              const ults = fx?.ults?.(m.form) ?? [];
              return (
                // key = 칸 번호 — 포켓몬을 바꾸면 새 uid 로 줄이 다시 만들어져 고르기 칸 포커스가 사라지던 것 (키보드 ↓ 가 한 번만 먹던 것, UX 리뷰어 4차)
                <div key={i} class="pg-dev-row">
                  <span class="pg-dev-lead">
                    <span class="pg-dev-slot">{i + 1}</span>
                    <Sprite media={media} form={m.form} shiny={m.shiny} scale={1} crop={24} center />
                  </span>
                  <SpeciesSelect value={m.species} onPick={(dex) => onDev({ kind: 'mon', slot: i, dex, level: m.level })} />
                  <span class="pg-dev-pair">
                    <span class="pg-dev-lv">Lv</span>
                    <LevelInput value={m.level} onLevel={(level) => onDev({ kind: 'level', uid, level })} />
                  </span>
                  {ults.length > 0 && (
                    <span class="pg-dev-pair">
                      <span class="pg-dev-lv">필살기</span>
                      <select class="pg-dev-select" value={dev.ults[uid] ?? ''} title="필살기 — 고르면 늘 이것 (빈 칸 = 돌아가며)" onChange={(e) => onDev({ kind: 'ult', uid, name: e.currentTarget.value || null })}>
                        <option value="">돌아가며</option>
                        {ults.map((n) => (
                          <option key={n} value={n}>
                            {n}
                          </option>
                        ))}
                      </select>
                    </span>
                  )}
                  <span class="pg-dev-hp">HP {m.hp}</span>
                  {save.party.length > 1 && btn('빼기', { kind: 'mon-remove', slot: i })}
                </div>
              );
            })}
            {save.party.length < BALANCE.partySize && (
              <div class="pg-dev-row">
                <span class="pg-dev-lead">
                  <span class="pg-dev-slot">+</span>
                </span>
                <SpeciesSelect value={addDex} onPick={setAddDex} />
                <span class="pg-dev-pair">
                  <span class="pg-dev-lv">Lv</span>
                  <LevelInput value={addLevel} onLevel={setAddLevel} />
                </span>
                <Button secondary extraClass="pg-dev-btn" disabled={addDex === null} onClick={() => addDex !== null && onDev({ kind: 'mon', slot: save.party.length, dex: addDex, level: addLevel })}>
                  더하기
                </Button>
              </div>
            )}
          </div>
          {/* 상대 팀 — 야생 = 첫 마리 · 3:3 = 셋 (비우면 장면 원래 상대) */}
          <div class="pg-dev-team">
            <span class="pg-panel-label">
              상대 팀 <span class="pg-dim">· 비우면 장면 그대로</span>
            </span>
            {Array.from({ length: Math.min(DEV_FOES_MAX, dev.foes.length + 1) }, (_, i) => {
              const f = dev.foes[i];
              return (
                <div key={i} class="pg-dev-row">
                  <span class="pg-dev-lead">
                    <span class="pg-dev-slot">{i + 1}</span>
                  </span>
                  <SpeciesSelect value={f?.dex ?? null} onPick={(dex) => onDev({ kind: 'foe', slot: i, dex, level: f?.level ?? 20 })} />
                  {f && (
                    <span class="pg-dev-pair">
                      <span class="pg-dev-lv">Lv</span>
                      <LevelInput value={f.level} onLevel={(level) => onDev({ kind: 'foe', slot: i, dex: f.dex, level })} />
                    </span>
                  )}
                  {f && btn('빼기', { kind: 'foe-remove', slot: i })}
                </div>
              );
            })}
          </div>
        </>
      )}
      {tab === 'state' && (
        <>
          {/* 전투 전용은 전투가 아닐 때 흐리게 (눌러야 "전투 중에만 돼요" 가 나오던 것 — UX 리뷰어) */}
          <Row wrap label="전투">
            {btn('필살기 게이지 가득', { kind: 'gauge-full' }, inBattle ? undefined : '전투 중에만 돼요', !inBattle)}
            {/* 상대 예고 "!" · 맞받아치기 시험 (기획 R11) */}
            {btn('상대 필살기 가득', { kind: 'gauge-full', side: 'foe' }, inBattle ? undefined : '전투 중에만 돼요', !inBattle)}
            {btn('모두 회복', { kind: 'heal' })}
            {/* 전투 밖에서도 됨 — 선두 포켓몬 HP 1 */}
            {btn(inBattle ? '내 HP 1' : '선두 HP 1', { kind: 'hp1', side: 'me' })}
            {btn('상대 HP 1', { kind: 'hp1', side: 'foe' }, inBattle ? undefined : '전투 중에만 돼요', !inBattle)}
            {btn('진화 직전 (선두)', { kind: 'pre-evolve' })}
          </Row>
          <Row wrap label="가방">
            {btn('돈 +10000', { kind: 'money' })}
            {btn('볼 +10', { kind: 'balls' })}
            {btn('아이템 +5', { kind: 'items' })}
          </Row>
        </>
      )}
      {tab === 'speed' && (
        <>
          <Row wrap label="속도">
            <Button secondary extraClass={dev.walk > 1 ? 'pg-dev-switch pg-on' : 'pg-dev-switch'} onClick={() => onDev({ kind: 'walk' })} title="걷기 배 — 누를 때마다 ×1 → ×4 → ×10">
              걷기 ×{dev.walk}
            </Button>
            <Button secondary extraClass={dev.battle < 1 ? 'pg-dev-switch pg-on' : 'pg-dev-switch'} onClick={() => onDev({ kind: 'battle-speed' })} title="전투 시간 배 — 누를 때마다 ×1 → ×0.5 → ×0.25 (연출 · 움직임까지 같이)">
              전투 ×{dev.battle}
            </Button>
            {/* ⏸ 는 글꼴에 없어 다른 글꼴로 떨어짐 (맥은 컬러 이모지) — 글만 · 켜짐은 금색 테두리 (pg-picked) 가 말함 */}
            <Button secondary extraClass={dev.pause ? 'pg-dev-switch pg-on' : 'pg-dev-switch'} onClick={() => onDev({ kind: 'pause' })} title="멈춤 — 게임 · 연출 · 움직임 모두">
              {dev.pause ? '다시 감' : '멈춤'}
            </Button>
          </Row>
        </>
      )}
    </Panel>
  );
}
