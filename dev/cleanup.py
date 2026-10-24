"""남은 리소스 한눈에 보기 · 내 팀 것만 끄기 (#109 — 2026-10-24 태현 님 "필요없는 리소스 다 정리하게 해줘 … 컴퓨터가 터질뻔했어")
  python dev/cleanup.py              남은 메모리 · CPU · 머리 없는 브라우저 (임시 프로필 묶음마다 팀 · 개수 · 메모리) · 이 저장소의 node · python · 남은 임시 프로필 폴더
  python dev/cleanup.py --mine dev   그 팀의 부모 잃은 머리 없는 브라우저 (띄운 도구가 끝났는데 남은 것 — 임시 프로필 이름 pg-<팀>-) 만 PID 로 끔 + 5분 넘게 안 쓴 임시 프로필 폴더 (pg-<팀>- · 이름 붙이기 전 tmp*) 지움
  python dev/cleanup.py --mine dev --force   + 살아 있는 그 팀 브라우저 · 명령줄에 그 워크트리 경로가 든 node · python 도 (같은 팀 다른 직원 · 리드의 캡처까지 끄니 다 끝난 뒤에만)
  팀 = game-shots team() (PG_TEAM > PG_ROOT 워크트리 이름 > main). 이름으로 끄지 않음 (다른 python) · node · python 은 나무째 (/T) 안 끔 · 이 명령을 띄운 쪽 (조상) 은 건드리지 않음"""
import glob
import io
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REPO = ROOT.replace("\\", "/").split("/.claude/worktrees/")[0].lower()
LOW_GB, HIGH_CPU = 4.0, 90  # game-dev-team.md 3장 정리 ⑤
BROWSERS = ("msedge.exe", "chrome.exe")
SCRIPTS = ("node.exe", "python.exe", "pythonw.exe")

PS = r"""
[Console]::OutputEncoding = [Text.Encoding]::UTF8
$o = Get-CimInstance Win32_OperatingSystem
$c = (Get-CimInstance Win32_Processor | Measure-Object -Property LoadPercentage -Average).Average
$want = @('msedge.exe', 'chrome.exe', 'node.exe', 'python.exe', 'pythonw.exe')
$ps = Get-CimInstance Win32_Process | ForEach-Object {
  $w = $want -contains $_.Name.ToLower()
  [pscustomobject]@{ pid = $_.ProcessId; ppid = $_.ParentProcessId; name = $_.Name.ToLower()
    cmd = $(if ($w) { $_.CommandLine } else { '' }); ws = $(if ($w) { $_.WorkingSetSize } else { 0 })
    start = $(if ($w -and $_.CreationDate) { $_.CreationDate.ToString('HH:mm:ss') } else { '' }) } }
[pscustomobject]@{ free = $o.FreePhysicalMemory; total = $o.TotalVisibleMemorySize; cpu = $c; procs = @($ps) } | ConvertTo-Json -Depth 3 -Compress
"""


def snapshot():
    r = subprocess.run(["powershell", "-NoProfile", "-Command", PS], capture_output=True)
    return json.loads(r.stdout.decode("utf-8", errors="replace"))


def norm(s):
    return (s or "").replace("\\", "/").lower()


def ancestors(procs):
    """이 명령을 띄운 쪽 (bash · Claude 세션 · VS Code) — 끄지 않음"""
    par = {p["pid"]: p["ppid"] for p in procs}
    out, k = set(), os.getpid()
    while k and k not in out:
        out.add(k)
        k = par.get(k)
    return out


def profile_of(cmd):
    m = re.search(r'--user-data-dir=(?:"([^"]+)"|(\S+))', cmd or "")
    return (m.group(1) or m.group(2)) if m else None


def team_of_profile(prof):
    # pg-<팀>-<임시 8자> (tempfile) — 팀 이름에 하이픈이 있어도 (dev-2) 앞 팀 (dev) 으로 읽지 않게 (#96 코드 리뷰 낮음 4)
    b = os.path.basename(prof.rstrip("\\/"))
    m = re.match(r"^pg-(.+)-[a-z0-9_]{8}$", b)
    return m.group(1) if m else "모름"


def team_of_cmd(cmd):
    # 저장소 경로 + "/" 로 끊어 봄 — 이름이 비슷한 다른 폴더 (vscode-pokemon-local-…) 를 main 으로 잡지 않게 (#96 코드 리뷰 낮음 4)
    c = norm(cmd)
    m = re.search(r"/\.claude/worktrees/([\w-]+)/", c)
    if m:
        return m.group(1)
    return "main" if REPO and REPO + "/" in c else None


def browsers(procs):
    """머리 없는 브라우저 — 임시 프로필 (--user-data-dir) 하나 = 한 묶음 (본 프로세스 + 자식)"""
    groups = {}
    for p in procs:
        if p["name"] not in BROWSERS:
            continue
        prof = profile_of(p["cmd"])
        if prof:
            groups.setdefault(prof, []).append(p)
    alive = {p["pid"] for p in procs}
    out = []
    for prof, ps in groups.items():
        if not any("--headless" in (p["cmd"] or "") for p in ps):
            continue
        main = next((p for p in ps if "--type=" not in (p["cmd"] or "")), ps[0])
        out.append({"prof": prof, "team": team_of_profile(prof), "procs": ps, "main": main,
                    "mb": sum(p["ws"] or 0 for p in ps) / 2**20, "orphan": main["ppid"] not in alive})
    return sorted(out, key=lambda g: g["main"]["start"])


def scripts(procs, skip):
    # 명령줄의 워크트리 경로로만 팀을 셈 — 브라우저 부모 번호로 붙이면 부모가 끝난 뒤 그 번호를 받은 남의 python 을 잡을 수 있어 뺌 (#96 코드 리뷰 높음 2)
    out = []
    for p in procs:
        if p["name"] not in SCRIPTS or p["pid"] in skip or "cleanup.py" in (p["cmd"] or ""):
            continue
        t = team_of_cmd(p["cmd"])
        if t:
            out.append({**p, "team": t, "mb": (p["ws"] or 0) / 2**20})
    return out


def used_profiles(procs):
    return {norm(profile_of(p["cmd"])) for p in procs if p["name"] in BROWSERS and profile_of(p["cmd"])}


def leftover_profiles(procs, min_age=0):
    """%TEMP% 에 남은 브라우저 임시 프로필 (pg-<팀>- · 이름 붙이기 전 tmp*) 중 지금 아무 브라우저도 안 쓰는 것 — [(폴더, 팀, MB)] ·
    쓰는지는 폴더 이름으로 봄 (TEMP 가 짧은 이름 · 긴 이름으로 달라도) · min_age 초보다 오래된 것만 (막 만든 폴더를 지우지 않게 — #96 코드 리뷰 낮음 4)"""
    used = {os.path.basename(u.rstrip("/")) for u in used_profiles(procs)}
    out = []
    for d in glob.glob(os.path.join(tempfile.gettempdir(), "pg-*-*")) + glob.glob(os.path.join(tempfile.gettempdir(), "tmp*")):
        if not os.path.isdir(d) or os.path.basename(d).lower() in used:
            continue
        if not (os.path.exists(os.path.join(d, "Local State")) or os.path.isdir(os.path.join(d, "Default"))):
            continue
        try:
            if time.time() - os.path.getmtime(d) < min_age:
                continue
        except OSError:
            continue
        size = 0
        for base, _, files in os.walk(d):
            for f in files:
                try:
                    size += os.path.getsize(os.path.join(base, f))
                except OSError:
                    pass
        out.append((d, team_of_profile(d), size / 2**20))
    return out


def show(snap):
    procs = snap["procs"]
    free, total = snap["free"] / 2**20, snap["total"] / 2**20
    warn = []
    if free < LOW_GB:
        warn.append(f"남은 메모리 {LOW_GB:.0f} GB 아래")
    if (snap["cpu"] or 0) > HIGH_CPU:
        warn.append(f"CPU {HIGH_CPU}% 넘음")
    print(f"남은 메모리 {free:.1f} / {total:.1f} GB · CPU {snap['cpu'] or 0:.0f}%" + (f"  ⚠ {' · '.join(warn)} — 새 캡처 · 직원 말고 정리부터" if warn else ""))
    bs = browsers(procs)
    print(f"머리 없는 브라우저 {len(bs)}묶음 (프로세스 {sum(len(g['procs']) for g in bs)} · {sum(g['mb'] for g in bs) / 1024:.1f} GB)")
    for g in bs:
        print(f"  {g['team']:<7} {os.path.basename(g['prof'].rstrip(chr(92) + '/')):<26} {len(g['procs']):>3}개 {g['mb']:>6.0f} MB  {g['main']['start']}  pid {g['main']['pid']}" + ("  부모 없음" if g["orphan"] else ""))
    ss = scripts(procs, ancestors(procs))
    print(f"이 저장소의 node · python {len(ss)}")
    for p in ss:
        print(f"  {p['team']:<7} {p['pid']:>6} {p['name']:<11} {p['mb']:>6.0f} MB  {p['start']}  {(p['cmd'] or '')[:110]}")
    lp = leftover_profiles(procs)
    teams = {}
    for _, t, mb in lp:
        teams[t] = teams.get(t, 0) + mb
    print(f"남은 임시 프로필 폴더 {len(lp)} ({sum(teams.values()) / 1024:.1f} GB" + "".join(f" · {t} {mb / 1024:.1f}" for t, mb in sorted(teams.items())) + ")" + (" — --mine 때 지움 (모름 = 이름 붙이기 전 tmp*)" if lp else ""))
    return bs, ss


def kill(pid, tree=True):
    subprocess.run(["taskkill", "/PID", str(pid), *(["/T"] if tree else []), "/F"], capture_output=True)


def mine(team, force=False):
    """기본 = 그 팀의 부모 잃은 브라우저 (띄운 도구가 끝났는데 남은 것) · force = 살아 있는 브라우저 · node · python 도 (같은 팀 다른 직원 캡처를 도중에 끄지 않게 — #96 코드 리뷰 중간 1)"""
    snap = snapshot()
    procs = snap["procs"]
    skip = ancestors(procs)
    nb = npk = nd = 0
    for g in browsers(procs):
        if g["team"] != team or not (force or g["orphan"]):
            continue
        for p in g["procs"]:
            if p["pid"] not in skip:
                kill(p["pid"])
        nb += 1
        npk += len(g["procs"])
    ns = 0
    if force:
        for p in scripts(procs, skip):
            if p["team"] == team:
                # 나무째 끄지 않음 — 그 아래 남의 프로세스까지 끌 수 있어서 (#96 코드 리뷰 높음 2)
                kill(p["pid"], tree=False)
                ns += 1
    time.sleep(0.5)
    # 남은 임시 프로필 폴더 — 내 팀 것 + 이름 붙이기 전 tmp* (아무 브라우저도 안 쓰고 5분 넘은 것만)
    for d, t, _ in leftover_profiles(snapshot()["procs"], min_age=300):
        if t in (team, "모름"):
            shutil.rmtree(d, ignore_errors=True)
            nd += 0 if os.path.exists(d) else 1
    print(f"끔 ({team}{' · force' if force else ''}): 브라우저 {nb}묶음 (프로세스 {npk}) · node · python {ns} · 임시 폴더 {nd}")
    snap = snapshot()
    bs, ss = show(snap)
    orphans = sum(1 for g in bs if g["team"] == team and g["orphan"])
    live = sum(1 for g in bs if g["team"] == team and not g["orphan"]) + sum(1 for p in ss if p["team"] == team)
    left = orphans + (live if force else 0)
    if live and not force:
        print(f"살아 있는 {team} 것 {live}개는 그대로 (캡처 · 직원이 쓰는 중 — 다 끝났으면 --force)")
    print(("정리 ✓" if left == 0 else f"정리 덜 됨 — {team} 것 {left}개 남음") + f" · 남은 메모리 {snap['free'] / 2**20:.1f} GB")
    return left


if __name__ == "__main__":
    if "--mine" in sys.argv:
        i = sys.argv.index("--mine")
        if i + 1 >= len(sys.argv) or sys.argv[i + 1].startswith("--"):
            sys.exit("--mine <팀> [--force] (dev · design · main)")
        sys.exit(1 if mine(sys.argv[i + 1], force="--force" in sys.argv) else 0)
    show(snapshot())
