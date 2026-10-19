import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FOREST_REQUESTS } from '../../game/core/rules/request';
import { STAGE_IDS } from '../../game/core/save';
import { FACILITY_STAFF, trainerCount } from '../../game/core/rules/stage';
import { FOREST_TRAINERS, GYM_LEADER, trainerInfo } from '../../game/core/rules/trainer';
import { HERO_LOOKS } from '../../game/data/heroes';
import { PEOPLE, personOf } from '../../game/data/people';
import { BUILDINGS, buildingDraw, staffLeftPx } from '../../game/features/stage/model';

/** PNG 머리 (IHDR) 의 가로 · 세로 */
function pngSize(file: string): { w: number; h: number } {
  const b = readFileSync(file);
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}

const DIR = join(__dirname, '..', '..', '..', 'extension', 'media', 'people');

describe('사람 그림 목록 (data/people.ts · scripts/people/fetch-pret.py)', () => {
  it('153명 · id 가 겹치지 않음 · 이름은 모두 한글 (2026-10-19 태현 님)', () => {
    expect(PEOPLE.length).toBe(153);
    expect(new Set(PEOPLE.map((p) => p.id)).size).toBe(PEOPLE.length);
    for (const p of PEOPLE) {
      expect(p.id, p.id).toMatch(/^[a-z0-9-]+$/);
      expect(p.name, p.id).toMatch(/^[가-힣0-9 ♂♀]+$/);
      expect(p.name, p.id).toMatch(/[가-힣]/);
    }
  });

  it('그림 파일 크기 = 장면 수 × 한 장면 크기 · 옆 · 정면 키가 같음 · 걷는 사람은 4장', () => {
    for (const p of PEOPLE) {
      expect(pngSize(join(DIR, p.id, 'walk.png')), `${p.id} walk`).toEqual({ w: p.walk.w * p.walk.frames, h: p.walk.h });
      expect(pngSize(join(DIR, p.id, 'front.png')), `${p.id} front`).toEqual({ w: p.front.w * p.front.frames, h: p.front.h });
      expect(p.front.h, p.id).toBe(p.walk.h);
      expect([1, 4], p.id).toContain(p.walk.frames);
      expect(p.front.frames, `${p.id} 정면 장면 수 = 옆 장면 수 (걷는 사람은 정면도 걷기)`).toBe(p.walk.frames);
    }
  });

  it('배치: 주인공 8명 · 숲 트레이너 9자리 · 관장 · 부탁하는 사람 5명 · 병원 간호순 · 상점 점원 — 모두 목록에 있고 서로 안 겹침', () => {
    const heroDirs = HERO_LOOKS.map((l) => l.dir);
    const trainers = FOREST_TRAINERS.map((t) => t.look);
    const requesters = FOREST_REQUESTS.map((r) => r.who.look);
    const staff = Object.values(FACILITY_STAFF).map((s) => s.look);
    const all = [...heroDirs, ...trainers, GYM_LEADER.look, ...requesters, ...staff];
    for (const id of all) expect(personOf(id), String(id)).toBeDefined();
    expect(new Set(all).size).toBe(all.length);
    expect(HERO_LOOKS.length).toBe(8);
    // 트레이너는 칭호 · 이름도 다 다름
    expect(new Set(FOREST_TRAINERS.map((t) => t.title)).size).toBe(FOREST_TRAINERS.length);
    expect(new Set(FOREST_TRAINERS.map((t) => t.name)).size).toBe(FOREST_TRAINERS.length);
    // 주인공 고르기 (태현 님): 남 레드 · 그린 · 휘웅 · 민진, 여 리프 · 지민 · 봄이 · 리즈
    expect(HERO_LOOKS.filter((l) => l.gender === 'male').map((l) => l.label)).toEqual(['레드', '그린', '휘웅', '민진']);
    expect(HERO_LOOKS.filter((l) => l.gender === 'female').map((l) => l.label)).toEqual(['리프', '지민', '봄이', '리즈']);
  });

  it('숲 트레이너: 실제로 나오는 자리 (스테이지마다 trainerCount 명) 는 모두 다른 사람 · 9자리 안에 들어감', () => {
    const shown = STAGE_IDS.flatMap((id) => Array.from({ length: trainerCount(id) }, (_, n) => trainerInfo(id, n)));
    expect(shown.length).toBeLessThanOrEqual(FOREST_TRAINERS.length);
    expect(new Set(shown.map((t) => t.look)).size).toBe(shown.length);
    expect(new Set(shown.map((t) => t.name)).size).toBe(shown.length);
  });
});

describe('병원 · 상점 건물 그림 (scripts/buildings/fetch-pret-buildings.py — 원작 파이어레드)', () => {
  const BDIR = join(__dirname, '..', '..', '..', 'extension', 'media', 'buildings');

  it('그림 파일 크기 = BUILDINGS 의 칸 수 · 문은 건물 안', () => {
    for (const [kind, b] of Object.entries(BUILDINGS)) {
      expect(pngSize(join(BDIR, `${b.file}.png`)), kind).toEqual({ w: b.w, h: b.h });
      expect(b.door, kind).toBeGreaterThan(0);
      expect(b.door, kind).toBeLessThan(b.w);
    }
  });

  it('크기: a = 1배 · b = 사람과 같은 정수 배율 (자리가 모자라면 위가 잘림) · 간호순 · 점원은 문 오른쪽', () => {
    expect(buildingDraw('hospital', 2.5, 200, 'a')).toEqual({ k: 1, visible: 70 });
    expect(buildingDraw('hospital', 2.5, 200, 'b')).toEqual({ k: 2, visible: 140 });
    expect(buildingDraw('hospital', 2, 68, 'b')).toEqual({ k: 2, visible: 68 });
    expect(buildingDraw('shop', 1.5, 45, 'b')).toEqual({ k: 1, visible: 45 });
    expect(staffLeftPx('hospital', 100, 2, 68)).toBeGreaterThan(100);
  });
});
