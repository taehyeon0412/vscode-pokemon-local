"""실제 VS Code 캡처 (기획 R17 — 확인 묶음 끝에 실제 VS Code 한 벌).

시험 창 (dev/game-host.js) 이 아니라 진짜 VS Code (.vscode-test 에 받아 둔 것) 를 따로 띄워 — 진짜 글꼴 · 테마 · 웹뷰 CSS · 패널 테두리 —
세이브를 넣고 게임에 들어간 뒤 패널 너비마다 창 전체를 찍는다. 개발 PC 의 VS Code 설정 · 확장 · 세이브와 섞이지 않음 (임시 사용자 폴더).

    python dev/vscode-shot.py <폴더> [h=187] [w=480,860,1860] [theme=dark|light|both] [save=<세이브.json>] [import=<세이브.json>] [wait=3000] [version=stable] [nobuild=1]

  h       웹뷰 높이 (px) — 패널을 최대화하고 창 높이로 맞춤 (웹뷰가 알린 크기로 px 까지). VS Code 창 최소 높이 때문에 약 175 아래는 못 맞춤 → 그때는 맞춘 크기를 알림
  w       웹뷰 너비 (px) 들 — 창 너비로 맞춤 (옆 칸을 닫음). 창 최소 너비 때문에 약 340 아래는 못 맞춤 → 건너뜀
          (아래 패널은 VS Code 에서 약 290 보다 좁아지지 않음 — 2026-10-22 1.143 에서 잼. 240 같은 좁은 폭은 시험 창 game-shots.py 로)
  theme   dark · light · both (Default Dark Modern / Default Light Modern)
  save    넣을 세이브 (없으면 새 스타팅) — 전투 장면은 pendingEncounter 가 있는 세이브로
  import  이 세이브로 "불러오기" 를 눌러 확인 상자를 띄운 채 찍음 (파일 창 대신 — orders #50)
  wait    게임에 들어간 뒤 찍기 전까지 ms
결과: <폴더>/<theme>_<w>x<h>.png — 창 전체 (패널을 최대화해서 거의 게임 화면 · 제목 줄 · 패널 탭 · 상태 줄 포함).

웹뷰 묶음 (extension/media/game) 은 지금 있는 그대로 씀 (도구는 확장 쪽 · 테스트 묶음만 다시 묶음 — 다른 세션의 시험 창 캡처를 깨지 않게) → 고친 화면을 보려면 install.py 를 먼저.
주의: 진짜 VS Code 창이 화면에 뜬다 (찍는 동안 몇 초) — 다른 창이 위를 덮어도 찍히지만 (PrintWindow) 창을 최소화하면 웹뷰가 멈춰 안 찍힘.
프로세스는 이 도구가 띄운 것만 PID 로 끈다.
"""
import ctypes
import ctypes.wintypes as wt
import json
import os
import shutil
import subprocess
import sys
import tempfile
import time

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MIN_W = 340  # 창 최소 너비 (400) − 활동 막대 · 테두리 — 아래 패널 웹뷰의 가장 좁은 폭 (잼)
THEMES = {'dark': 'Default Dark Modern', 'light': 'Default Light Modern'}

# 윈도우 콘솔 (cp949) 에서 "—" 같은 글자로 멈추지 않게
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

user32 = ctypes.windll.user32
gdi32 = ctypes.windll.gdi32
try:
    ctypes.windll.shcore.SetProcessDpiAwareness(2)
except Exception:
    pass


def args():
    out = {'h': '187', 'w': '480,860,1860', 'theme': 'dark', 'save': '', 'wait': '3000', 'version': 'stable', 'nobuild': '', 'import': ''}
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    for a in sys.argv[2:]:
        k, _, v = a.partition('=')
        if k not in out:
            sys.exit(f'모르는 매개변수: {k}\n{__doc__}')
        out[k] = v
    return sys.argv[1], out


def find_window(title_part, timeout=60):
    """제목에 title_part (이번에 정한 임의 작업 폴더 이름) 가 들어간 보이는 창"""
    end = time.time() + timeout
    found = []
    proto = ctypes.WINFUNCTYPE(ctypes.c_bool, wt.HWND, wt.LPARAM)

    def cb(hwnd, _):
        if not user32.IsWindowVisible(hwnd):
            return True
        n = user32.GetWindowTextLengthW(hwnd)
        if n == 0:
            return True
        buf = ctypes.create_unicode_buffer(n + 1)
        user32.GetWindowTextW(hwnd, buf, n + 1)
        if title_part in buf.value:
            found.append(hwnd)
        return True

    while time.time() < end:
        found.clear()
        user32.EnumWindows(proto(cb), 0)
        if found:
            return found[0]
        time.sleep(0.5)
    return None


def capture(hwnd):
    """창 전체 (가려져 있어도 — PrintWindow PW_RENDERFULLCONTENT)"""
    r = wt.RECT()
    user32.GetWindowRect(hwnd, ctypes.byref(r))
    w, h = r.right - r.left, r.bottom - r.top
    hdc = user32.GetWindowDC(hwnd)
    mdc = gdi32.CreateCompatibleDC(hdc)
    bmp = gdi32.CreateCompatibleBitmap(hdc, w, h)
    gdi32.SelectObject(mdc, bmp)
    user32.PrintWindow(hwnd, mdc, 2)

    class BMIH(ctypes.Structure):
        _fields_ = [('biSize', wt.DWORD), ('biWidth', wt.LONG), ('biHeight', wt.LONG), ('biPlanes', wt.WORD), ('biBitCount', wt.WORD), ('biCompression', wt.DWORD),
                    ('biSizeImage', wt.DWORD), ('biXPelsPerMeter', wt.LONG), ('biYPelsPerMeter', wt.LONG), ('biClrUsed', wt.DWORD), ('biClrImportant', wt.DWORD)]
    bi = BMIH()
    bi.biSize = ctypes.sizeof(BMIH)
    bi.biWidth, bi.biHeight, bi.biPlanes, bi.biBitCount = w, -h, 1, 32
    buf = ctypes.create_string_buffer(w * h * 4)
    gdi32.GetDIBits(mdc, bmp, 0, h, buf, ctypes.byref(bi), 0)
    gdi32.DeleteObject(bmp)
    gdi32.DeleteDC(mdc)
    user32.ReleaseDC(hwnd, hdc)
    return Image.frombuffer('RGBA', (w, h), buf, 'raw', 'BGRA', 0, 1).convert('RGB')


def user_dir(theme):
    """임시 사용자 폴더 — 설정 (테마 · 시작 화면 · 알림 · 상태 줄 없음)"""
    d = tempfile.mkdtemp(prefix='pokemon-shot-user-')
    os.makedirs(os.path.join(d, 'User'))
    settings = {
        'workbench.colorTheme': THEMES[theme],
        'workbench.startupEditor': 'none',
        'workbench.tips.enabled': False,
        'workbench.enableExperiments': False,
        'window.restoreWindows': 'none',
        'window.zoomLevel': 0,
        'update.mode': 'none',
        'telemetry.telemetryLevel': 'off',
        'extensions.ignoreRecommendations': True,
        'chat.commandCenter.enabled': False,
        'workbench.secondarySideBar.defaultVisibility': 'hidden',
    }
    with open(os.path.join(d, 'User', 'settings.json'), 'w', encoding='utf-8') as f:
        json.dump(settings, f, ensure_ascii=False, indent=2)
    return d


def read_view(talk):
    try:
        # 반쯤 쓴 파일 · 쓰는 중 잠금이면 다음에 (파일을 바로 닫음 — 잡고 있으면 VS Code 쪽 쓰기가 막힘)
        with open(os.path.join(talk, 'view.json'), encoding='utf-8') as f:
            v = json.load(f)
        return (v['w'], v['h']) if v else None
    except Exception:
        return None


def fit(hwnd, talk, w, h):
    """창 크기를 바꿔 웹뷰를 w × h 로 — 패널이 최대화돼 있어 창 높이 = 패널 높이 (웹뷰가 알린 크기로 차이를 줄임, 최대 8번)"""
    r = wt.RECT()
    user32.GetWindowRect(hwnd, ctypes.byref(r))
    win_w, win_h = r.right - r.left, r.bottom - r.top
    got = None
    for _ in range(8):
        sw, sh = user32.GetSystemMetrics(0), user32.GetSystemMetrics(1)
        x, y = max(0, min(r.left, sw - win_w)), max(0, min(r.top, sh - win_h - 40))
        user32.ShowWindow(hwnd, 9)  # 최소화 · 최대화를 풂
        user32.SetWindowPos(hwnd, 0, x, y, win_w, win_h, 0x0004 | 0x0010)
        time.sleep(0.9)
        got = read_view(talk)
        if not got:
            continue
        dw, dh = w - got[0], h - got[1]
        if dw == 0 and dh == 0:
            break
        win_w, win_h = win_w + dw, win_h + dh
    return got


def shoot(out, theme, h, widths, o):
    talk = tempfile.mkdtemp(prefix='pokemon-shot-talk-')
    user = user_dir(theme)
    # 작업 폴더 이름 = 창 제목 — 임의 글자로 (지난번에 남은 창 · 같은 이름 탐색기 창을 잡지 않게)
    name_tag = 'pokemon-shot-' + os.urandom(4).hex()
    hwnd, code_pid = None, None
    env = dict(os.environ, SHOT_DIR=talk, SHOT_USER_DIR=user, SHOT_SAVE=os.path.abspath(o['save']) if o['save'] else '', SHOT_IMPORT=os.path.abspath(o['import']) if o['import'] else '', SHOT_WAIT_MS=o['wait'], SHOT_VERSION=o['version'], SHOT_NAME=name_tag)
    env.pop('ELECTRON_RUN_AS_NODE', None)
    proc = subprocess.Popen(['node', os.path.join(ROOT, '.test-out', 'run-shot.cjs')], cwd=ROOT, env=env)
    try:
        ready = os.path.join(talk, 'ready.json')
        end = time.time() + 180
        while not os.path.exists(ready):
            if proc.poll() is not None:
                sys.exit(f'VS Code 가 찍기 전에 끝남 (코드 {proc.returncode})')
            if time.time() > end:
                sys.exit('3분을 기다려도 게임에 못 들어감')
            time.sleep(0.5)
        with open(ready, encoding='utf-8') as f:
            info = json.load(f)
        hwnd = find_window(name_tag)
        if not hwnd:
            sys.exit(f'VS Code 창을 못 찾음 (제목 {name_tag})')
        pid = wt.DWORD()
        user32.GetWindowThreadProcessId(hwnd, ctypes.byref(pid))
        code_pid = pid.value
        for w in widths:
            got = fit(hwnd, talk, w, h)
            time.sleep(1.2)
            img = capture(hwnd)
            name = f'{theme}_{w}x{h}'
            img.save(os.path.join(out, name + '.png'))
            note = '' if got == (w, h) else f' (맞추지 못함 — 웹뷰 {got[0]}x{got[1]}, 창 최소 크기 등)' if got else ' (웹뷰 크기를 못 받음)'
            print(f'찍음 {name} — 창 {img.width}x{img.height} · VS Code {info.get("version")} · {info.get("mode")}/{info.get("owner")}{note}')
        open(os.path.join(talk, 'done'), 'w').close()
        proc.wait(timeout=60)
    finally:
        # 이 도구가 띄운 것만 PID 로 (이름으로 끄지 않음) — node 가 먼저 죽어도 찾은 VS Code 창의 프로세스는 끔
        if proc.poll() is None:
            subprocess.run(['taskkill', '/PID', str(proc.pid), '/T', '/F'], capture_output=True)
        # 찾은 창이 아직 있고 같은 프로세스일 때만 (꺼진 뒤 같은 PID 를 다른 프로그램이 받았을 수 있음)
        if hwnd and code_pid and user32.IsWindow(hwnd):
            now = wt.DWORD()
            user32.GetWindowThreadProcessId(hwnd, ctypes.byref(now))
            if now.value == code_pid:
                subprocess.run(['taskkill', '/PID', str(code_pid), '/T', '/F'], capture_output=True)
        shutil.rmtree(talk, ignore_errors=True)
        shutil.rmtree(user, ignore_errors=True)


def main():
    out, o = args()
    os.makedirs(out, exist_ok=True)
    if not o['nobuild']:
        # 확장 쪽 + 테스트 묶음만 (웹뷰 묶음 media/game 은 install.py · 시험 창 캡처가 쓰는 그대로 — 다른 세션의 캡처를 깨지 않게)
        subprocess.run(['node', 'scripts/build.mjs', '--release', '--tests', '--host-only'], cwd=ROOT, check=True)
    h = int(o['h'])
    widths = [int(x) for x in o['w'].split(',') if x]
    themes = ['dark', 'light'] if o['theme'] == 'both' else [o['theme']]
    skip = [w for w in widths if w < MIN_W]
    if skip:
        print(f'건너뜀 {skip} — 실제 VS Code 아래 패널은 이만큼 좁아지지 않아요 (시험 창 dev/game-shots.py 로)')
    widths = [w for w in widths if w >= MIN_W]
    for t in themes:
        if widths:
            shoot(out, t, h, widths, o)


if __name__ == '__main__':
    main()
