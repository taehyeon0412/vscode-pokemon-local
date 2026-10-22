#!/usr/bin/env python3
"""팀 워크트리 준비 · 확인 · 지우기 (2026-10-22 태현 님 — 워크트리로 나눠 고치고 주제마다 squash 로 합침, docs/game-design/collab-worktree.md)

  python dev/worktree-setup.py <팀>                워크트리 만들기 (없으면) + 같이 쓰는 것 잇기 + npm ci (없으면) + 확인 ① ~ ⑦
  python dev/worktree-setup.py <팀> --check        잇기만 다시 보고 끊어진 것 다시 이음 (주제를 시작할 때마다 — 고쳐 쓴 규칙 파일)
  python dev/worktree-setup.py <팀> --remove       정션을 먼저 풀고 워크트리를 지움 (주제 브랜치는 그대로)
  python dev/worktree-setup.py --hook              세션 시작 (SessionStart hook) — main · 모든 팀 워크트리의 하드 링크를 조용히 다시 이음 (늘 0 으로 끝남)

<팀> = dev · design (폴더 .claude/worktrees/<팀>). 처음 만들 때 브랜치는 wt/<팀> (main 에서) — 주제는 그 안에서 git switch -c topic/<팀>-<번호> main.
같이 쓰는 것 (한 벌만):
  - 정션 (디렉터리): docs/game-design · .claude/agents · .vscode-test
  - 하드 링크 (파일): docs/game-dev-team.md · docs/game-art-director.md · docs/game-design-partner.md — 워크트리 CLAUDE.md 의 @ 가리킴이 본문으로 실리게
  - 하드 링크 docs/ux-rules.md → docs/game-design/ux-rules.md (main 에도 — 정션 안 파일을 @ 로 가리키면 "프로젝트 밖" 이라 허락 창이 떠서, CLAUDE.md 는 docs/ux-rules.md 를 가리킴)
    하드 링크는 이름을 바꿔 저장하는 편집기 (Claude 의 Edit · Write 도) 가 끊음 → 원본 (main 의 docs/ · docs/game-design/) 만 고치고, --check · --hook 이 다시 이음
    (링크 쪽이 원본보다 새로 고쳐져 내용이 다르면 버리지 않고 docs/game-design/.orphans/ 에 남김)
워크트리마다 따로: node_modules (npm ci) · 빌드 결과 (extension/media/game · out/game · .test-out · dev/shots · dev/build).
지우기는 꼭 이 스크립트로 — 정션을 안 풀고 지우면 정션 너머 (main 폴더의 기록 · 직원) 까지 지울 수 있음.
"""
import io
import os
import subprocess
import sys

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

JUNCTIONS = ["docs/game-design", ".claude/agents", ".vscode-test"]
HARDLINKS = ["docs/game-dev-team.md", "docs/game-art-director.md", "docs/game-design-partner.md"]
# (링크, 원본) — 원본이 정션 안이라 main 폴더에도 링크를 둠 (CLAUDE.md 의 @docs/ux-rules.md — 기획 부탁 10-22)
MAIN_LINKS = [("docs/ux-rules.md", "docs/game-design/ux-rules.md")]
TEAMS = ("dev", "design")


def run(args, cwd, check=True):
    r = subprocess.run(args, cwd=cwd, capture_output=True, text=True, encoding="utf-8", errors="replace")
    if check and r.returncode != 0:
        sys.exit(f"실패: {' '.join(args)}\n{r.stdout}{r.stderr}")
    return r


def main_root():
    """main 폴더 (워크트리 안에서 불러도) — git 공용 폴더의 부모"""
    here = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    common = run(["git", "rev-parse", "--path-format=absolute", "--git-common-dir"], here).stdout.strip()
    return os.path.dirname(os.path.normpath(common))


def win(p):
    return os.path.normpath(p)


def is_junction(p):
    try:
        return os.path.isdir(p) and os.readlink(p) is not None
    except OSError:
        return False


def hardlink(root, src, dst, rel):
    """dst 를 src 의 하드 링크로 — 이미 같은 파일이면 None · 이었으면 알림 한 줄"""
    src, dst = win(src), win(dst)
    note = f"  하드 링크 이음: {rel}"
    if os.path.exists(dst):
        if os.path.samefile(src, dst):
            return None
        # 끊어진 링크 — main 쪽 원본이 기준. 링크 쪽을 원본보다 나중에 고쳤으면 (규칙 위반이지만) 버리지 않고 남김
        if os.path.getmtime(dst) > os.path.getmtime(src) and open(dst, "rb").read() != open(src, "rb").read():
            keep = os.path.join(root, "docs", "game-design", ".orphans")
            os.makedirs(keep, exist_ok=True)
            bak = os.path.join(keep, f"{os.path.basename(dst)}.{int(os.path.getmtime(dst))}")
            os.replace(dst, bak)
            note = f"  끊어진 하드 링크 다시 (링크 쪽이 더 새로 고쳐져 있어 남김: {bak}): {rel}"
        else:
            os.remove(dst)
            note = f"  끊어진 하드 링크 다시: {rel}"
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    run(["cmd", "/c", "mklink", "/H", dst, src], os.path.dirname(dst))
    return note


def link_main(root):
    """main 폴더 자신의 하드 링크 (docs/ux-rules.md)"""
    out = []
    for rel, src in MAIN_LINKS:
        if os.path.exists(os.path.join(root, src)):
            n = hardlink(root, os.path.join(root, src), os.path.join(root, rel), f"main {rel}")
            if n:
                out.append(n)
    return out


def link_all(root, wt):
    """정션 · 하드 링크 — 없거나 끊어졌으면 (다른 파일) 다시"""
    out = link_main(root)
    for rel in JUNCTIONS:
        src, dst = win(os.path.join(root, rel)), win(os.path.join(wt, rel))
        if not os.path.exists(src):
            out.append(f"  정션 건너뜀 (main 에 없음): {rel}")
            continue
        if is_junction(dst) and os.path.samefile(src, dst):
            continue
        if os.path.exists(dst):
            sys.exit(f"정션 자리에 다른 것이 있음 — 손으로 확인: {dst}")
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        run(["cmd", "/c", "mklink", "/J", dst, src], wt)
        out.append(f"  정션 이음: {rel}")
    for rel, srel in [(r, r) for r in HARDLINKS] + MAIN_LINKS:
        src = os.path.join(root, srel)
        if not os.path.exists(src):
            out.append(f"  하드 링크 건너뜀 (main 에 없음): {srel}")
            continue
        n = hardlink(root, src, os.path.join(wt, rel), rel)
        if n:
            out.append(n)
    return out


def checks(root, wt):
    """확인 ① ~ ⑦ (자동으로 볼 수 있는 것) — 세션이 기억 · 지시를 읽는지는 claude -p 로 따로 (collab-worktree.md 8장)"""
    res = []
    pairs = [(r, r) for r in HARDLINKS] + MAIN_LINKS
    ok = all(os.path.exists(os.path.join(wt, r)) and os.path.samefile(os.path.join(root, s), os.path.join(wt, r)) for r, s in pairs if os.path.exists(os.path.join(root, s)))
    ok = ok and all(os.path.exists(os.path.join(root, r)) and os.path.samefile(os.path.join(root, s), os.path.join(root, r)) for r, s in MAIN_LINKS if os.path.exists(os.path.join(root, s)))
    res.append(("① 규칙 파일 4 (하드 링크 — main 과 같은 파일 · ux-rules 는 main 에도)", ok))
    agents = os.path.join(wt, ".claude", "agents")
    res.append(("③ 직원 (.claude/agents 정션)", os.path.isdir(agents) and len([f for f in os.listdir(agents) if f.endswith(".md")]) >= 7))
    gd = os.path.join(wt, "docs", "game-design")
    res.append(("④ docs/game-design (정션 — main 과 같은 폴더)", os.path.isdir(gd) and os.path.samefile(gd, os.path.join(root, "docs", "game-design"))))
    res.append(("⑤ node_modules (워크트리 따로)", os.path.isdir(os.path.join(wt, "node_modules")) and not is_junction(os.path.join(wt, "node_modules"))))
    st = run(["git", "status", "--porcelain"], root).stdout
    res.append(("⑦ main 폴더 git status 에 워크트리가 안 나옴", ".claude/worktrees" not in st))
    return res


def setup(team, only_check):
    root = main_root()
    wt = os.path.join(root, ".claude", "worktrees", team)
    lines = []
    if not os.path.isdir(wt):
        if only_check:
            sys.exit(f"워크트리가 없음: {wt} — 먼저 python dev/worktree-setup.py {team}")
        branch = f"wt/{team}"
        has = run(["git", "rev-parse", "--verify", "--quiet", f"refs/heads/{branch}"], root, check=False).returncode == 0
        run(["git", "worktree", "add", wt, branch] if has else ["git", "worktree", "add", "-b", branch, wt, "main"], root)
        lines.append(f"  워크트리 만듦: {wt} ({branch})")
    lines += link_all(root, wt)
    if not only_check and not os.path.isdir(os.path.join(wt, "node_modules")):
        # 윈도우는 npm.cmd (그냥 npm 은 찾지 못함)
        run(["npm.cmd" if os.name == "nt" else "npm", "ci", "--no-audit", "--no-fund"], wt)
        lines.append("  npm ci")
    print(f"워크트리 {team}: {wt}")
    print("\n".join(lines) if lines else "  바뀐 것 없음")
    bad = 0
    for name, ok in checks(root, wt):
        print(f"  {'통과' if ok else '걸림'} {name}")
        bad += 0 if ok else 1
    print("  알림: ⑥ 동시 캡처는 빈 포트 (dev/*.py)")
    sys.exit(1 if bad else 0)


def hook():
    """세션 시작 — main · 있는 팀 워크트리의 하드 링크만 다시 (정션 · npm 은 안 건드림). 바뀐 것이 있을 때만 한 줄 · 실패해도 세션을 막지 않음"""
    try:
        root = main_root()
        out = link_main(root)
        for team in TEAMS:
            wt = os.path.join(root, ".claude", "worktrees", team)
            if not os.path.isdir(wt):
                continue
            for rel, srel in [(r, r) for r in HARDLINKS] + MAIN_LINKS:
                src = os.path.join(root, srel)
                if os.path.exists(src):
                    n = hardlink(root, src, os.path.join(wt, rel), f"{team} {rel}")
                    if n:
                        out.append(n)
        if out:
            print("규칙 파일 하드 링크를 다시 이음 (worktree-setup --hook):\n" + "\n".join(out))
    except (OSError, SystemExit) as e:
        print(f"worktree-setup --hook 건너뜀: {e}")
    sys.exit(0)


def remove(team):
    root = main_root()
    wt = os.path.join(root, ".claude", "worktrees", team)
    if not os.path.isdir(wt):
        sys.exit(f"워크트리가 없음: {wt}")
    # 정션을 먼저 풀어야 지우기가 정션 너머 (main 의 기록 · 직원) 를 안 건드림 — rmdir 은 정션만 지움
    for rel in JUNCTIONS:
        dst = win(os.path.join(wt, rel))
        if is_junction(dst):
            run(["cmd", "/c", "rmdir", dst], wt)
            print(f"  정션 풂: {rel}")
    # 하드 링크는 지워도 main 파일은 그대로 (링크 수만 줄어듦)
    run(["git", "worktree", "remove", "--force", wt], root)
    print(f"워크트리 지움: {wt} (브랜치는 그대로 — 지우려면 git branch -D)")


if __name__ == "__main__":
    a = sys.argv[1:]
    if a[:1] == ["--hook"]:
        hook()
    if not a or a[0] not in TEAMS:
        sys.exit(__doc__)
    if "--remove" in a:
        remove(a[0])
    else:
        setup(a[0], "--check" in a)
