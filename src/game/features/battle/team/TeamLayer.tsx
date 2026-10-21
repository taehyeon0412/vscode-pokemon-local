/**
 * S09 3:3 실시간 팀 배틀 화면 (orders #17 3단계 — 디자인팀 4안: 띠 · 카드 없이 포켓몬 발밑 판이 전부).
 * 기능 뼈대 — 자리 · 판 상태 · 안내는 model.ts (시안 geo 그대로), 모양은 디자인팀 (클래스 pg-team-*). 연출은 일반 모드 그대로 (fx/team.ts TeamFxRunner).
 * 누르기: 발밑 판 · 포켓몬 = 그 칸 필살기 (쓰기 · 예약 · 끼어들기 · 합류) — 키 1 · 2 · 3 · Z · Space 는 main.ts.
 */
import { useEffect, useMemo, useRef } from 'preact/hooks';
import { TIMING } from '../../../core/balance';
import type { GameInput, Side, TeamBattle } from '../../../core/engine';
import { formOf, speciesOf } from '../../../data';
import { Sprite } from '../../../ui/Sprite';
import type { FxActor } from '../fx/bridge';
import { TeamFxRunner, type TeamSlot } from '../fx/team';
import { foeWarn, plateState, teamGeometry, teamPrompt, type TeamGeo } from './model';
import './team.css';

const SIDES: Side[] = ['me', 'foe'];

function Bar({ v, kind }: { v: number; kind: 'hp' | 'ult' | 'ult-full' }) {
  const pct = Math.max(0, Math.min(1, v));
  const tone = kind === 'hp' ? (pct > 0.5 ? 'pg-team-hp-ok' : pct > 0.2 ? 'pg-team-hp-mid' : 'pg-team-hp-low') : kind === 'ult-full' ? 'pg-team-ult-full' : '';
  return (
    <span class={`pg-team-bar pg-team-bar-${kind === 'hp' ? 'hp' : 'ult'}`}>
      <span class={`pg-team-fill ${tone}`} style={{ width: `${Math.round(pct * 100)}%` }} />
    </span>
  );
}

function Fighter({ b, g, side, slot, media, topMin, onUlt }: { b: TeamBattle; g: TeamGeo; side: Side; slot: number; media: string; topMin: number; onUlt(slot: number): void }) {
  const f = b[side][slot]!;
  const { x, y } = g.pos(side, slot);
  const st = plateState(b, side, slot);
  const mine = side === 'me';
  const w = mine ? g.pw : g.pw - 16;
  const warn = side === 'foe' ? foeWarn(b, slot) : null;
  const pops = b.popups.filter((p) => p.side === side && p.slot === slot);
  const name = speciesOf(f.species)?.name.ko ?? f.form;
  // 필살기 힘겨루기 중엔 끼어들 수 있는 칸 (join) 만 합류 — 나머지는 바깥 (연타) 으로 (누를 때마다 예약이 켜졌다 꺼지던 것 — 코드 리뷰어)
  const click =
    mine && st !== 'down' && (b.phase !== 'clash' || st === 'join')
      ? (e: MouseEvent) => {
          if (b.phase === 'clash') e.stopPropagation();
          onUlt(slot);
        }
      : undefined;
  return (
    <>
      {/* 포켓몬 — 발 가운데 (x, y) · 칸 = 32 × 배율 (그림 발끝이 칸 아래 3점 위) */}
      <span
        class={`pg-team-mon pg-team-${side}${st === 'down' ? ' pg-team-down' : ''}`}
        data-team={`${side}-${slot}`}
        style={{ left: `${x - g.sp / 2}px`, top: `${y - g.sp + 3 * g.scale}px`, width: `${g.sp}px`, height: `${g.sp}px` }}
        title={`${name} Lv${f.level}${mine && st !== 'down' ? ` — ${slot + 1} 필살기` : ''}`}
        onClick={click}
      >
        <span class="pg-team-body">
          <Sprite media={media} form={f.form} shiny={f.shiny} scale={g.scale} action="walk" faceLeft={!mine} />
        </span>
      </span>
      {/* 발밑 판 — 키 칸 (내 편) + HP + 필살기 게이지 */}
      <span class={`pg-team-plate pg-team-plate-${side} pg-plate-${st}`} style={{ left: `${Math.round(x - w / 2)}px`, top: `${y + 4}px`, width: `${w}px` }} onClick={click}>
        {mine && <span class="pg-team-key">{slot + 1}</span>}
        <span class="pg-team-bars">
          <Bar v={f.hp / Math.max(1, f.maxHp)} kind="hp" />
          {st !== 'down' && <Bar v={f.ult} kind={st === 'charge' ? 'ult' : 'ult-full'} />}
        </span>
      </span>
      {/* 상대 필살기 예고 — 머리 위 */}
      {warn && (
        <span class={`pg-team-warn${warn.full ? ' pg-team-warn-full' : ''}`} style={{ left: `${x}px`, top: `${Math.max(topMin, y - g.sp)}px` }}>
          {warn.full ? '곧!' : `${warn.pct}%`}
        </span>
      )}
      {/* 피해 숫자 · 짧은 말 — 머리 위 */}
      {/* 칸마다 쌓음 (쓰러짐 말 · 피해 숫자가 같은 자리에 겹치던 것) · 지도 줄 아래로 막음 · 한 줄 배치 · ×1 (좁은 패널 — 셋이 가까움) 은 칸마다 높이를 엇갈림 — UX 리뷰어 */}
      {pops.map((p, i) => (
        <span key={p.id} class={`pg-team-pop pg-pop-${p.kind}`} style={{ left: `${x}px`, top: `${Math.max(topMin + 15 * (pops.length - 1 - i) + (slot % 3) * 15, y - g.sp - 4 - 15 * i - (g.oneRow || g.scale === 1 ? (slot % 3) * 15 : 0))}px` }}>
          {p.text}
        </span>
      ))}
    </>
  );
}

export function TeamLayer({ team: b, media, widthPx, heightPx, infoBarPx, fieldTopPx = 0, onInput }: { team: TeamBattle; media: string; widthPx: number; heightPx: number; infoBarPx: number; fieldTopPx?: number; onInput(i: GameInput): void }) {
  const g = useMemo(() => teamGeometry(widthPx, heightPx, infoBarPx), [widthPx, heightPx, infoBarPx]);
  const root = useRef<HTMLDivElement>(null);
  const layer = useRef<HTMLDivElement>(null);
  const runner = useRef<TeamFxRunner | null>(null);
  const bRef = useRef<TeamBattle | null>(b);
  bRef.current = b;
  // 연출 다리 — 그 칸 그림 (FxActor) 은 이 화면 안에서 찾음
  if (!runner.current) {
    runner.current = new TeamFxRunner({
      actor: (w: TeamSlot): FxActor | null => {
        const box = root.current?.querySelector<HTMLElement>(`[data-team="${w.side}-${w.slot}"]`);
        const el = box?.querySelector<HTMLElement>('.pg-sprite') ?? null;
        const f = bRef.current?.[w.side][w.slot];
        if (!box || !el || !f || box.getBoundingClientRect().width < 1) return null;
        return { el, box, form: f.form, size: formOf(f.form)?.size ?? 32, left: w.side === 'foe', name: speciesOf(f.species)?.name.ko ?? '' };
      },
      layer: () => layer.current,
    });
  }
  useEffect(() => {
    runner.current?.update(b);
  }, [b]);
  useEffect(() => () => runner.current?.reset(), []);
  const prompt = teamPrompt(b);
  // 숫자 · 말 · 예고의 아래 끝 (translate −100%) 이 지도 줄 아래 + 2 보다 위로 가지 않게 (글 높이 약 14)
  const topMin = infoBarPx + fieldTopPx + 2 + 14;
  // 안내 (끼어들기 · 합동 · 연타) 자리 — 넓으면 무대 아래 가운데 (위 가운데는 필살기 컷인 이름 자리), 좁으면 정보줄 + 4 (정보줄 밑에 숨던 것 — UX 리뷰어)
  const low = widthPx >= 400;
  const promptStyle = low ? { top: 'auto', bottom: '4px' } : { top: `${infoBarPx + 4}px` };
  // 엔진 한 줄 (필살기 · 합류 · 결과) 은 판 끝 결과만 · 쓰러지는 장면이 0.9초 보인 뒤 (컷인 이름을 가리고 · 지난 필살기 줄이 남던 것 — UX 리뷰어)
  const msgOn = b.phase === 'over' && b.overMs >= 900 && !!b.msg;
  const ult = (slot: number) => onInput({ kind: 'team-battle', input: { kind: 'ult', slot } });
  return (
    // 자리는 패널 기준 (시안 geo) — 이 층은 들판 (정보줄 아래) 안이라 정보줄 높이만큼 위로
    <div class={`pg-team pg-team-x${g.scale}${g.oneRow ? ' pg-team-row' : ''}`} style={{ top: `${-infoBarPx}px` }} ref={root} onClick={b.phase === 'clash' ? () => onInput({ kind: 'team-battle', input: { kind: 'space' } }) : undefined}>
      {SIDES.map((side) => b[side].map((_, slot) => <Fighter key={`${side}-${slot}`} b={b} g={g} side={side} slot={slot} media={media} topMin={topMin} onUlt={ult} />))}
      {/* 연출 층 — 비어 있는 상자 (Preact 는 안을 안 건드림), 연출 다리가 캔버스를 넣음 */}
      <div class="pg-fxlayer pg-team-fx" ref={layer} />
      {/* 안내 — 무대 가운데 위 */}
      {prompt?.kind === 'join' && (
        <div class="pg-team-prompt pg-team-prompt-join" style={promptStyle}>
          {prompt.keys.map((k) => (
            <span key={k} class="pg-team-key pg-team-key-on">
              {k}
            </span>
          ))}
          끼어들기
          <span class="pg-team-left" style={{ width: `${Math.round(prompt.left * 100)}%` }} />
        </div>
      )}
      {prompt?.kind === 'gather' && (
        <div class="pg-team-prompt pg-team-prompt-gather" style={promptStyle}>
          <b>{widthPx < 400 ? '합동!' : '합동 필살기!'}</b>
          {prompt.who.map((w) => (
            <span key={w.key} class="pg-team-who" onClick={() => ult(w.key - 1)}>
              <span class="pg-team-key pg-team-key-on">{w.key}</span>
              {w.name}
            </span>
          ))}
          <span class="pg-team-left" style={{ width: `${Math.round(prompt.left * 100)}%` }} />
        </div>
      )}
      {/* 연타 — VS · 맞닿기 (ultClashLeadMs) 뒤부터 (엔진도 그때부터 셈) */}
      {prompt?.kind === 'mash' && (b.clash?.ms ?? 0) >= TIMING.team.ultClashLeadMs && (
        <div class="pg-team-prompt pg-team-prompt-mash" style={promptStyle}>
          {prompt.sure === 'me' ? <b class="pg-team-sure">3:1</b> : prompt.sure === 'foe' ? <b class="pg-team-sure pg-team-sure-foe">1:3 — 질 거예요</b> : <b>{`${prompt.me} 대 ${prompt.foe}`}</b>}
          <span class="pg-team-key">Space</span> 연타
        </div>
      )}
      {/* 결과 · 엔진 한 줄 (합류 · 힘겨루기 결과 · 이김 · 짐) — 안내가 없을 때 */}
      {msgOn && (
        <div class="pg-team-msg pg-team-msg-over" style={{ top: `${infoBarPx + fieldTopPx + 4}px` }}>
          {b.msg}
        </div>
      )}
    </div>
  );
}
