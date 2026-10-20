/**
 * S12 전투 결과 (gdd S12) — ① 경험치 · ② 돈 · ③ 아이템 · ④ 레벨업 · ⑥ 새 기술 · ⑤ 계속 (Space · Enter · 클릭).
 * 잠깐 보여 주고 저절로 넘어감 (자동 전투로 둬도 멈추지 않게) — 고를 것이 있으면 S23 · S22 로.
 * 모양 = 전투와 같은 판 (단계 12): 받은 것은 금색 글자 + 픽셀 아이콘, 레벨업 ▲ · 새 기술 ★
 * ④ 레벨업 = 왼쪽 얼굴 카드 (누르면 · P = 내 포켓몬 판에서 그 포켓몬 스탯 찍기) + 스탯을 찍어 본 적이 없으면 안내 말풍선 (2026-10-20 태현 님 B + 말풍선)
 * 잡았으면 결과 상자 전에 가운데 소개 카드 1.5초 (2026-10-20 태현 님 안 2)
 */
import { BALANCE, TIMING } from '../../../core/balance';
import type { BattleSummary, GameInput } from '../../../core/engine';
import { Button } from '../../../ui/Button';
import { KeyCap } from '../../../ui/KeyCap';
import { Icon } from '../../../ui/Icon';
import { Sprite } from '../../../ui/Sprite';
import { speciesOf } from '../../../data';
import { spriteBoxOf } from '../../../data/sprite-boxes';
import { TypeTags } from '../../battle/components/TypeTag';
import { partText, summaryLines, type CaughtView, type LevelUpView, type SummaryPart } from '../model';

/** 잡은 포켓몬 소개 카드 — 결과 상자 전 1.5초 (TIMING.caughtIntroMs), 잡기 창과 같은 집중 모양 (둘레 어둡게 · 2px 금색 · 이름표 "잡았다!") · 그림 크게 · "NEW! 처음 잡았다" (도감 화면은 다음 버전) · 이름 Lv · 타입 · 팀 / 보관함. 누르면 넘김 (2026-10-20 태현 님 안 2) */
function CaughtIntro({ c, media, onSkip }: { c: CaughtView; media: string; onSkip(): void }) {
  const types = speciesOf(c.species)?.types ?? [];
  // 그림 칸 64 — 실제 그림 (sprite-boxes) 이 칸을 채우는 가장 큰 정수 배 (위아래 1칸 여유, 1 ~ 3배)
  const box = spriteBoxOf(c.form);
  const zoom = box ? Math.max(1, Math.min(3, Math.floor(62 / Math.max(box[2] - box[0], box[3] - box[1])))) : 2;
  return (
    <div class="pg-caught-intro" onClick={onSkip} title="클릭 · Space · Enter — 넘기기">
      <span class="pg-caught-title">잡았다!</span>
      <span class="pg-caught-art">
        <Sprite media={media} form={c.form} shiny={c.shiny} scale={1} crop={64} zoom={zoom} center />
        <i class="pg-lvup-spark pg-lvup-spark-1" aria-hidden="true" />
        <i class="pg-lvup-spark pg-lvup-spark-2" aria-hidden="true" />
      </span>
      <span class="pg-caught-info">
        {c.isNew && <span class="pg-caught-new">NEW! 처음 잡았다</span>}
        <b class="pg-caught-name">
          {c.name} <span class="pg-dim">Lv{c.level}</span>
        </b>
        <TypeTags types={types} />
        <span class="pg-caught-where">{c.toBox ? '팀이 다 차서 보관함으로' : '팀에 들어옴'}</span>
      </span>
    </div>
  );
}

/** 첫 줄 받은 것 — 라이벌 보상 (돈 ×1.5 · 아이템) 은 ★ 금색 (gdd 4.12 — 글을 늘리면 좁은 패널에서 잘려서 표시로만) */
function Reward({ p, rare }: { p: SummaryPart; rare: boolean }) {
  return (
    <span class={rare && p.kind !== 'caught' ? 'pg-reward pg-reward-rare' : 'pg-reward'}>
      <Icon name={p.kind === 'caught' ? 'ball' : p.kind === 'money' ? 'coin' : 'gift'} /> {p.text}
    </span>
  );
}

/** 둘째 줄 — 레벨업 ▲ · 새 기술 ★ (금색) · 라이벌 한마디는 따옴표 */
function Line({ p }: { p: SummaryPart }) {
  if (p.kind === 'up' || p.kind === 'learned') {
    return (
      <>
        <span class="pg-up">{p.kind === 'up' ? '▲' : '★'}</span> {p.text}
      </>
    );
  }
  return <>{p.kind === 'quote' ? `“${p.text}”` : p.text}</>;
}

/** 얼굴 카드 (최대 셋) — 포켓몬 그림 (길 위 크기) · 왼쪽 아래 Lv · 오른쪽 위 +남은 포인트 · 2px 금색 테두리 = 버튼. hint = 첫 포인트 카드 아래 말풍선 */
function FaceCards({ ups, media, hint, onStats }: { ups: LevelUpView[]; media: string; hint: boolean; onStats(uid: string): void }) {
  const shown = ups.slice(0, 3);
  const hintAt = shown.find((u) => u.points > 0)?.uid;
  return (
    <>
      {shown.map((u) => (
        <button key={u.uid} type="button" class="pg-lvup-card" onClick={() => onStats(u.uid)} title={`${u.name} Lv ${u.from} → ${u.to} — 스탯 찍기 (P)`}>
          <Sprite media={media} form={u.form} shiny={u.shiny} scale={1} crop={40} fieldSize center />
          {/* "Lv7" — ▲7 은 +7 로도 읽혀서 (아트 디렉터 7차 제안 · 2026-10-20 태현 님) */}
          <span class="pg-lvup-card-lv">Lv{u.to}</span>
          {u.points > 0 && <span class="pg-lvup-card-pts">+{u.points}</span>}
          <i class="pg-lvup-spark pg-lvup-spark-1" aria-hidden="true" />
          <i class="pg-lvup-spark pg-lvup-spark-2" aria-hidden="true" />
          {/* 처음 배울 때까지 — 카드 아래 말풍선이 카드를 가리킴 (스탯을 한 번 찍으면 안 나옴) */}
          {hint && u.uid === hintAt && (
            <span class="pg-lvup-hint">
              <span class="pg-lvup-hint-verb">눌러서 </span>스탯 찍기
            </span>
          )}
        </button>
      ))}
    </>
  );
}

/** next = 이어서 고를 것 (맨 앞) — 버튼에 다음 할 일 · ups = 레벨업한 포켓몬 (result/model levelUps) · onStats = 내 포켓몬 판 (그 포켓몬) */
export function ResultBox({ summary, next, ups, hint = false, caught = null, ms = 0, media, onInput, onStats }: { summary: BattleSummary; next: 'learn' | 'evolve' | null; ups: LevelUpView[]; /** 얼굴 카드 안내 말풍선 (needsStatHint) */ hint?: boolean; /** 잡은 포켓몬 — 처음 caughtIntroMs 동안 소개 카드만 */ caught?: CaughtView | null; /** 결과 단계 지난 ms */ ms?: number; media: string; onInput(i: GameInput): void; onStats(uid: string): void }) {
  if (caught && ms < TIMING.caughtIntroMs) return <CaughtIntro c={caught} media={media} onSkip={() => onInput({ kind: 'result-continue' })} />;
  const { title, head, body } = summaryLines(summary);
  const all = [title, ...head.map(partText), ...body.map(partText)].join(' · ') + (summary.rival ? ` · 라이벌 보상 (돈 ×${BALANCE.rivalMoneyScale} · 아이템)` : '');
  // 카드가 레벨업을 보여 주면 둘째 줄의 "▲ 이상해씨 Lv 5 → 6 (경험치 +28)" 은 빼고 새 기술 (★) 을 앞에 — 같은 말 두 번 · 좁으면 ★ 가 잘리던 것 (아트 디렉터 7차, 전체는 마우스를 올리면)
  const rest = ups.length === 0 ? body : [...body.filter((p) => p.kind === 'learned'), ...body.filter((p) => p.kind !== 'up' && p.kind !== 'learned')];
  const lines = (
    <>
      <span class="pg-line">
        <b class="pg-ellipsis">{title}</b>
        {head.map((p) => (
          <Reward key={p.kind} p={p} rare={!!summary.rival} />
        ))}
        <Button onClick={() => onInput({ kind: 'result-continue' })} title="Space · Enter">
          <KeyCap k="Enter" /> {next === 'evolve' ? '▶ 어…?' : next === 'learn' ? '▶ 새 기술' : '계속 ▶'}
        </Button>
      </span>
      {rest.length > 0 && (
        <span class="pg-line pg-ellipsis pg-result-body">
          {rest.map((p, i) => (
            <span key={i}>
              {i > 0 && ' · '}
              <Line p={p} />
            </span>
          ))}
        </span>
      )}
    </>
  );
  if (ups.length === 0) {
    return (
      <div class="pg-banner pg-result pg-two" title={all}>
        {lines}
      </div>
    );
  }
  return (
    <div class="pg-banner pg-result pg-two pg-lvup" title={all}>
      <span class="pg-lvup-cards">
        <FaceCards ups={ups} media={media} hint={hint} onStats={onStats} />
      </span>
      <span class="pg-result-lines">{lines}</span>
    </div>
  );
}
