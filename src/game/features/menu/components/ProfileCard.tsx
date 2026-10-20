/**
 * S21 포켓몬 프로필 (전투 중) (gdd S21) — 전투에서 포켓몬을 누르면 가로로 긴 카드. 떠 있는 동안 전투가 멈춤 (필살기 · 게이지 포함, main.ts).
 *   내 포켓몬: ① 이름 · Lv · ★ · ② 스탯 5개 · ③ 경험치 · ⑥ 기술 4개 (남은 PP)
 *   상대: ① 이름 · Lv · ★ · ② 스탯 5개 · ③ 타입 · 잡은 적 있는지 ◓
 *   ④ 닫기 (바깥 클릭 · Esc · 포켓몬 다시 클릭) · ⑤ ⏸ 전투 멈춤. 힘대결 · 잡기 원 중에는 안 열림 (화면이 막음)
 */
import type { BattleState, Side } from '../../../core/engine';
import type { Save } from '../../../core/save';
import { typeNameKo } from '../../../core/text';
import { speciesOf } from '../../../data';
import { Button } from '../../../ui/Button';
import { Icon } from '../../../ui/Icon';
import { moveView } from '../../result/model';
import { monsterView } from '../model';
import { StatCard } from './StatCard';

export function ProfileCard({ battle: b, save, media, side, onClose }: { battle: BattleState; save: Save; media: string; side: Side; onClose(): void }) {
  const f = b[side];
  const name = speciesOf(f.species)?.name.ko ?? f.form;
  const mine = side === 'me' ? save.monsters[f.uid] : undefined;
  const view = mine ? monsterView({ ...mine, hp: f.hp }) : null;
  const star = typeof f.star === 'number' ? f.star : null;
  const caught = save.dex.caught.includes(f.species);
  return (
    <div class="pg-profile-wrap" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div class="pg-banner pg-profile pg-two" role="dialog">
        <span class="pg-line">
          <StatCard
            media={media}
            prefix={side === 'foe' ? (b.kind === 'wild' ? '야생 ' : '상대 ') : ''}
            d={{ name, form: f.form, shiny: f.shiny, level: f.level, hp: f.hp, maxHp: f.maxHp, star, attack: f.stats.attack, defense: f.stats.defense, speed: f.stats.speed, ultimate: f.stats.ultimate }}
          />
          <Button secondary extraClass="pg-pin" onClick={onClose} title="Esc · 바깥 클릭">
            ✕ 닫기
          </Button>
        </span>
        <span class="pg-line">
          {view ? (
            <>
              {/* 경험치 = 이름 + 가는 막대 (HP 막대와 같은 모양 · 이름 없음이라 0 이면 HP 0 처럼 보이던 것 — 아트 디렉터 4차) */}
              <span class="pg-exp" title={`다음 레벨까지 경험치 ${view.expToNext}`}>
                경험치
                <span class="pg-expbar">
                  <span class="pg-bar-fill" style={{ width: `${Math.round(view.expRatio * 100)}%` }} />
                </span>
              </span>
              {f.moves.map((s) => {
                const mv = moveView(s.moveId, s.pp);
                return (
                  <span key={s.moveId} class="pg-move" title={mv.detail}>
                    {mv.name} <span class="pg-sub">{s.pp} PP</span>
                  </span>
                );
              })}
            </>
          ) : (
            <>
              <span>{f.types.map(typeNameKo).join(' · ')}</span>
              <span class={caught ? 'pg-reward' : 'pg-dim'}>
                <Icon name="ball" /> {caught ? '잡은 적 있음' : '아직 안 잡음'}
              </span>
            </>
          )}
          <span class="pg-paused">‖ 전투 멈춤</span>
        </span>
      </div>
    </div>
  );
}
