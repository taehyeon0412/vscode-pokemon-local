#!/usr/bin/env python3
"""README 의 움직이는 장면(포스터 + GIF 링크)을 GitHub 비디오로 바꿈 — 멈춰 있다가 ▶ 를 누르면 그 자리에서 재생

  1. GitHub 새 이슈 작성 칸에 dist/videos 의 mp4 를 끌어다 놓기 (이슈는 등록 안 해도 됨)
  2. 작성 칸에 생긴 글을 통째로 복사해 파일로 저장 (예: urls.txt) — 또는 주소만 붙여도 됨
  3. python dev/set-videos.py urls.txt

GitHub 는 비디오 주소에 파일 이름을 안 남겨서, 주소마다 내려받아 dist/videos 의 mp4 와 내용(sha1)을 비교해 어떤 장면인지 맞춤.
이슈를 등록하기 전에는 올린 사람만 열 수 있어서(로그인 없이는 404) gh 로그인 토큰을 붙여 받음 — 토큰은 github.com 에만, 옮겨 가는 저장소(S3)엔 안 보냄.
GitHub 는 비디오 주소가 문단에 따로 있으면 플레이어로 보여 줌 — 표 칸 안이어도 됨(앞뒤 빈 줄), 그래서 필살기 6개는 2개씩 나란히.
"""
import hashlib
import io
import os
import re
import subprocess
import sys
import urllib.request

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VIDEOS = os.path.join(HERE, "dist", "videos")
README = os.path.join(HERE, "README.md")
ULTS = [
    ("ult-pikachu", "⚡ 피카츄 · 1000만볼트"),
    ("ult-venusaur", "🌿 이상해꽃 · 솔라빔"),
    ("ult-charizard", "🔥 리자몽 · 블래스트번"),
    ("ult-groudon", "🌋 그란돈 · 단애의칼"),
    ("ult-greninja", "🐸 개굴닌자 · 거대 물수리검"),
    ("ult-mew", "🌸 뮤 · 오리진즈슈퍼노바"),
]


def sha1(data):
    return hashlib.sha1(data).hexdigest()


def token():
    if os.environ.get("GITHUB_TOKEN"):
        return os.environ["GITHUB_TOKEN"]
    try:
        return subprocess.run(["gh", "auth", "token"], capture_output=True, text=True).stdout.strip()
    except OSError:
        return ""


def match(urls):
    local = {}
    for f in os.listdir(VIDEOS):
        if f.endswith(".mp4"):
            local[sha1(open(os.path.join(VIDEOS, f), "rb").read())] = f[:-4]
    tok = token()
    found = {}
    for u in urls:
        req = urllib.request.Request(u, headers={"User-Agent": "set-videos"})
        if tok:
            req.add_unredirected_header("Authorization", "token " + tok)  # 옮겨 간 주소로는 안 따라감
        with urllib.request.urlopen(req, timeout=60) as r:
            name = local.get(sha1(r.read()))
        print(("✓ " + name if name else "? 모르는 파일") + "  " + u)
        if name:
            found[name] = u
    return found


def main():
    text = open(sys.argv[1], encoding="utf-8").read() if len(sys.argv) > 1 else sys.stdin.read()
    urls = list(dict.fromkeys(re.findall(r"https://github\.com/user-attachments/assets/[0-9a-fA-F-]+", text)))
    if not urls:
        sys.exit("비디오 주소(https://github.com/user-attachments/assets/…)를 못 찾음")
    v = match(urls)
    s = open(README, encoding="utf-8", newline="").read()
    crlf = "\r\n" in s
    s = s.replace("\r\n", "\n")
    n = 0

    def sub(pattern, repl):
        nonlocal s, n
        s, k = re.subn(pattern, repl, s, flags=re.S)
        n += k

    if "demo" in v and v["demo"] not in s:
        # 가운데 블록 밖으로 — 비디오 주소는 한 줄에 따로
        sub(r'<a href="docs/demo\.gif">.*?</a>\n\n<sub>그림 오른쪽 위.*?</sub>\n\n', "")
        sub(r"(\*\*\[🕹️ 놀기\]\(#play\).*?\*\*\n\n</div>\n)", r"\1\n" + v["demo"] + "\n")
    if all(k in v for k, _ in ULTS):

        def cell(k, title):
            return f'<td width="50%" align="center">\n\n**{title}**\n\n{v[k]}\n\n</td>'

        rows = [f"<tr>\n{cell(*ULTS[i])}\n{cell(*ULTS[i + 1])}\n</tr>" for i in range(0, len(ULTS), 2)]
        block = "<table>\n" + "\n".join(rows) + "\n</table>\n"
        # GIF 표든 이미 바꾼 비디오든, 설명 줄과 다음 제목 사이를 통째로 — 다시 돌려도 됨
        sub(r"(기운이 차오르다가 필살기가 나가요\.\n\n).*?(?=\n### 이렇게 나가요)", lambda m: m.group(1) + block)
    for k in ("duel", "clash"):
        if k in v:
            sub(rf'<p align="center"><a href="docs/{k}\.gif">.*?</a></p>', v[k])
    open(README, "w", encoding="utf-8", newline="").write(s.replace("\n", "\r\n") if crlf else s)
    print(f"README 에서 {n}곳을 비디오로 바꿈 — 맞춘 장면: {', '.join(sorted(v))}")


if __name__ == "__main__":
    main()
