#!/bin/bash
# 예전 명령 그대로 쓰려고 남겨 둠 — 실제 설치는 install.py
exec python3 "$(dirname "$0")/install.py" "$@"
