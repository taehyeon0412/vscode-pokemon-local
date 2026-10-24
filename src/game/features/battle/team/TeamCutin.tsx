/** 합동 이름 판 (#100 시안) — show 동안 위쪽 (띠 자리) 1.5초: 참가자 얼굴 + 큰 합동 이름 · 바탕 = 반반 색 (합동은 1:1 캔버스 이름 띠가 없어서) */
export function JointNamePlate({ who, side, name, media, top, colors, quick = false }: { who: { form: string }[]; side: Side; name: string; media: string; top: number; colors: string[]; /** 같은 판 다시 나온 합동 (짧게 — 1.0초) */ quick?: boolean }) {
  const foe = side === 'foe';
  // 구를 비켜 섬 (#103 — 판이 리자드 구 오른쪽 반을 덮던 것, 아트 디렉터): 연출 (ult 다리 team11Joint) 이 구가 생길 자리 (최대 — 1.08 부풂 포함) 를
  //   window.__pgJointOrbPlan 에 미리 적음 · 판이 뜰 때 한 번만 견줘 자리를 정하고 끝까지 둠 (매 장면 따라가면 구가 생기는 순간 245px 뛰어 눈을 뺏던 것 — 아트 #103 ③) ·
  //   겹치면 판 오른쪽 끝 ≤ 구 왼쪽 − 8px · 왼쪽에 자리가 없으면 구 오른쪽 + 8px · 판 아래 끝은 window.__pgJointPlate 로 알림 (240 — 구가 판 아래로)
  const plate = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const w = window as unknown as { __pgJointOrbPlan?: { x: number; y: number; R: number; at: number } | null; __pgJointPlate?: { bottom: number; until: number } | null };
    const until = performance.now() + (quick ? 1000 : 1500);
    const raf = requestAnimationFrame(() => {
      const el = plate.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      w.__pgJointPlate = { bottom: r.bottom, until };
      const o = w.__pgJointOrbPlan;
      if (o && performance.now() - o.at < 1000 && r.bottom > o.y - o.R - 8 && r.top < o.y + o.R + 8 && r.right > o.x - o.R - 8 && r.left < o.x + o.R + 8) {
        const toLeft = o.x - o.R - 8 - r.right;
        const shift = Math.round(r.left + toLeft >= 8 ? toLeft : o.x + o.R + 8 - r.left);
        el.style.transform = `translateX(${shift}px)`;
      }
    });
    return () => {
      cancelAnimationFrame(raf);
      w.__pgJointPlate = null;
    };
  }, [quick]);
  // 넘치면 한 단계 (U4 — 재서 · 맥 여유 10% · 이름은 자르지 않음 · 디자인 #148 잼): 1 = 얼굴은 앞장 하나 · 2 = 얼굴 없음 · 3 = 이름 16px · 4 = 두 줄 (마지막 띄어쓰기에서)
  //   — 240 에서 "삼중 빙염 소용돌이" 가 "…소용돌" 까지 잘리던 것 (개발 #96)
  const fitKey = `${name}|${who.length}`;
  const [fit, setFit] = useState({ key: '', step: 0 });
  const step = fit.key === fitKey ? fit.step : 0;
  useLayoutEffect(() => {
    const el = plate.current;
    if (!el || step >= 4) return;
    const room = (el.offsetParent instanceof HTMLElement ? el.offsetParent.clientWidth : window.innerWidth) - 16;
    if (el.scrollWidth * FIT_ROOM > room + 0.02) setFit({ key: fitKey, step: step + 1 });
  });
  const two = step >= 4 ? splitName(name) : null;
  const cls = ['pg-team-jname', foe ? 'pg-jname-foe' : '', quick ? 'pg-jname-quick' : '', step >= 1 ? 'pg-jname-fit1' : '', step >= 2 ? 'pg-jname-fit2' : '', step >= 3 ? 'pg-jname-fit3' : '', two ? 'pg-jname-fit4' : ''].filter(Boolean).join(' ');
  return (
    // 얼굴 칸마다 그 타입 색 · 글자 칸은 남색 (사선 반반이면 이음선이 글자 사이를 지나 "삼색/대폭발" 로 읽히고 얼굴이 남의 색 칸에 앉던 것 — 아트 디렉터 #100)
    <div ref={plate} class={cls} style={{ top: `${top}px` }}>
      {who.map((w, i) => (
        <span key={i} class="pg-jname-cell" style={{ background: deep(colors[i] ?? '#2a3a6a') }}>
          <span class="pg-band-face">
            <Sprite media={media} form={w.form} scale={1} px={32} crop={20} cropWidth={24} center action="walk" faceLeft={foe} />
          </span>
        </span>
      ))}
      <b class="pg-jname-text">
        {two ? (
          <>
            {two[0]}
            <br />
            {two[1]}
          </>
        ) : (
          name
        )}
      </b>
    </div>
  );
}

/**
 * 3:3 합동 큰 컷인 (orders #99 시안 — 마스터즈 유니티 어택 문법을 우리 남색 + 금 판 언어로): 패널 폭 띠 · 위아래 2px 금 (상대 = 빨강) · 속도선 ·
 * 참가자 그림 (정수 배율 — 1:1 컷인처럼 무대보다 크게) + 이름 · 금 제목 "합동 필살기!" + 필살기 이름. 장면 전환 cut 단계 (TEAM_VIEW.cutMs) 동안만.
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import type { Side } from '../../../core/engine';
import { Sprite } from '../../../ui/Sprite';
import { FIT_ROOM } from '../../../ui/useFit';
import { splitName } from './joint-names';

/** 타입 색을 남색 쪽으로 반 (남색 판 언어 안에서 그 필살기 색) */
const deep = (c: string) => `color-mix(in srgb, ${c} 50%, #0c101e)`;

/**
 * 합동 띠 바탕 = 참가자 타입 색을 사선으로 나눔 (앞장 | 동료 · 셋이면 세 칸 · 이음선 2px 금 — #100 "반반 색": 합동이 색으로 보이게) · 상대는 오른쪽부터.
 * 하나면 그 색 하나
 */
export function jointBandBg(colors: readonly string[], foe = false): string {
  const cs = foe ? [...colors].reverse() : [...colors];
  if (cs.length <= 1) return deep(cs[0] ?? '#2a3a6a');
  const n = cs.length;
  const stops = cs.flatMap((c, i) => {
    const a = (i * 100) / n;
    const z = ((i + 1) * 100) / n;
    const s0 = i === 0 ? '0%' : `calc(${a}% + 1px)`;
    const s1 = i === n - 1 ? '100%' : `calc(${z}% - 1px)`;
    const seam = i === n - 1 ? [] : [`var(--pg-sos-gold) calc(${z}% - 1px) calc(${z}% + 1px)`];
    return [`${deep(c)} ${s0} ${s1}`, ...seam];
  });
  return `linear-gradient(105deg, ${stops.join(', ')})`;
}

export function TeamCutin({ who, side, title, sub, media, k, top, height, colors, quick = false }: { who: { form: string; name: string; shiny?: boolean }[]; side: Side; title: string; sub: string; media: string; /** 그림 배율 */ k: 1 | 2 | 3; top: number; height: number; /** 참가자 타입 색 (앞장 = 띠 바탕 · 동료 = 속도선) */ colors: string[]; /** 같은 짝 두 번째 합동 (컷 0.6초 — 들어오기 없이 바로) */ quick?: boolean }) {
  const foe = side === 'foe';
  // 이음선 = 이웃한 두 그림 사이 가운데 (세로 · 재서 — 칸 비율로 나눠 둘째 포켓몬 몸 위를 지나던 것, 아트 디렉터 #100) · 재기 전엔 칸 비율
  const box = useRef<HTMLDivElement>(null);
  const [bg, setBg] = useState<string | null>(null);
  useLayoutEffect(() => {
    const el = box.current;
    const wrap = el?.querySelector<HTMLElement>('.pg-cutin-who');
    if (!el || !wrap || colors.length < 2) return;
    // offset* 은 들어오는 애니메이션 (transform) 을 안 셈 — 다 들어온 자리 · 숨긴 그림 (좁은 패널 — 앞장 하나) 은 뺌
    const cells = Array.from(wrap.querySelectorAll<HTMLElement>('.pg-cutin-mon'))
      .map((m, i) => ({ l: wrap.offsetLeft + m.offsetLeft, r: wrap.offsetLeft + m.offsetLeft + m.offsetWidth, w: m.offsetWidth, c: colors[i] ?? colors[0]! }))
      .filter((cell) => cell.w > 0);
    if (cells.length < 2) {
      if (bg !== null) setBg(null);
      return;
    }
    cells.sort((a, b) => a.l - b.l);
    const stops = cells.flatMap((cell, i) => {
      const next = cells[i + 1];
      const prev = cells[i - 1];
      const from = prev ? `${Math.round((prev.r + cell.l) / 2) + 1}px` : '0';
      const to = next ? `${Math.round((cell.r + next.l) / 2) - 1}px` : '100%';
      const seam = next ? [`var(--pg-sos-gold) ${Math.round((cell.r + next.l) / 2) - 1}px ${Math.round((cell.r + next.l) / 2) + 1}px`] : [];
      return [`${deep(cell.c)} ${from} ${to}`, ...seam];
    });
    const next = `linear-gradient(90deg, ${stops.join(', ')})`;
    if (next !== bg) setBg(next);
  });
  // 넘치면 한 단계 (U4 — 재서 · 맥 여유 10% · 이름은 자르지 않음): 1 = 큰 이름 20px · 2 = 큰 이름 두 줄 (splitName) · 3 = 그림 아래 이름표 뺌 · 4 = 그림은 앞장 하나
  //   (참가자 그림이 컷인의 뜻이라 두 줄 · 이름표를 먼저 — 480 에서 동료 그림까지 빠지던 것 · 240 2인 · 300 3인도 동료가 남게, UX 리뷰어 #96)
  //   — 240 에서 "삼중 빙염 소용돌이" 가 "삼중 빙염 소" 까지 잘리던 것 (개발 #96 · 합동 이름 표 10글자)
  const fitKey = `${title}|${sub}|${who.length}|${k}`;
  const [fit, setFit] = useState({ key: '', step: 0 });
  const step = fit.key === fitKey ? fit.step : 0;
  useLayoutEffect(() => {
    const el = box.current;
    const row = el?.querySelector<HTMLElement>('.pg-cutin-who');
    const tt = el?.querySelector<HTMLElement>('.pg-cutin-title');
    if (!el || !row || !tt || step >= 4) return;
    const cs = getComputedStyle(el);
    const room = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const need = (row.scrollWidth + (parseFloat(cs.columnGap) || 0) + tt.scrollWidth) * FIT_ROOM;
    if (need > room + 0.02) setFit({ key: fitKey, step: step + 1 });
  });
  // 글꼴이 늦게 오면 다시 잼
  useEffect(() => {
    let live = true;
    document.fonts?.ready.then(() => live && setFit({ key: '', step: 0 }));
    return () => {
      live = false;
    };
  }, []);
  const big = sub || title;
  const two = step >= 2 ? splitName(big) : null;
  const bigEl = two ? (
    <b>
      {two[0]}
      <br />
      {two[1]}
    </b>
  ) : (
    <b>{big}</b>
  );
  const vars: Record<string, string> = { top: `${top}px`, height: `${height}px`, background: bg ?? jointBandBg(colors, foe) };
  colors.forEach((c, i) => (vars[`--pg-cut-c${i + 1}`] = c));
  return (
    <div class={`pg-team-cutin${foe ? ' pg-cutin-foe' : ''}${quick ? ' pg-cutin-quick' : ''}${sub ? '' : ' pg-cutin-narrow'}${step >= 1 ? ' pg-cutin-fit1' : ''}${step >= 2 ? ' pg-cutin-fit2' : ''}${step >= 3 ? ' pg-cutin-fit3' : ''}${step >= 4 ? ' pg-cutin-fit4' : ''}`} style={vars} ref={box}>
      <span class="pg-cutin-lines" />
      <span class="pg-cutin-who">
        {who.map((w, i) => (
          <span key={i} class="pg-cutin-mon">
            <span class="pg-cutin-art">
              <Sprite media={media} form={w.form} shiny={w.shiny} scale={k} action="walk" faceLeft={foe} />
            </span>
            <b class="pg-cutin-name">{w.name}</b>
          </span>
        ))}
        {/* 좁은 컷인 ("합동 필살기!" 줄이 없는 400 아래) — 이름표 대신 그림 아래 가운데에 "합동!" 하나 (2인 · 3인 · 앞장 하나 모두 — 상대 합동이 "둘이 각자" 로 읽히던 것, UX 리뷰어 #96 · 아이디어 1611) */}
        {!sub && <b class="pg-cutin-name pg-cutin-tag">합동!</b>}
      </span>
      {/* 1:1 컷인처럼 — 위 작은 줄 ("합동 필살기!") + 큰 필살기 이름 (좁으면 "합동!" 하나) */}
      <span class="pg-cutin-title">
        {sub ? (
          <>
            <span class="pg-cutin-sub">{title}</span>
            {bigEl}
          </>
        ) : (
          bigEl
        )}
      </span>
    </div>
  );
}
