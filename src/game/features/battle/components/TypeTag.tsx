/**
 * 타입 표 (2026-10-20 태현 님 B안 "원 엠블럼 + 이름") — 타입 색 (battle/model TYPE_COLOR — 빛줄기 · 힘대결과 같은 표) 으로 칠한 동그라미 22px 안에
 * 8 × 8 × 2 픽셀 아이콘 (data/type-icons — 어두운 타입은 밝은 아이콘), 옆에 타입 색 이름 (남색 위에서 안 읽히는 어두운 색은 밝게 — typeInk).
 * 아이콘은 가로로 이어진 칸을 한 rect 로 (ui/Icon 과 같은 방식) · crispEdges 로 점이 또렷하게
 */
import type { TypeName } from '../../../data';
import { TYPE_ICONS } from '../../../data/type-icons';
import { typeNameKo } from '../../../core/text';
import { TYPE_COLOR, typeGlyph, typeInk } from '../model';

function IconRects({ rows }: { rows: readonly string[] }) {
  const out: preact.JSX.Element[] = [];
  rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      if (row[x] !== 'X') {
        x++;
        continue;
      }
      const start = x;
      while (x < row.length && row[x] === 'X') x++;
      out.push(<rect key={`${y}-${start}`} x={start} y={y} width={x - start} height={1} />);
    }
  });
  return <>{out}</>;
}

export function TypeTag({ type }: { type: TypeName }) {
  const color = TYPE_COLOR[type];
  return (
    <span class="pg-type-tag" title={typeNameKo(type)}>
      <span class="pg-type-disc" style={{ background: color }}>
        <svg class="pg-type-icon" width="16" height="16" viewBox="0 0 8 8" shape-rendering="crispEdges" fill={typeGlyph(color)} aria-hidden="true">
          <IconRects rows={TYPE_ICONS[type]} />
        </svg>
      </span>
      <b style={{ color: typeInk(color) }}>{typeNameKo(type)}</b>
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
