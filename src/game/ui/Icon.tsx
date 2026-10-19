/**
 * 픽셀 아이콘 (단계 12) — 그림은 data/icons.ts (8 × 8 칸), 여기서 2배 (16px) SVG 로 그림
 */
import { ICONS, PAL, type IconName } from '../data/icons';

export type { IconName };

// 색마다 path 하나 (가로로 이어진 같은 색 칸은 한 덩어리) — 처음 그릴 때 한 번 만들어 둠
const cache = new Map<IconName, { fill: string; d: string }[]>();
function pathsOf(name: IconName): { fill: string; d: string }[] {
  const hit = cache.get(name);
  if (hit) return hit;
  const byColor = new Map<string, string>();
  ICONS[name].forEach((row, y) => {
    for (let x = 0; x < row.length; ) {
      const c = row.charAt(x);
      let w = 1;
      while (row.charAt(x + w) === c) w++;
      if (c !== '.') byColor.set(c, `${byColor.get(c) ?? ''}M${x} ${y}h${w}v1h-${w}z`);
      x += w;
    }
  });
  const paths = [...byColor].map(([c, d]) => ({ fill: PAL[c] ?? 'transparent', d }));
  cache.set(name, paths);
  return paths;
}

/** 글자 줄 · 버튼 안 픽셀 아이콘 (16px) — title 이 없으면 꾸밈 (옆 글자가 뜻을 말함) */
export function Icon({ name, title }: { name: IconName; title?: string }) {
  return (
    <svg class="pg-icon" viewBox="0 0 8 8" width="16" height="16" shape-rendering="crispEdges" role={title ? 'img' : undefined} aria-hidden={title ? undefined : 'true'}>
      {title && <title>{title}</title>}
      {pathsOf(name).map((p) => (
        <path key={p.fill} fill={p.fill} d={p.d} />
      ))}
    </svg>
  );
}
