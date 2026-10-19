/**
 * 픽셀 아이콘 · 길 위 그림 (단계 12) — 그림은 data/icons.ts (글자 칸), 여기서 SVG 로 그림.
 * 점 크기 px: 아이콘 = 2 (8 × 8 → 16px, 글자 줄 · 버튼), 길 위 그림 = 포켓몬 그림 배율 (layout.scale)
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

/** title 이 없으면 꾸밈 (옆 글자가 뜻을 말함) · px = 점 크기 */
export function Icon({ name, title, px = 2 }: { name: IconName; title?: string; px?: number }) {
  const rows = ICONS[name];
  const w = rows[0]?.length ?? 8;
  const h = rows.length;
  return (
    <svg class="pg-icon" viewBox={`0 0 ${w} ${h}`} width={w * px} height={h * px} shape-rendering="crispEdges" role={title ? 'img' : undefined} aria-hidden={title ? undefined : 'true'}>
      {title && <title>{title}</title>}
      {pathsOf(name).map((p) => (
        <path key={p.fill} fill={p.fill} d={p.d} />
      ))}
    </svg>
  );
}
