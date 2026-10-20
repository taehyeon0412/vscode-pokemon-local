/**
 * 포켓몬 카드 한 줄 (S18 내 포켓몬 · S21 프로필 같은 부품 — 2026-10-20 아트 디렉터 3차 "라벨: 값 양식 → 카드"):
 * 그림 (crop 32 = 원본 그대로) · 이름 12/600 · Lv 11 흐리게 · ★ · HP 막대 48 × 4 + "19/19" · 스탯 4칸 (숫자 12/600 크림 + 이름 11 흐리게)
 */
import type { StatKey } from '../../../core/save';
import { Sprite } from '../../../ui/Sprite';
import { stars, STAT_LABEL } from '../model';

export interface StatCardData {
  name: string;
  form: string;
  shiny: boolean;
  level: number;
  hp: number;
  maxHp: number;
  /** 개체값 등급 (모르면 null) */
  star: number | null;
  attack: number;
  defense: number;
  speed: number;
  ultimate: number;
}

const SHOWN: readonly Exclude<StatKey, 'hp'>[] = ['attack', 'defense', 'speed', 'ultimate'];

/** 두 줄 카드의 왼쪽 그림 칸 — 48 × 48 · 길 위와 같은 크기 (진화 상자와 같은 부품, 아트 디렉터 5차 "카드 안 포켓몬이 가장 작음") */
export function CardArt({ form, shiny, media }: { form: string; shiny: boolean; media: string }) {
  return (
    <span class="pg-card-art">
      <Sprite media={media} form={form} shiny={shiny} scale={1} crop={48} fieldSize />
    </span>
  );
}

/** art = 줄 안 작은 그림 (crop 32) 을 그릴지 — 두 줄 카드 (CardArt 가 왼쪽 칸) 면 false */
export function StatCard({ d, media, prefix = '', art = true }: { d: StatCardData; media: string; prefix?: string; art?: boolean }) {
  const ratio = d.maxHp > 0 ? Math.max(0, Math.min(1, d.hp / d.maxHp)) : 0;
  return (
    <span class="pg-statcard">
      {/* 원본 32 칸 그대로 (24 창이면 그림 양옆이 잘려서 — 아트 디렉터 4차) */}
      {art && <Sprite media={media} form={d.form} shiny={d.shiny} scale={1} crop={32} />}
      <b class="pg-statcard-name">
        {prefix}
        {d.name}
      </b>
      <span class="pg-statcard-lv">Lv {d.level}</span>
      {d.star !== null && (
        <span class="pg-star" title="개체값 등급 (★ 많을수록 타고난 힘이 셈)">
          {stars(d.star)}
        </span>
      )}
      <span class="pg-statcard-hp" title={`HP ${d.hp}/${d.maxHp}`}>
        <span class="pg-statcard-bar">
          <span class={ratio > 0.5 ? 'pg-bar-fill' : ratio > 0.2 ? 'pg-bar-fill pg-mid' : 'pg-bar-fill pg-low'} style={{ width: `${Math.round(ratio * 100)}%` }} />
        </span>
        {d.hp}/{d.maxHp}
      </span>
      <span class="pg-statcard-stats">
        {SHOWN.map((k) => (
          <span key={k} class="pg-statcard-stat">
            <b>{Math.floor(d[k])}</b> {STAT_LABEL[k]}
          </span>
        ))}
      </span>
    </span>
  );
}
