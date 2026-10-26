#!/usr/bin/env python3
"""필살기 연출이 위 끝 (정보줄 · 지도 줄) 뒤로 숨는지 훑기 (2026-10-23 orders #105 — 1:1 다이내믹풀플레임 구가 187 에서 정보줄 뒤로 던져짐)
  python dev/ult-top.py [창 수=2] [이름 걸러내기=]   → dev/shots/ult-top.json + 표 (콘솔)
  머리 없는 크롬 여러 개 (860 × 187 · 1:1 전투 화면 · 위 끝 = 3:3 장면 전환과 같은 지도 줄 아래 52px 로 맞춤) 에서 필살기마다 window.pokemonFx.ult(…, { entry }) 로 돌리며,
  연출 캔버스에 그려졌지만 위 끝에서 잘려 안 보이는 점 (위 끝 위 40px 띠 — 캔버스는 CSS 로만 잘려 그린 점은 남음) 넓이를 본편 (기 모으기 · 컷인 뒤) 동안 70ms 마다 잼.
  패널 폭 85% 넘게 칠한 줄은 뺌 (번쩍 · 어둠 같은 화면 판). 숨음 = 한 장면에 위 끝 위 점이 1500px² 넘고 그 장면 연출 점 (위 끝 위 띠 + 아래 무대) 의 60% 넘게
  (구 · 덩어리가 통째로 넘어감 — 다이내믹풀플레임 81 ~ 95% · 솔라빔 하늘 빛기둥처럼 위에서 들어오는 것은 약 40% 라 빠짐)
  고르는 필살기 = 전용 (fx-unique uniq · fx-sky 스타팅 특수 키) 전부 + 일반 필살기는 틀 · 옵션 (색 c 빼고) 이 같은 것끼리 하나씩
  --joint = 3:3 장면 전환 합동처럼 (entry 옵션에 o.track — 연출 틀의 합동 갈래 · 구 · 메가진화 늘림) · 결과 파일은 ult-top-joint.json
  걸쳐 머묾 = 위 끝 바로 위 4px · 바로 아래 4px 에 같은 세로줄이 함께 칠해진 (일자로 잘린) 폭이 8px 넘는 장면이 0.3초 넘게 이어짐 (비율 60% 아래라도 — 던진 구 · 머리 위 공이 반쯤 걸친 것, #96 디자인 4바퀴)
  숨음 · 못 잼 · 기준선 (dev/ult-top-stay.json) 밖의 새 걸침이 있으면 exit 1 (npm run test:ult-top — 지나감 목록은 빼고 셈) · 기준선 걸침은 보고만 (#107 에서 0 까지)
  --report <json> = 다시 돌리지 않고 저장된 결과로 셈 · --write-baseline = 이번 걸침으로 기준선을 다시 씀 (고친 뒤 줄일 때)
  TOP_UNIQ=1 = 전용만 · 0 = 일반만 · TOP_REAL=1 = 실제 1:1 전투 화면 그대로 (위 끝 = 정보줄 아래 끝 · 내 칸 자리 그대로) · TOP_DUMP=<폴더> = 가장 많이 숨은 장면 캔버스 PNG · 이름 걸러내기는 쉼표로 여럿
  dev/ult-fx.py 의 창 · 페이지 도구를 씀"""
import importlib.util
import json
import os
import shutil
import subprocess
import sys
import tempfile
import time

# PG_ROOT = 다른 폴더의 빌드로 잼 (main 견주기)
ROOT = os.environ.get("PG_ROOT") or os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
spec = importlib.util.spec_from_file_location("ultfx", os.path.join(ROOT, "dev", "ult-fx.py"))
U = importlib.util.module_from_spec(spec)
_argv = sys.argv
sys.argv = [_argv[0]]
spec.loader.exec_module(U)
sys.argv = _argv
JOINT = "--joint" in sys.argv or os.environ.get("TOP_JOINT") == "1"
if JOINT:
    sys.argv = [a for a in sys.argv if a != "--joint"]
    os.environ["TOP_JOINT"] = "1"  # 일꾼 (--worker) 에게도
OUT = os.environ.get("TOP_OUT") or os.path.join(ROOT, "dev", "shots", "ult-top-joint.json" if JOINT else "ult-top.json")
SPECIAL = ["uniq", "blast", "flare", "venus", "turtle", "ninja", "clones", "lucario", "mew", "mewtwo"]
# 3:3 장면 전환 187 의 위 끝 (정보줄 + 지도 줄 아래 끝)
TOP_PX = 52
BAND_PX = 40
HIDE_PX2 = 1500
HIDE_FRAC = 0.6
# 걸쳐 머묾 — 위 끝 위아래 띠 (px) · 일자로 잘린 폭 (px) · 이어진 시간 (ms)
CUT_BAND = 4
CUT_MIN = 8
STAY_MS = 300
# 걸쳐 머묾 기준선 (#107 — 2026-10-24) — 그때 있던 걸침 목록 (1:1 · 합동 따로). 기준선 밖의 새 걸침 = 실패 · 기준선에서 없어진 것 = 고쳐짐 (--write-baseline 로 줄임) · 0 이 목표
STAY_BASE = os.path.join(ROOT, "dev", "ult-top-stay.json")
# 지나가는 것 (ux-rules U4 "지나가는 것은 됨" — #96 ④, TOP_DUMP 장면으로 확인) — 숨음으로 세지 않고 따로 적음 · 열쇠 글자가 들어 있으면
PASSING = {
    "rayquaza|화룡점정|": "땅에서 화면 밖까지 솟는 빛기둥 (무대 쪽은 칠한 줄로 빠져 100% 로 읽힘)",
    "pikachu|1000만볼트|": "하늘에서 내리치는 번개",
    "metagross|코멧펀치|": "0.45초 내리꽂는 혜성",
    "|월즈엔드폴|ultskyfall": "1.35초 떨어지는 거대 바위",
    "|절대영도|ultskyfall": "1.35초 떨어지는 거대 얼음 (월즈엔드폴과 같은 틀)",
    "|레이징지오프리즈|ultskyfall": "1.35초 떨어지는 거대 얼음 (월즈엔드폴과 같은 틀)",
    "|폭포오르기|ultdive": "하늘에서 내리꽂는 몸 · 혜성 꼬리 (하늘 반짝 별은 위 끝 아래로 옮김)",
    "|누르기|ultdive": "하늘에서 내리꽂는 몸 · 혜성 꼬리 (폭포오르기와 같은 틀)",
}
# 일반 필살기는 대표 포켓몬이 바뀌어도 걸리게 틀 · 옵션 (sig) 으로도 — 내리꽂는 몸 (ultdive heavy · fx-body)
PASSING_SIG = [(('"ultdive"', '["heavy",1]'), "하늘에서 내리꽂는 몸 · 혜성 꼬리 (일반 ultdive heavy — 폭포오르기 · 누르기 · 몸통박치기 …)"),
               # 2026-10-24 #96 — lileep 원시의힘 (n 3) 이 합동 훑기에서 한 번 66% (1600px²) · 혼자 다시 재면 37% — 떨어지는 바위 수가 적어 무대 쪽 점이 적을 때 흔들림
               (('"ultskyfall"',), "하늘에서 떨어지는 바위 · 운석 · 얼음 · 별 (일반 ultskyfall — 월즈엔드폴과 같은 틀)")]
# 자리 — 860 × 187 · 쓰는 쪽 x · 대상 x
CFGS = {"L": (215, 625), "R": (625, 215)}
PICK = r"""
((special) => {
  const w = document.querySelector('iframe').contentWindow;
  const lib = w.__ult.lib();
  const out = {};
  const seen = new Set();
  for (const f of %FORMS%) for (const e of w.__ult.of(f) || []) {
    const i = lib.indexOf(e);
    const o = e[2] || {};
    const uniq = special.some((k) => o[k]);
    // 일반 필살기 — 틀 · 옵션 (색 빼고) 이 같으면 하나만
    const sig = uniq ? `u${i}` : JSON.stringify([e[1], Object.keys(o).filter((k) => k !== 'c').sort().map((k) => [k, o[k]])]);
    if (seen.has(sig)) continue;
    seen.add(sig);
    out[`${f}|${e[0]}|${e[1]}`] = [f, i, uniq ? 1 : 0, sig];
  }
  return out;
})(%SPECIAL%)
"""
ONE = r"""
(async (form, idx, cfg) => {
  const w = document.querySelector('iframe').contentWindow;
  const d = w.document;
  const fx = w.pokemonFx;
  const lib = w.__ult.lib();
  fx.clear();
  // 위 끝을 3:3 장면 전환 값으로 고정 (1:1 BattleFx 가 그릴 때마다 정보줄 아래 끝으로 다시 씀) · real = 실제 1:1 전투 화면 그대로 (위 끝 · 자리 안 바꿈)
  if (!cfg.real && !w.__topPinned) {
    w.__topPinned = true;
    const sp = d.body.style.setProperty.bind(d.body.style);
    d.body.style.setProperty = (k, v, p) => sp(k, k === '--pg-fx-top' ? `${cfg.top}px` : v, p);
  }
  if (!cfg.real) d.body.style.setProperty('--pg-fx-top', `${cfg.top}px`);
  await new Promise((r) => w.setTimeout(r, 120));
  const meBox = d.querySelector('.pg-fighter-me');
  const foeBox = d.querySelector('.pg-fighter-foe');
  for (const b of [meBox, foeBox]) { b.style.position = 'relative'; b.style.top = '0px'; b.style.marginLeft = '0px'; }
  const place = (box, cx) => {
    box.style.marginLeft = '0px';
    const r = box.getBoundingClientRect();
    box.style.marginLeft = `${Math.round(cx - (r.left + r.width / 2))}px`;
  };
  place(meBox, cfg.meX);
  place(foeBox, cfg.foeX);
  // 둘 다 땅 (패널 아래 − 14px) 에 — 3:3 장면 전환 1:1 자리처럼 (1:1 전투 화면은 내 칸이 위쪽이라 몸 둘레 연출까지 위 끝 뒤로 들어가 잘못 셈)
  for (const b of cfg.real ? [] : [meBox, foeBox]) {
    const r = b.getBoundingClientRect();
    b.style.top = `${Math.round(w.innerHeight - 14 - r.bottom)}px`;
  }
  const src = { el: meBox.querySelector('.pg-sprite'), box: meBox, form, size: 32, left: false, name: 'x' };
  const dst = { el: foeBox.querySelector('.pg-sprite'), box: foeBox, form: 'butterfree', size: 32, left: true };
  const t0 = w.performance.now();
  let entry = lib[idx];
  if (cfg.joint) {
    // 3:3 장면 전환 합동처럼 — bridge team11Joint 와 같은 규칙 (구 · 메가진화 = 기 모아 주는 1초를 연출 틀이 늘림)
    const o = entry[2] || {};
    const special = %SPECIAL%.some((k) => o[k]);
    const orbUlt = entry[1] === 'ultorb' && !o.sky && !special;
    const morph = (entry[1] === 'ultpillar' && !!(o.blast || o.venus)) || (entry[1] === 'ultorb' && !!o.turtle);
    entry = [entry[0], entry[1], { ...o, track: { half: true, extraG: orbUlt || morph ? 1 : 0, willMorph: morph } }];
  }
  const total = fx.ult(src, dst, () => {}, [], { entry });
  if (!total) return null;
  const W = w.innerWidth;
  const bar = d.querySelector('#pokemon-game .pg-infobar');
  const top = cfg.real ? Math.max(bar ? Math.round(bar.getBoundingClientRect().bottom) : 0, parseFloat(d.body.style.getPropertyValue('--pg-fx-top')) || 0) : cfg.top;
  // 위 끝 위 띠에 그려진 점 (화면 판 줄 — 폭 85% 넘게 칠한 줄 — 은 뺌) · 위 끝 바로 아래 띠도 (잘린 덩어리인지 — 아래로 이어짐)
  const painted = (ya, yb) => {
    let n = 0;
    for (const c of d.querySelectorAll('canvas')) {
      const r = c.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      const y0 = Math.max(r.top, ya);
      const y1 = Math.min(r.bottom, yb);
      if (y1 - y0 < 1) continue;
      const ctx = c.getContext('2d', { willReadFrequently: true });
      if (!ctx) continue;
      const sx = c.width / r.width, sy = c.height / r.height;
      const cw = Math.round(W * sx);
      const ch = Math.max(1, Math.round((y1 - y0) * sy));
      const px = ctx.getImageData(Math.floor((0 - r.left) * sx), Math.floor((y0 - r.top) * sy), cw, ch).data;
      for (let y = 0; y < ch; y++) {
        let k = 0;
        for (let x = 0; x < cw; x++) {
          const i = (y * cw + x) * 4;
          if (px[i + 3] >= 96 && Math.max(px[i], px[i + 1], px[i + 2]) >= 48) k += 1;
        }
        if (k < cw * 0.85) n += k / (sx * sy);
      }
    }
    return n;
  };
  // 일자로 잘린 폭 — 위 끝 바로 위 band px 와 바로 아래 band px 에 둘 다 칠해진 세로줄 수 (화면 판 줄 — 85% 넘게 칠한 줄 — 은 뺌)
  const cutCols = (band) => {
    const above = new Uint8Array(W);
    const below = new Uint8Array(W);
    for (const c of d.querySelectorAll('canvas')) {
      const r = c.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      const ctx = c.getContext('2d', { willReadFrequently: true });
      if (!ctx) continue;
      const sx = c.width / r.width, sy = c.height / r.height;
      const cw = Math.round(W * sx);
      for (const [ya, yb, out] of [[top - band, top, above], [top, top + band, below]]) {
        const y0 = Math.max(r.top, ya);
        const y1 = Math.min(r.bottom, yb);
        if (y1 - y0 < 1) continue;
        const ch = Math.max(1, Math.round((y1 - y0) * sy));
        const px = ctx.getImageData(Math.floor((0 - r.left) * sx), Math.floor((y0 - r.top) * sy), cw, ch).data;
        for (let y = 0; y < ch; y++) {
          const row = [];
          for (let x = 0; x < cw; x++) {
            const i = (y * cw + x) * 4;
            if (px[i + 3] >= 96 && Math.max(px[i], px[i + 1], px[i + 2]) >= 48) row.push(x);
          }
          if (row.length >= cw * 0.85) continue;
          for (const x of row) out[Math.min(W - 1, Math.floor(x / sx))] = 1;
        }
      }
    }
    const cols = [];
    for (let x = 0; x < W; x++) if (above[x] && below[x]) cols.push(x);
    return cols;
  };
  let most = 0, at = -1, frac = 0, peak = 0, img = null;
  // 이어짐 = 걸친 세로줄이 앞 장면과 절반 넘게 겹침 (같은 모양이 그 자리에 머묾 — 유성 비처럼 다른 것이 잇달아 지나가는 것은 안 셈)
  let run = 0, runAt = -1, stay = 0, stayAt = -1, stayImg = null, prev = null;
  while (w.performance.now() - t0 < Math.min(total, 15000)) {
    await new Promise((r) => w.setTimeout(r, 70));
    // 기 모으기 · 컷인 (번쩍 · 고리 · 이름 띠 — 모든 필살기 같음) 뒤 본편만
    if (w.performance.now() - t0 < cfg.lead) continue;
    // 걸침은 컷인 큰 이름 글씨 (ultTitle — 본편 시작 뒤 0.9초 남음 · UI 라 연출 아님) 가 끝난 뒤부터
    const cols = w.performance.now() - t0 < cfg.lead + 950 ? [] : cutCols(cfg.cutBand);
    const now = Math.round(w.performance.now() - t0);
    let same = false;
    if (cols.length >= cfg.cutMin && prev && prev.length >= cfg.cutMin) {
      const ps = new Set(prev);
      let both = 0;
      for (const x of cols) both += ps.has(x) || ps.has(x - 1) || ps.has(x + 1) ? 1 : 0;
      same = both >= Math.min(cols.length, prev.length) * 0.5;
    }
    prev = cols.length >= cfg.cutMin ? cols : null;
    if (cols.length >= cfg.cutMin) {
      if (!same) run = 0;
      if (run === 0) runAt = now;
      run += 1;
      const ms = now - runAt + 70;
      if (ms > stay) {
        stay = ms; stayAt = runAt;
        if (cfg.dump && ms >= cfg.stayMs && !stayImg) stayImg = [...d.querySelectorAll('canvas')].filter((c) => c.width > 100).map((c) => c.toDataURL('image/png'));
      }
    } else {
      run = 0;
    }
    const h = painted(top - cfg.band, top);
    peak = Math.max(peak, h);
    if (h < cfg.min) continue;
    const f = h / Math.max(1, h + painted(top, w.innerHeight));
    if (f > frac) {
      frac = f; most = h; at = Math.round(w.performance.now() - t0);
      if (cfg.dump) img = [...d.querySelectorAll('canvas')].filter((c) => c.width > 100).map((c) => c.toDataURL('image/png'));
    }
  }
  fx.clear();
  return { hid: Math.round(most), frac: +frac.toFixed(2), peak: Math.round(peak), at, total: Math.round(total), stay, stayAt, img, stayImg };
})(%FORM%, %IDX%, %CFG%)
"""


def worker(k, n, out, filt):
    ws, p, httpd = U.browser_page()
    res = {}
    try:
        keys = None
        for _ in range(60):
            r = ws.call("Runtime.evaluate", {"expression": PICK.replace("%FORMS%", json.dumps(U.FORMS)).replace("%SPECIAL%", json.dumps(SPECIAL)), "returnByValue": True})
            keys = r.get("result", {}).get("value")
            if isinstance(keys, dict) and keys:
                break
            time.sleep(0.5)
        # TOP_UNIQ=1 = 전용만 · TOP_UNIQ=0 = 일반만 (#107 — 고친 쪽만 다시 잴 때)
        only = os.environ.get("TOP_UNIQ")
        mine = [key for key in sorted(keys) if any(f in key for f in filt.split(',')) and (only is None or keys[key][2] == int(only))][k::n]
        for key in mine:
            form, idx, uniq, sig = keys[key]
            res[key] = {"uniq": uniq, "sig": sig}
            for name, (mx, fxx) in CFGS.items():
                cfg = json.dumps({"meX": mx, "foeX": fxx, "top": TOP_PX, "band": BAND_PX, "lead": U.CHARGE_MS + U.INTRO_MS, "min": HIDE_PX2, "dump": bool(os.environ.get("TOP_DUMP")), "real": bool(os.environ.get("TOP_REAL")), "joint": JOINT, "cutBand": CUT_BAND, "cutMin": CUT_MIN, "stayMs": STAY_MS})
                r = ws.call("Runtime.evaluate", {"expression": ONE.replace("%FORM%", json.dumps(form)).replace("%IDX%", str(idx)).replace("%CFG%", cfg).replace("%SPECIAL%", json.dumps(SPECIAL)), "awaitPromise": True, "returnByValue": True})
                v = r.get("result", {}).get("value")
                if v and v.get("stayImg") and os.environ.get("TOP_DUMP"):
                    import base64
                    os.makedirs(os.environ["TOP_DUMP"], exist_ok=True)
                    for ci, url in enumerate(v["stayImg"]):
                        open(os.path.join(os.environ["TOP_DUMP"], f"{form}_{idx}_{name}_stay_{ci}.png"), "wb").write(base64.b64decode(url.split(",", 1)[1]))
                if v:
                    v.pop("stayImg", None)
                if v and v.get("img") and os.environ.get("TOP_DUMP"):
                    import base64
                    os.makedirs(os.environ["TOP_DUMP"], exist_ok=True)
                    for ci, url in enumerate(v["img"]):
                        open(os.path.join(os.environ["TOP_DUMP"], f"{form}_{idx}_{name}_{ci}.png"), "wb").write(base64.b64decode(url.split(",", 1)[1]))
                if v:
                    v.pop("img", None)
                res[key][name] = v
            json.dump(res, open(out, "w", encoding="utf-8"), ensure_ascii=False)
    finally:
        json.dump(res, open(out, "w", encoding="utf-8"), ensure_ascii=False)
        U.kill_browser(p)
        httpd.shutdown()
        shutil.rmtree(getattr(U.browser_page, "prof", ""), ignore_errors=True)


def stay_of(row):
    """걸쳐 머묾 (ms) — 자리 둘 중 긴 것"""
    return max(((row.get(name) or {}).get("stay", 0) for name in CFGS), default=0)


def hid_of(row):
    """숨음 칸 — 1500px² 넘는 장면 중 가장 큰 비율 (자리 둘 중)"""
    return max(((row.get(name) or {}).get("frac", 0) for name in CFGS), default=0)


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--worker":
        worker(int(sys.argv[2]), int(sys.argv[3]), sys.argv[4], sys.argv[5] if len(sys.argv) > 5 else "")
        sys.exit(0)
    # 머리 없는 브라우저는 세션마다 2개까지 (game-dev-team 3장 정리 ④ · 2026-10-24 — 메모리 0.3 GB) · PG_MAX_BROWSERS 로만 늘림
    # --report <json> = 다시 돌리지 않고 저장된 결과로 셈 · --write-baseline = 이번 걸침으로 기준선을 다시 씀
    args = [a for a in sys.argv[1:] if a != "--write-baseline"]
    write_base = "--write-baseline" in sys.argv
    report = args[args.index("--report") + 1] if "--report" in args else None
    if report:
        args = [a for a in args if a not in ("--report", report)]
    t0 = time.time()
    if report:
        merged = json.load(open(report, encoding="utf-8"))
    else:
        n = min(int(args[0]) if args else 2, int(os.environ.get("PG_MAX_BROWSERS", 2)))
        filt = args[1] if len(args) > 1 else ""
        tmp = tempfile.mkdtemp()
        procs = [subprocess.Popen([sys.executable, __file__, "--worker", str(k), str(n), os.path.join(tmp, f"w{k}.json"), filt]) for k in range(n)]
        for q in procs:
            q.wait()
        merged = {}
        for k in range(n):
            f = os.path.join(tmp, f"w{k}.json")
            if os.path.exists(f):
                merged.update(json.load(open(f, encoding="utf-8")))
        shutil.rmtree(tmp, ignore_errors=True)
        os.makedirs(os.path.dirname(OUT), exist_ok=True)
        json.dump(dict(sorted(merged.items())), open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=0)
    sys.stdout.reconfigure(encoding="utf-8")
    why_of = lambda key, row: next((why for k, why in PASSING.items() if k in key), None) or next((why for ks, why in PASSING_SIG if all(k in str(row.get("sig", "")) for k in ks)), None)
    hit = lambda row: hid_of(row) >= HIDE_FRAC or stay_of(row) >= STAY_MS
    passing = {key: why_of(key, row) for key, row in merged.items() if hit(row) and why_of(key, row)}
    bad = [(key, row) for key, row in merged.items() if hit(row) and key not in passing]
    for key, row in sorted(bad, key=lambda kv: -hid_of(kv[1])):
        cells = " | ".join(f"{name} {(row.get(name) or {}).get('hid', '못 잼')}px² {round(100 * (row.get(name) or {}).get('frac', 0))}% @{(row.get(name) or {}).get('at', -1)}ms · 걸쳐 {(row.get(name) or {}).get('stay', 0)}ms @{(row.get(name) or {}).get('stayAt', -1)}" for name in CFGS)
        print(("전용 " if row.get("uniq") else "일반 ") + key, "|", cells)
    nu = sum(1 for r in merged.values() if r.get("uniq"))
    bu = sum(1 for _, r in bad if r.get("uniq"))
    # 못 잰 것 (연출이 0 을 돌려줌 · 평가 오류) 은 통과로 세지 않고 따로 (코드 리뷰어 #105)
    miss = sorted(key for key, row in merged.items() if any(row.get(name) is None for name in CFGS))
    for key in miss:
        print("못 잼", key)
    for key, why in sorted(passing.items()):
        print("지나감 (숨음으로 안 셈)", key, "—", why)
    print(f"{'합동 (o.track) · ' if JOINT else ''}전용 {nu} 중 숨음 · 걸침 {bu} · 일반 (틀 · 옵션 하나씩) {len(merged) - nu} 중 숨음 · 걸침 {len(bad) - bu} · 지나감 {len(passing)} · 못 잼 {len(miss)} · {time.time() - t0:.0f}초 → {os.path.relpath(OUT, ROOT)}")
    # 숨음 · 못 잼 · 기준선 밖의 새 걸침 = 실패 (npm run test:ult-top) · 기준선 걸침은 보고만 (#107 에서 0 까지 줄임)
    hidden = [key for key, row in bad if hid_of(row) >= HIDE_FRAC]
    stays = sorted(key for key, row in bad if hid_of(row) < HIDE_FRAC)
    mode = "joint" if JOINT else "solo"
    base_all = json.load(open(STAY_BASE, encoding="utf-8")) if os.path.exists(STAY_BASE) else {}
    if write_base:
        base_all[mode] = stays
        json.dump(base_all, open(STAY_BASE, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        print(f"기준선 다시 씀 ({mode}) {len(stays)} → {os.path.relpath(STAY_BASE, ROOT)}")
    base = set(base_all.get(mode, []))
    new = [k for k in stays if k not in base]
    fixed = sorted(k for k in base if k in merged and k not in stays)
    for k in new:
        print("새 걸침 (기준선 밖 — 실패)", k)
    print(f"실패 기준 (숨음 60%) {len(hidden)} · 걸쳐 머묾 {len(stays)} (기준선 {len(base)} · 새로 생김 {len(new)} · 기준선에서 고쳐짐 {len(fixed)}{' — --write-baseline 로 줄이기' if fixed else ''})")
    sys.exit(1 if miss or hidden or new else 0)
