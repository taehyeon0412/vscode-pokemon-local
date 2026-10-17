#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────
#  VS Code 포켓몬 (내 PC 수정본) — 한 줄 설치 · 업데이트
#
#    curl -fsSL https://raw.githubusercontent.com/taehyeon0412/vscode-pokemon-local/main/install.sh | bash
#
#  하는 일:
#   1. GitHub 최신 릴리스의 vsix 를 ~/.vscode-pokemon/ 에 받음
#   2. VS Code 명령(code)을 찾음 (PATH → 기본 설치 위치)
#   3. 마켓 버전(jakobhoeg.vscode-pokemon)이 있으면 지움 — 명령 · 패널 이름이 같아 충돌
#   4. 받은 vsix 를 설치하고 ~/.vscode-pokemon/update.sh (업데이트 명령) 를 만듦
#
#  요구사항: VS Code · curl — macOS / Linux / Windows(Git Bash)
#  code 위치를 직접 정하려면:  VSCODE_CLI=/경로/code bash install.sh
#  직접 고쳐서 쓰려면 저장소를 받아 python install.py (README "고치기")
# ─────────────────────────────────────────────────────────────────────────
set -euo pipefail

REPO="taehyeon0412/vscode-pokemon-local"
EXT_ID="local.vscode-pokemon"
MARKET_ID="jakobhoeg.vscode-pokemon"
ASSET="vscode-pokemon-local.vsix"
INSTALL_URL="https://raw.githubusercontent.com/$REPO/main/install.sh"
VSIX_URL="https://github.com/$REPO/releases/latest/download/$ASSET"
HOME_DIR="$HOME/.vscode-pokemon"

say(){ printf '\033[1;36m%s\033[0m\n' "$1"; }
ok(){ printf '\033[1;32m%s\033[0m\n' "$1"; }
die(){ printf '\033[1;31m%s\033[0m\n' "$@" >&2; exit 1; }

# PATH → 운영체제별 기본 설치 위치 (install.py 의 code_cli 와 같은 순서)
find_code() {
  if [ -n "${VSCODE_CLI:-}" ]; then echo "$VSCODE_CLI"; return 0; fi
  if command -v code >/dev/null 2>&1; then command -v code; return 0; fi
  local lad="" c
  if [ -n "${LOCALAPPDATA:-}" ]; then
    if command -v cygpath >/dev/null 2>&1; then lad="$(cygpath -u "$LOCALAPPDATA")"; else lad="$LOCALAPPDATA"; fi
  fi
  for c in \
    "$lad/Programs/Microsoft VS Code/bin/code" \
    "/c/Program Files/Microsoft VS Code/bin/code" \
    "/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code" \
    "$HOME/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code" \
    "/usr/share/code/bin/code" \
    "/usr/bin/code" \
    "/snap/bin/code"; do
    if [ -x "$c" ]; then echo "$c"; return 0; fi
  done
  return 1
}

# Windows(Git Bash) 에서는 code 에 C:\… 모양 경로를 넘김
native_path() {
  if command -v cygpath >/dev/null 2>&1; then cygpath -w "$1"; else echo "$1"; fi
}

# code 는 stdin 을 읽지 않게 (curl | bash 에서 남은 스크립트를 먹지 않도록)
run_code() { "$CODE" "$@" </dev/null; }

installed_version() {
  run_code --list-extensions --show-versions 2>/dev/null | tr -d '\r' | grep -i "^$EXT_ID@" | cut -d@ -f2 || true
}

main() {
  command -v curl >/dev/null 2>&1 || die "✗ curl 이 필요합니다."
  mkdir -p "$HOME_DIR"
  local vsix="$HOME_DIR/$ASSET"

  say "▶ 최신 릴리스 받는 중..."
  curl -fL --retry 3 --progress-bar -o "$vsix.part" "$VSIX_URL" \
    || die "✗ 받기 실패 — 네트워크를 확인하세요." "  $VSIX_URL"
  mv -f "$vsix.part" "$vsix"

  if ! CODE="$(find_code)"; then
    die "✗ VS Code 명령(code)을 못 찾았어요." \
        "  받아 둔 파일: $(native_path "$vsix")" \
        "  VS Code 확장 탭 … → 'Install from VSIX...' 로 이 파일을 설치하세요."
  fi

  local before after
  before="$(installed_version)"

  if run_code --list-extensions 2>/dev/null | tr -d '\r' | grep -qix "$MARKET_ID"; then
    say "▶ 마켓 버전($MARKET_ID)을 지워요 — 명령 · 패널 이름이 같아 둘 다 있으면 충돌해요"
    run_code --uninstall-extension "$MARKET_ID" >/dev/null 2>&1 || true
  fi

  say "▶ 설치 중..."
  run_code --install-extension "$(native_path "$vsix")" --force >/dev/null \
    || die "✗ 설치 실패 — 받아 둔 파일: $(native_path "$vsix")"
  after="$(installed_version)"
  [ -n "$after" ] || die "✗ 설치를 확인하지 못했어요 — VS Code 확장 탭에서 '$EXT_ID' 를 찾아 보세요."

  cat > "$HOME_DIR/update.sh" <<EOF
#!/usr/bin/env bash
# VS Code 포켓몬 — 최신본 받아 설치 (설치 한 줄을 다시 부름)
curl -fsSL "$INSTALL_URL" | bash
EOF
  chmod +x "$HOME_DIR/update.sh"

  if [ -z "$before" ]; then ok "✓ 설치했어요 (v$after)"
  elif [ "$before" = "$after" ]; then ok "✓ 이미 최신이라 같은 버전으로 다시 설치했어요 (v$after)"
  else ok "✓ 업데이트했어요 (v$before → v$after)"
  fi
  echo "  VS Code 명령 팔레트(Ctrl+Shift+P / ⌘⇧P)에서 'Developer: Reload Window' 를 실행하면 반영돼요."
  echo "  포켓몬은 탐색기의 '포켓몬' 칸에 나와요 (아래 패널로 끌어다 놓으면 가로로 길게)."
  echo "  업데이트:  bash ~/.vscode-pokemon/update.sh"
}

# 스크립트를 끝까지 받은 뒤에만 실행 (curl 이 중간에 끊겨도 반쯤 실행되지 않게)
main "$@"
