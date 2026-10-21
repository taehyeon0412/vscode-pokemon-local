/**
 * 개발 메뉴 (개발 모드 (임시), gdd 8장) — D 키 · 정보줄 "개발". ① 장면 바로 가기 ② 팀 만들기 (상대 팀도) ③ 상태 바꾸기 ④ 속도 ⑤ 3:3 미리 켜기.
 * 기능 뼈대 — 모양은 디자인팀 (클래스 pg-dev-*). 누르면 바로 게임 상태가 바뀜 (devApply), 장면을 고르면 판이 닫힘.
 */
import { useState } from 'preact/hooks';
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
];

let speciesList: { dex: number; name: string }[] | null = null;
/** 그림이 있는 포켓몬 전부 (도감 번호 순) */
function speciesOptions(): { dex: number; name: string }[] {
  speciesList ??= allSpecies()
    .filter((dex) => formsOfSpecies(dex).length > 0)
    .sort((a, b) => a - b)
    .map((dex) => ({ dex, name: `${dex} ${speciesOf(dex)?.name.ko ?? ''}` }));
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

export function DevPanel({ state, media, onDev, onEnd, onClose }: { state: GameState; media: string; onDev(a: DevAction): void; onEnd(): void; onClose(): void }) {
  const dev = state.runtime.dev ?? devDefault();
  const save = state.save;
  const fx = pokemonFx();
  const [addDex, setAddDex] = useState<number | null>(null);
  const [addLevel, setAddLevel] = useState(20);
  const say = state.runtime.toast?.text.startsWith('개발 — ') ? state.runtime.toast.text.slice(5) : '';
  return (
    <Panel icon="gear" title="개발 모드 (임시)" extra={<span class="pg-dev-say">{say}</span>} onClose={onClose}>
      {/* ① 장면 바로 가기 */}
      <Row wrap>
        <span class="pg-dev-head">장면</span>
        {SCENES.map((s) => (
          <Button key={s.scene} secondary extraClass="pg-dev-btn" onClick={() => onDev({ kind: 'scene', scene: s.scene })}>
            {s.label}
          </Button>
        ))}
      </Row>
      {/* ② 내 팀 — 포켓몬 · 레벨 · 필살기 */}
      <div class="pg-dev-team">
        <span class="pg-dev-head">내 팀</span>
        {save.party.map((uid, i) => {
          const m = save.monsters[uid];
          if (!m) return null;
          const ults = fx?.ults?.(m.form) ?? [];
          return (
            <div key={uid} class="pg-dev-row">
              <Sprite media={media} form={m.form} shiny={m.shiny} scale={1} px={24} />
              <SpeciesSelect value={m.species} onPick={(dex) => onDev({ kind: 'mon', slot: i, dex, level: m.level })} />
              <LevelInput value={m.level} onLevel={(level) => onDev({ kind: 'level', uid, level })} />
              {ults.length > 0 && (
                <select class="pg-dev-select" value={dev.ults[uid] ?? ''} title="필살기 — 고르면 늘 이것 (빈 칸 = 돌아가며)" onChange={(e) => onDev({ kind: 'ult', uid, name: e.currentTarget.value || null })}>
                  <option value="">필살기: 돌아가며</option>
                  {ults.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              )}
              <span class="pg-dev-hp">
                HP {m.hp}
              </span>
              {save.party.length > 1 && (
                <Button secondary extraClass="pg-dev-btn" onClick={() => onDev({ kind: 'mon-remove', slot: i })}>
                  빼기
                </Button>
              )}
            </div>
          );
        })}
        {save.party.length < BALANCE.partySize && (
          <div class="pg-dev-row">
            <SpeciesSelect value={addDex} onPick={setAddDex} />
            <LevelInput value={addLevel} onLevel={setAddLevel} />
            <Button secondary extraClass="pg-dev-btn" onClick={() => addDex !== null && onDev({ kind: 'mon', slot: save.party.length, dex: addDex, level: addLevel })}>
              더하기
            </Button>
          </div>
        )}
      </div>
      {/* ② 상대 팀 — 야생 = 첫 마리 · 3:3 = 셋 (비우면 장면 원래 상대) */}
      <div class="pg-dev-team">
        <span class="pg-dev-head">상대 팀</span>
        {Array.from({ length: Math.min(DEV_FOES_MAX, dev.foes.length + 1) }, (_, i) => {
          const f = dev.foes[i];
          return (
            <div key={i} class="pg-dev-row">
              <SpeciesSelect value={f?.dex ?? null} onPick={(dex) => onDev({ kind: 'foe', slot: i, dex, level: f?.level ?? 20 })} />
              {f && <LevelInput value={f.level} onLevel={(level) => onDev({ kind: 'foe', slot: i, dex: f.dex, level })} />}
              {f && (
                <Button secondary extraClass="pg-dev-btn" onClick={() => onDev({ kind: 'foe-remove', slot: i })}>
                  빼기
                </Button>
              )}
            </div>
          );
        })}
      </div>
      {/* ③ 상태 바꾸기 */}
      <Row wrap>
        <span class="pg-dev-head">상태</span>
        <Button secondary extraClass="pg-dev-btn" onClick={() => onDev({ kind: 'gauge-full' })}>
          필살기 게이지 가득
        </Button>
        <Button secondary extraClass="pg-dev-btn" onClick={() => onDev({ kind: 'heal' })}>
          모두 회복
        </Button>
        <Button secondary extraClass="pg-dev-btn" onClick={() => onDev({ kind: 'hp1', side: 'me' })}>
          내 HP 1
        </Button>
        <Button secondary extraClass="pg-dev-btn" onClick={() => onDev({ kind: 'hp1', side: 'foe' })}>
          상대 HP 1
        </Button>
        <Button secondary extraClass="pg-dev-btn" onClick={() => onDev({ kind: 'money' })}>
          돈 +10000
        </Button>
        <Button secondary extraClass="pg-dev-btn" onClick={() => onDev({ kind: 'balls' })}>
          볼 +10
        </Button>
        <Button secondary extraClass="pg-dev-btn" onClick={() => onDev({ kind: 'items' })}>
          아이템 +5
        </Button>
        <Button secondary extraClass="pg-dev-btn" onClick={() => onDev({ kind: 'pre-evolve' })}>
          진화 직전 (선두)
        </Button>
      </Row>
      {/* 개발 모드 끝내기 → 타이틀 (한 것은 저장 안 됨) */}
      <Row>
        <Button secondary extraClass="pg-dev-btn pg-dev-end" onClick={onEnd} title="개발 모드 끝내기 — 타이틀로 (개발 모드에서 한 것은 저장되지 않아요)">
          개발 모드 끝내기
        </Button>
        <span class="pg-dim">저장 안 됨 — 나가면 사라져요</span>
      </Row>
      {/* ④ 속도 · ⑤ 3:3 */}
      <Row wrap>
        <span class="pg-dev-head">속도</span>
        <Button secondary extraClass={dev.walk > 1 ? 'pg-picked pg-dev-btn' : 'pg-dev-btn'} onClick={() => onDev({ kind: 'walk' })} title="걷기 배 — 누를 때마다 ×1 → ×4 → ×10">
          걷기 ×{dev.walk}
        </Button>
        <Button secondary extraClass={dev.battle < 1 ? 'pg-picked pg-dev-btn' : 'pg-dev-btn'} onClick={() => onDev({ kind: 'battle-speed' })} title="전투 시간 배 — 누를 때마다 ×1 → ×0.5 → ×0.25 (연출 · 움직임까지 같이)">
          전투 ×{dev.battle}
        </Button>
        <Button secondary extraClass={dev.pause ? 'pg-picked pg-dev-btn' : 'pg-dev-btn'} onClick={() => onDev({ kind: 'pause' })} title="멈춤 — 게임 · 연출 · 움직임 모두">
          {dev.pause ? '▶ 다시 감' : '⏸ 멈춤'}
        </Button>
        <Button secondary extraClass={dev.team ? 'pg-picked pg-dev-btn' : 'pg-dev-btn'} onClick={() => onDev({ kind: 'team', on: !dev.team })} title="3:3 미리 켜기 — 개발 모드에서만 (트레이너 만남에서 1:1 / 3:3 고르기 · 관장 3:3)">
          {dev.team ? '✓ 3:3 켜짐' : '3:3 꺼짐'}
        </Button>
      </Row>
    </Panel>
  );
}
