/**
 * 타입 표 (2026-10-20 태현 님 "타입은 글자 색을 타입에 맞게, 동그랗게") — 글자 · 테두리 = 타입 색 (battle/model TYPE_COLOR — 빛줄기 · 힘대결과 같은 표).
 * 한 글자 (풀 · 독 · 물) 는 동그라미, 두세 글자는 같은 높이의 알약 — 테두리는 픽셀로 또렷하게 (SVG crispEdges, 다른 픽셀 그림과 같은 언어).
 * 남색 판 위에서 안 읽히는 어두운 색 (악 · 고스트 · 드래곤) 은 글자만 크림 쪽으로 밝게 (typeInk)
 */
import type { TypeName } from '../../../data';
import { typeNameKo } from '../../../core/text';
import { TYPE_COLOR, typeInk } from '../model';

export function TypeTag({ type }: { type: TypeName }) {
  const color = TYPE_COLOR[type];
  return (
    <span class="pg-type-tag" style={{ color: typeInk(color) }}>
      <svg class="pg-type-ring" aria-hidden="true" shape-rendering="crispEdges">
        <rect x="1" y="1" rx="9" ry="9" fill="none" stroke={color} stroke-width="2" />
      </svg>
      {typeNameKo(type)}
    </span>
  );
}

/** 타입 표 여러 개 (· 없이 나란히) */
export function TypeTags({ types }: { types: readonly TypeName[] }) {
  return (
    <span class="pg-type-tags">
      {types.map((t) => (
        <TypeTag key={t} type={t} />
      ))}
    </span>
  );
}
