#!/usr/bin/env python3
"""게임 모드 화면 사진 — 머리 없는 Edge 로 dev/game.html 을 패널 크기마다 띄워 찍음 (npm run build 뒤에)

  python dev/game-shots.py                 기본 묶음 (타이틀 · 확인 · 안내 · 스테이지 · 너무 낮음, 높이 68 ~ 140 · 좁은 패널)
  python dev/game-shots.py --only title    이름에 title 이 들어간 것만
  사진: dev/shots/game/<이름>.png (저장소에 안 올라감)
"""
import argparse
import io
import os
import socket
import struct
import subprocess
import sys
import tempfile
import threading
import urllib.parse
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EDGE_CANDIDATES = [
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    os.path.expandvars(r"%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"),
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
]

# 이름 · 패널 너비 x 높이 · 미리보기 주소 값 (dev/game-host.js)
SHOTS = [
    ("title-ok-68", "720x68", {"screen": "title", "save": "ok"}),
    ("title-ok-92-small", "720x92", {"screen": "title", "save": "ok", "size": "small"}),
    ("title-ok-116-medium", "720x116", {"screen": "title", "save": "ok", "size": "medium"}),
    ("title-ok-140-large", "720x140", {"screen": "title", "save": "ok", "size": "large"}),
    ("title-ok-68-large-shrunk", "720x68", {"screen": "title", "save": "ok", "size": "large"}),
    ("title-none-68", "720x68", {"screen": "title", "save": "none"}),
    ("title-confirm-68", "720x68", {"screen": "title", "save": "ok", "click": "new"}),
    ("title-broken-68", "720x68", {"screen": "title", "save": "broken"}),
    ("title-newer-92", "720x92", {"screen": "title", "save": "newer"}),
    ("title-busy-68", "720x68", {"screen": "title", "save": "ok", "busy": "1"}),
    ("title-ok-narrow-320", "320x68", {"screen": "title", "save": "ok"}),
    ("title-ok-light", "720x92", {"screen": "title", "save": "ok", "theme": "light"}),
    ("stage-68", "720x68", {"screen": "game"}),
    ("stage-trace-116", "720x116", {"screen": "game", "progress": "0.0364", "size": "medium"}),
    ("stage-appear-92", "720x92", {"screen": "game", "progress": "0.0463"}),
    ("stage-battle-start-92", "720x92", {"screen": "game", "progress": "0.0483"}),
    ("stage-item-92", "720x92", {"screen": "game", "progress": "0.3092"}),
    ("stage-request-68", "720x68", {"screen": "game", "progress": "0.8866"}),
    ("stage-request-140", "720x140", {"screen": "game", "progress": "0.8866", "size": "large"}),
    ("stage-end-92", "720x92", {"screen": "game", "progress": "0.99999"}),
    ("stage-request-240", "240x92", {"screen": "game", "progress": "0.8866"}),
    ("stage-end-240", "240x92", {"screen": "game", "progress": "0.99999"}),
    ("stage-item-116", "720x116", {"screen": "game", "progress": "0.3097", "size": "medium"}),
    ("stage-light-116", "720x116", {"screen": "game", "progress": "0.0364", "theme": "light", "size": "medium"}),
    ("stage-116-medium", "720x116", {"screen": "game", "size": "medium"}),
    ("stage-140-large", "720x140", {"screen": "game", "size": "large"}),
    ("stage-narrow-320", "320x68", {"screen": "game"}),
    ("stage-from-new-68", "720x68", {"screen": "title", "save": "none", "click": "new"}),
    ("too-small-50", "720x50", {"screen": "game"}),
    ("title-ok-narrow-200", "200x68", {"screen": "title", "save": "ok"}),
    ("title-confirm-narrow-320", "320x68", {"screen": "title", "save": "ok", "click": "new"}),
    ("title-two-warnings-68", "720x68", {"screen": "title", "save": "broken", "busy": "1", "notice": "write-failed"}),
    ("stage-narrow-240", "240x68", {"screen": "game"}),
    ("stage-wide-1858", "1858x160", {"screen": "game"}),
    ("title-wide-1858", "1858x160", {"screen": "title", "save": "ok"}),
    ("battle-choose-68", "720x68", {"screen": "game", "battle": "choose"}),
    ("battle-choose-92", "720x92", {"screen": "game", "battle": "choose"}),
    ("battle-choose-116-medium", "720x116", {"screen": "game", "battle": "choose", "size": "medium"}),
    ("battle-choose-140-large", "720x140", {"screen": "game", "battle": "choose", "size": "large"}),
    ("battle-choose-200-medium", "720x200", {"screen": "game", "battle": "choose", "size": "medium"}),
    ("battle-skills-200", "720x200", {"screen": "game", "battle": "skills", "size": "medium", "click": "skills"}),
    ("battle-skills-68", "720x68", {"screen": "game", "battle": "skills", "click": "skills"}),
    ("battle-counter-200", "720x200", {"screen": "game", "battle": "counter", "size": "medium", "dur": "20000", "animAt": "10"}),
    ("battle-counter-68", "720x68", {"screen": "game", "battle": "counter"}),
    ("battle-clash-200", "720x200", {"screen": "game", "battle": "clash", "size": "medium"}),
    ("battle-clash-68", "720x68", {"screen": "game", "battle": "clash"}),
    ("battle-ult-cut-200", "720x200", {"screen": "game", "battle": "ult-cut", "size": "medium", "dur": "20000", "animAt": "5"}),
    ("battle-ult-beam-200", "720x200", {"screen": "game", "battle": "ult-beam", "size": "medium", "dur": "20000", "animAt": "14"}),
    ("battle-attack-200", "720x200", {"screen": "game", "battle": "attack", "size": "medium", "dur": "20000", "animAt": "10"}),
    ("battle-pick-200", "720x200", {"screen": "game", "battle": "pick", "size": "medium"}),
    ("battle-pick-68", "720x68", {"screen": "game", "battle": "pick"}),
    ("battle-over-116", "720x116", {"screen": "game", "battle": "over", "size": "medium"}),
    ("battle-auto-200", "720x200", {"screen": "game", "battle": "auto", "size": "medium"}),
    ("battle-narrow-320", "320x200", {"screen": "game", "battle": "choose", "size": "medium"}),
    ("battle-narrow-320-68", "320x68", {"screen": "game", "battle": "choose"}),
    ("battle-wide-1858", "1858x160", {"screen": "game", "battle": "choose", "size": "medium"}),
    ("battle-narrow-240", "240x200", {"screen": "game", "battle": "choose", "size": "medium"}),
    ("battle-narrow-240-68", "240x68", {"screen": "game", "battle": "choose"}),
    ("battle-narrow-320-92", "320x92", {"screen": "game", "battle": "choose", "size": "small"}),
    ("battle-skills-320", "320x200", {"screen": "game", "battle": "skills", "size": "medium", "click": "skills"}),
    ("battle-items-200", "720x200", {"screen": "game", "battle": "items", "size": "medium", "click": "items"}),
    ("battle-catch-200", "720x200", {"screen": "game", "battle": "catch", "size": "medium", "budget": "900", "animAt": "0.7"}),
    ("battle-catch-68", "720x68", {"screen": "game", "battle": "catch", "budget": "900", "animAt": "0.7"}),
    ("battle-last-200", "720x200", {"screen": "game", "battle": "last", "size": "medium", "budget": "1500"}),
    ("battle-last-68", "720x68", {"screen": "game", "battle": "last", "budget": "1500"}),
    ("scene-result-116", "720x116", {"screen": "game", "scene": "result", "size": "medium", "budget": "1500"}),
    ("scene-result-68", "720x68", {"screen": "game", "scene": "result", "budget": "1500"}),
    ("scene-learn-116", "720x116", {"screen": "game", "scene": "learn", "size": "medium"}),
    ("scene-learn-68", "720x68", {"screen": "game", "scene": "learn"}),
    ("scene-evolve-200", "720x200", {"screen": "game", "scene": "evolve", "size": "medium", "budget": "1500", "animAt": "2.6"}),
    ("scene-evolve-pick-116", "720x116", {"screen": "game", "scene": "evolve-pick", "size": "medium"}),
    ("scene-evolve-pick-68", "720x68", {"screen": "game", "scene": "evolve-pick"}),
    ("scene-learn-320", "320x116", {"screen": "game", "scene": "learn", "size": "medium"}),
    ("battle-light-200", "720x200", {"screen": "game", "battle": "choose", "size": "medium", "theme": "light"}),
    # 단계 8 · 9
    ("p89-facility-68", "720x68", {"screen": "game", "place": "facility"}),
    ("p89-facility-116", "720x116", {"screen": "game", "place": "facility", "size": "medium"}),
    ("p89-hospital-68", "720x68", {"screen": "game", "place": "hospital"}),
    ("p89-hospital-320", "320x92", {"screen": "game", "place": "hospital"}),
    ("p89-shop-68", "720x68", {"screen": "game", "place": "shop"}),
    ("p89-shop-116", "720x116", {"screen": "game", "place": "shop", "size": "medium"}),
    ("p89-trainer-92", "720x92", {"screen": "game", "place": "trainer", "budget": "600"}),
    ("p89-trainer-140", "720x140", {"screen": "game", "place": "trainer", "size": "large", "budget": "600"}),
    ("p89-trainer-alert-92", "720x92", {"screen": "game", "place": "trainer", "budget": "50"}),
    ("p89-trainer-battle-200", "720x200", {"screen": "game", "place": "trainer-battle", "size": "medium"}),
    ("p89-trainer-battle-68", "720x68", {"screen": "game", "place": "trainer-battle"}),
    ("p89-defeat-68", "720x68", {"screen": "game", "place": "defeat"}),
    ("p89-defeat-320", "320x92", {"screen": "game", "place": "defeat"}),
    ("p11-defeat-stuck-116", "720x116", {"screen": "game", "place": "defeat", "retries": "2", "size": "medium"}),
    ("p11-defeat-116", "720x116", {"screen": "game", "place": "defeat", "size": "medium"}),
    ("p89-clear-68", "720x68", {"screen": "game", "place": "clear"}),
    ("p89-clear-116", "720x116", {"screen": "game", "place": "clear", "size": "medium"}),
    ("p89-clear-320", "320x116", {"screen": "game", "place": "clear", "size": "medium"}),
    ("p89-lobby-68", "720x68", {"screen": "game", "place": "lobby"}),
    ("p89-lobby-140", "720x140", {"screen": "game", "place": "lobby", "size": "large"}),
    ("p89-lobby-320", "320x116", {"screen": "game", "place": "lobby", "size": "medium"}),
    ("p89-gym-battle-200", "720x200", {"screen": "game", "place": "gym-battle", "size": "medium"}),
    ("p89-badge-92", "720x92", {"screen": "game", "place": "badge"}),
    ("p89-menus-68", "720x68", {"screen": "game", "place": "walk"}),
    ("p89-menus-240", "240x68", {"screen": "game", "place": "walk"}),
    ("p89-map-68", "720x68", {"screen": "game", "place": "walk", "click": "map"}),
    ("p89-team-68", "720x68", {"screen": "game", "place": "walk", "click": "team"}),
    ("p89-team-116", "720x116", {"screen": "game", "place": "walk", "click": "team", "size": "medium"}),
    ("p89-team-320", "320x116", {"screen": "game", "place": "walk", "click": "team", "size": "medium"}),
    ("p89-bag-92", "720x92", {"screen": "game", "place": "walk", "click": "item"}),
    ("p89-settings-68", "720x68", {"screen": "game", "place": "walk", "click": "settings"}),
    ("p89-profile-200", "720x200", {"screen": "game", "battle": "choose", "size": "medium", "click": "profile"}),
    ("p89-profile-68", "720x68", {"screen": "game", "battle": "choose", "click": "profile"}),
    # 단계 10
    ("p10-hero-68", "720x68", {"screen": "title", "save": "none", "click": "hero"}),
    ("p10-hero-116", "720x116", {"screen": "title", "save": "none", "click": "hero", "size": "medium"}),
    ("p10-starter-68", "720x68", {"screen": "title", "save": "none", "click": "starter"}),
    ("p10-starter-116", "720x116", {"screen": "title", "save": "none", "click": "starter", "size": "medium"}),
    ("p10-starter-320", "320x116", {"screen": "title", "save": "none", "click": "starter", "size": "medium"}),
    ("p10-starter-frog-140", "720x140", {"screen": "title", "save": "none", "click": "starter", "size": "medium", "pick": "17"}),
    ("p10-trainer-140", "720x140", {"screen": "game", "place": "trainer", "size": "large", "budget": "600"}),
    ("p10-lobby-140", "720x140", {"screen": "game", "place": "lobby", "size": "large"}),
    ("p89-light-lobby-116", "720x116", {"screen": "game", "place": "lobby", "size": "medium", "theme": "light"}),
    # 단계 12 — S03 한 줄 여러 명 (2026-10-19 A안) · 그림 사람 (cap-girl)
    ("p12-hero-68", "720x68", {"screen": "title", "save": "none", "click": "hero", "pick": "2"}),
    ("p12-hero-92", "720x92", {"screen": "title", "save": "none", "click": "hero", "size": "small", "pick": "2"}),
    ("p12-hero-140", "720x140", {"screen": "title", "save": "none", "click": "hero", "size": "large", "pick": "2"}),
    ("p12-hero-240", "240x92", {"screen": "title", "save": "none", "click": "hero", "pick": "2"}),
    ("p12-hero-light-116", "720x116", {"screen": "title", "save": "none", "click": "hero", "size": "medium", "theme": "light"}),
    ("p12-walk-68", "720x68", {"screen": "game", "look": "may"}),
    ("p12-walk-116", "720x116", {"screen": "game", "look": "may", "size": "medium"}),
    ("p12-walk-140", "720x140", {"screen": "game", "look": "may", "size": "large"}),
    ("p12-trainer-92", "720x92", {"screen": "game", "look": "may", "place": "trainer", "budget": "600"}),
    ("p12-battle-92", "720x92", {"screen": "game", "look": "may", "battle": "choose"}),
    ("p12-battle-140", "720x140", {"screen": "game", "look": "may", "battle": "choose", "size": "large"}),
    ("p12-battle-360", "360x116", {"screen": "game", "look": "may", "battle": "choose", "size": "medium"}),
    ("p12-gym-116", "720x116", {"screen": "game", "look": "may", "place": "lobby", "size": "medium"}),
    ("p12-toast-68", "720x68", {"screen": "game", "look": "may", "toast": "✨ 상처약을 주웠다!"}),
    ("p12-toast-92", "720x92", {"screen": "game", "look": "may", "toast": "✨ 상처약을 주웠다!", "size": "small"}),
    ("p12-toast-140", "720x140", {"screen": "game", "look": "may", "toast": "✨ 상처약을 주웠다!", "size": "large"}),
    # 원작 사람 그림 배치 (2026-10-19) — 주인공 8명 · 트레이너 · 부탁 · 관장
    ("p12-hero8-116", "720x116", {"screen": "title", "save": "none", "click": "hero", "size": "medium"}),
    ("p12-hero8-68", "720x68", {"screen": "title", "save": "none", "click": "hero", "pick": "5"}),
    ("p12-hero8-320", "320x92", {"screen": "title", "save": "none", "click": "hero", "pick": "6"}),
    ("p12-request-116", "720x116", {"screen": "game", "look": "may", "progress": "0.8866", "size": "medium"}),
    ("p12-gym-battle-116", "720x116", {"screen": "game", "look": "brendan", "gender": "male", "place": "gym-battle", "size": "medium"}),
    ("p12-gym-92", "720x92", {"screen": "game", "look": "brendan", "gender": "male", "place": "lobby", "size": "small"}),
    ("p12-hero8-140", "720x140", {"screen": "title", "save": "none", "click": "hero", "size": "large"}),
    ("p12-mix-116", "720x116", {"screen": "game", "look": "brendan", "gender": "male", "place": "trainer", "size": "medium", "budget": "600"}),
    # 라이벌 (gdd 4.12 — 2026-10-19) — 깜짝 등장 "!" · 띠 (전적) · 전투 · 이긴 결과 · 진 알림
    ("p12-rival-116", "720x116", {"screen": "game", "look": "brendan", "gender": "male", "place": "rival", "size": "medium", "budget": "250"}),
    ("p12-rival-talk-116", "720x116", {"screen": "game", "look": "brendan", "gender": "male", "place": "rival-talk", "size": "medium", "budget": "600"}),
    ("p12-rival-talk-68", "720x68", {"screen": "game", "look": "brendan", "gender": "male", "place": "rival-talk", "budget": "600"}),
    ("p12-rival-talk-360", "360x92", {"screen": "game", "look": "girl", "place": "rival-talk", "rival": "may-rs", "record": "0-0", "size": "small", "budget": "600"}),
    ("p12-rival-talk-140", "720x140", {"screen": "game", "look": "may", "place": "rival-talk", "rival": "blue", "record": "3-4", "size": "large", "budget": "600"}),
    ("p12-rival-battle-116", "720x116", {"screen": "game", "look": "brendan", "gender": "male", "place": "rival-battle", "size": "medium"}),
    ("p12-rival-result-116", "720x116", {"screen": "game", "look": "brendan", "gender": "male", "place": "rival-result", "size": "medium"}),
    ("p12-rival-over-200", "720x200", {"screen": "game", "look": "brendan", "gender": "male", "place": "rival-over", "size": "medium", "budget": "300"}),
    ("p12-rival-lose-92", "720x92", {"screen": "game", "look": "brendan", "gender": "male", "place": "rival-lose", "record": "2-2", "toast": "라이벌 지민: 역시 내가 한 수 위지! (전적 2승 2패)", "size": "small"}),
    ("p12-rival-result-360", "360x116", {"screen": "game", "look": "brendan", "gender": "male", "place": "rival-result", "record": "0-0", "size": "medium"}),
    # 병원 간호순 · 상점 점원 (원작 파이어레드 그림, 2026-10-19)
    ("p12-staff-hospital-116", "720x116", {"screen": "game", "look": "may", "place": "facility", "size": "medium"}),
    ("p12-staff-hospital-68", "720x68", {"screen": "game", "look": "may", "place": "hospital"}),
    ("p12-staff-hospital-140", "720x140", {"screen": "game", "look": "brendan", "gender": "male", "place": "hospital", "size": "large"}),
    ("p12-staff-hospital-320", "320x92", {"screen": "game", "look": "may", "place": "hospital"}),
    ("p12-staff-shop-116", "720x116", {"screen": "game", "look": "brendan", "gender": "male", "place": "shop-front", "size": "medium"}),
    ("p12-staff-shop-92", "720x92", {"screen": "game", "look": "may", "place": "shop-front", "size": "small"}),
    ("p12-staff-shop-68", "720x68", {"screen": "game", "look": "may", "place": "shop-front"}),
    ("p12-staff-battle-68", "720x68", {"screen": "game", "look": "may", "progress": "0.6252", "battle": "choose"}),
    # 병원 · 상점 원작 건물 그림 — 사람과 같은 배율 (B안, 2026-10-19 태현 님)
    ("p12-bld-hospital-68", "720x68", {"screen": "game", "look": "may", "place": "facility"}),
    ("p12-bld-hospital-92", "720x92", {"screen": "game", "look": "may", "place": "facility", "size": "small"}),
    ("p12-bld-hospital-116", "720x116", {"screen": "game", "look": "may", "place": "facility", "size": "medium"}),
    ("p12-bld-hospital-140", "720x140", {"screen": "game", "look": "may", "place": "facility", "size": "large"}),
    ("p12-bld-shop-116", "720x116", {"screen": "game", "look": "may", "place": "shop-front", "size": "medium"}),
    ("p12-bld-hospital-200", "720x200", {"screen": "game", "look": "may", "place": "facility", "size": "large"}),
    ("p12-bld-shop-68", "720x68", {"screen": "game", "look": "may", "place": "shop-front"}),
    # 게임 모드 최소 높이 150px (2026-10-19 태현 님, 140 → 150) — 화면 17종 × 150 보통 · 150 크게 · 160 보통 · 190 작게 + 넓은 · 좁은 패널 + 150 아래 접힌 상태
    ("p150-title-150m", "720x150", {"screen": "title", "save": "ok", "size": "medium"}),
    ("p150-hero-150m", "720x150", {"screen": "title", "save": "none", "click": "hero", "size": "medium"}),
    ("p150-starter-150m", "720x150", {"screen": "title", "save": "none", "click": "starter", "size": "medium"}),
    ("p150-walk-150m", "720x150", {"screen": "game", "look": "may", "size": "medium"}),
    ("p150-trace-150m", "720x150", {"screen": "game", "look": "may", "progress": "0.0364", "size": "medium"}),
    ("p150-trainer-150m", "720x150", {"screen": "game", "look": "may", "place": "trainer", "budget": "600", "size": "medium"}),
    ("p150-battle-150m", "720x150", {"screen": "game", "look": "may", "battle": "choose", "size": "medium"}),
    ("p150-skills-150m", "720x150", {"screen": "game", "look": "may", "battle": "skills", "click": "skills", "size": "medium"}),
    ("p150-result-150m", "720x150", {"screen": "game", "look": "may", "scene": "result", "budget": "1500", "size": "medium"}),
    ("p150-hospital-150m", "720x150", {"screen": "game", "look": "may", "place": "hospital", "size": "medium"}),
    ("p150-shop-150m", "720x150", {"screen": "game", "look": "may", "place": "shop", "size": "medium"}),
    ("p150-team-150m", "720x150", {"screen": "game", "look": "may", "place": "walk", "click": "team", "size": "medium"}),
    ("p150-bag-150m", "720x150", {"screen": "game", "look": "may", "place": "walk", "click": "item", "size": "medium"}),
    ("p150-lobby-150m", "720x150", {"screen": "game", "look": "may", "place": "lobby", "size": "medium"}),
    ("p150-rival-150m", "720x150", {"screen": "game", "look": "brendan", "gender": "male", "place": "rival-talk", "budget": "600", "size": "medium"}),
    ("p150-defeat-150m", "720x150", {"screen": "game", "look": "may", "place": "defeat", "size": "medium"}),
    ("p150-clear-150m", "720x150", {"screen": "game", "look": "may", "place": "clear", "size": "medium"}),
    ("p150-title-150l", "720x150", {"screen": "title", "save": "ok", "size": "large"}),
    ("p150-hero-150l", "720x150", {"screen": "title", "save": "none", "click": "hero", "size": "large"}),
    ("p150-starter-150l", "720x150", {"screen": "title", "save": "none", "click": "starter", "size": "large"}),
    ("p150-walk-150l", "720x150", {"screen": "game", "look": "may", "size": "large"}),
    ("p150-trace-150l", "720x150", {"screen": "game", "look": "may", "progress": "0.0364", "size": "large"}),
    ("p150-trainer-150l", "720x150", {"screen": "game", "look": "may", "place": "trainer", "budget": "600", "size": "large"}),
    ("p150-battle-150l", "720x150", {"screen": "game", "look": "may", "battle": "choose", "size": "large"}),
    ("p150-skills-150l", "720x150", {"screen": "game", "look": "may", "battle": "skills", "click": "skills", "size": "large"}),
    ("p150-result-150l", "720x150", {"screen": "game", "look": "may", "scene": "result", "budget": "1500", "size": "large"}),
    ("p150-hospital-150l", "720x150", {"screen": "game", "look": "may", "place": "hospital", "size": "large"}),
    ("p150-shop-150l", "720x150", {"screen": "game", "look": "may", "place": "shop", "size": "large"}),
    ("p150-team-150l", "720x150", {"screen": "game", "look": "may", "place": "walk", "click": "team", "size": "large"}),
    ("p150-bag-150l", "720x150", {"screen": "game", "look": "may", "place": "walk", "click": "item", "size": "large"}),
    ("p150-lobby-150l", "720x150", {"screen": "game", "look": "may", "place": "lobby", "size": "large"}),
    ("p150-rival-150l", "720x150", {"screen": "game", "look": "brendan", "gender": "male", "place": "rival-talk", "budget": "600", "size": "large"}),
    ("p150-defeat-150l", "720x150", {"screen": "game", "look": "may", "place": "defeat", "size": "large"}),
    ("p150-clear-150l", "720x150", {"screen": "game", "look": "may", "place": "clear", "size": "large"}),
    ("p150-title-160m", "720x160", {"screen": "title", "save": "ok", "size": "medium"}),
    ("p150-hero-160m", "720x160", {"screen": "title", "save": "none", "click": "hero", "size": "medium"}),
    ("p150-starter-160m", "720x160", {"screen": "title", "save": "none", "click": "starter", "size": "medium"}),
    ("p150-walk-160m", "720x160", {"screen": "game", "look": "may", "size": "medium"}),
    ("p150-trace-160m", "720x160", {"screen": "game", "look": "may", "progress": "0.0364", "size": "medium"}),
    ("p150-trainer-160m", "720x160", {"screen": "game", "look": "may", "place": "trainer", "budget": "600", "size": "medium"}),
    ("p150-battle-160m", "720x160", {"screen": "game", "look": "may", "battle": "choose", "size": "medium"}),
    ("p150-skills-160m", "720x160", {"screen": "game", "look": "may", "battle": "skills", "click": "skills", "size": "medium"}),
    ("p150-result-160m", "720x160", {"screen": "game", "look": "may", "scene": "result", "budget": "1500", "size": "medium"}),
    ("p150-hospital-160m", "720x160", {"screen": "game", "look": "may", "place": "hospital", "size": "medium"}),
    ("p150-shop-160m", "720x160", {"screen": "game", "look": "may", "place": "shop", "size": "medium"}),
    ("p150-team-160m", "720x160", {"screen": "game", "look": "may", "place": "walk", "click": "team", "size": "medium"}),
    ("p150-bag-160m", "720x160", {"screen": "game", "look": "may", "place": "walk", "click": "item", "size": "medium"}),
    ("p150-lobby-160m", "720x160", {"screen": "game", "look": "may", "place": "lobby", "size": "medium"}),
    ("p150-rival-160m", "720x160", {"screen": "game", "look": "brendan", "gender": "male", "place": "rival-talk", "budget": "600", "size": "medium"}),
    ("p150-defeat-160m", "720x160", {"screen": "game", "look": "may", "place": "defeat", "size": "medium"}),
    ("p150-clear-160m", "720x160", {"screen": "game", "look": "may", "place": "clear", "size": "medium"}),
    ("p150-title-190s", "720x190", {"screen": "title", "save": "ok", "size": "small"}),
    ("p150-hero-190s", "720x190", {"screen": "title", "save": "none", "click": "hero", "size": "small"}),
    ("p150-starter-190s", "720x190", {"screen": "title", "save": "none", "click": "starter", "size": "small"}),
    ("p150-walk-190s", "720x190", {"screen": "game", "look": "may", "size": "small"}),
    ("p150-trace-190s", "720x190", {"screen": "game", "look": "may", "progress": "0.0364", "size": "small"}),
    ("p150-trainer-190s", "720x190", {"screen": "game", "look": "may", "place": "trainer", "budget": "600", "size": "small"}),
    ("p150-battle-190s", "720x190", {"screen": "game", "look": "may", "battle": "choose", "size": "small"}),
    ("p150-skills-190s", "720x190", {"screen": "game", "look": "may", "battle": "skills", "click": "skills", "size": "small"}),
    ("p150-result-190s", "720x190", {"screen": "game", "look": "may", "scene": "result", "budget": "1500", "size": "small"}),
    ("p150-hospital-190s", "720x190", {"screen": "game", "look": "may", "place": "hospital", "size": "small"}),
    ("p150-shop-190s", "720x190", {"screen": "game", "look": "may", "place": "shop", "size": "small"}),
    ("p150-team-190s", "720x190", {"screen": "game", "look": "may", "place": "walk", "click": "team", "size": "small"}),
    ("p150-bag-190s", "720x190", {"screen": "game", "look": "may", "place": "walk", "click": "item", "size": "small"}),
    ("p150-lobby-190s", "720x190", {"screen": "game", "look": "may", "place": "lobby", "size": "small"}),
    ("p150-rival-190s", "720x190", {"screen": "game", "look": "brendan", "gender": "male", "place": "rival-talk", "budget": "600", "size": "small"}),
    ("p150-defeat-190s", "720x190", {"screen": "game", "look": "may", "place": "defeat", "size": "small"}),
    ("p150-clear-190s", "720x190", {"screen": "game", "look": "may", "place": "clear", "size": "small"}),
    ("p150-walk-narrow360", "360x150", {"screen": "game", "look": "may", "size": "medium"}),
    ("p150-battle-narrow360", "360x150", {"screen": "game", "look": "may", "battle": "choose", "size": "medium"}),
    ("p150-hospital-narrow360", "360x150", {"screen": "game", "look": "may", "place": "hospital", "size": "medium"}),
    ("p150-title-narrow360", "360x150", {"screen": "title", "save": "ok", "size": "medium"}),
    ("p150-walk-wide1858", "1858x190", {"screen": "game", "look": "may", "size": "small"}),
    ("p150-battle-wide1858", "1858x190", {"screen": "game", "look": "may", "battle": "choose", "size": "small"}),
    ("p150-fold-walk-140", "720x140", {"screen": "game", "look": "may", "size": "medium"}),
    ("p150-fold-battle-149", "720x149", {"screen": "game", "look": "may", "battle": "choose"}),
    ("p150-fold-title-92", "720x92", {"screen": "title", "save": "ok"}),
    ("p150-fold-narrow-68", "320x68", {"screen": "game", "look": "may"}),
    # 전투 연출 = 일반 모드 연출 (fx=1 — 일반 모드 번들을 같이 띄움, 2026-10-19). 연출은 장면이 뜬 뒤 0.12초부터라 찍는 때 (budget) 가 중요
    ("fx-ember-170", "720x170", {"screen": "game", "look": "may", "size": "medium", "battle": "move", "side": "foe", "mv": "52", "dur": "20000", "fx": "1", "budget": "700"}),
    ("fx-razor-170", "720x170", {"screen": "game", "look": "may", "size": "medium", "battle": "move", "side": "me", "mv": "75", "dur": "20000", "fx": "1", "budget": "500"}),
    ("fx-tackle-170", "720x170", {"screen": "game", "look": "may", "size": "medium", "battle": "attack", "dur": "900", "fx": "1", "budget": "850"}),
    ("fx-scratch-170", "720x170", {"screen": "game", "look": "may", "size": "medium", "battle": "move", "side": "foe", "mv": "10", "dur": "900", "fx": "1", "budget": "780"}),
    # 틀마다 상대까지 닿는지 (#327) — 상대 (foe) 가 이상해씨에게 씀
    ("fx-aim-thunder", "720x170", {"screen": "game", "look": "may", "size": "medium", "battle": "move", "side": "foe", "foe": "pikachu:25", "mv": "87", "dur": "900", "fx": "1", "budget": "900"}),
    ("fx-aim-rockfall", "720x170", {"screen": "game", "look": "may", "size": "medium", "battle": "move", "side": "foe", "foe": "geodude:74", "mv": "88", "dur": "900", "fx": "1", "budget": "700"}),
    ("fx-aim-water", "720x170", {"screen": "game", "look": "may", "size": "medium", "battle": "move", "side": "foe", "foe": "squirtle:7", "mv": "55", "dur": "900", "fx": "1", "budget": "700"}),
    ("fx-aim-bubbles", "720x170", {"screen": "game", "look": "may", "size": "medium", "battle": "move", "side": "foe", "foe": "squirtle:7", "mv": "145", "dur": "900", "fx": "1", "budget": "900"}),
    ("fx-aim-notes", "720x170", {"screen": "game", "look": "may", "size": "medium", "battle": "move", "side": "foe", "foe": "clefairy:35", "mv": "47", "dur": "900", "fx": "1", "budget": "1100"}),
    ("fx-aim-rings", "720x170", {"screen": "game", "look": "may", "size": "medium", "battle": "move", "side": "foe", "foe": "squirtle:7", "mv": "352", "dur": "900", "fx": "1", "budget": "600"}),
    ("fx-aim-quake", "720x170", {"screen": "game", "look": "may", "size": "medium", "battle": "move", "side": "foe", "foe": "sandshrew:27", "mv": "89", "dur": "900", "fx": "1", "budget": "500"}),
    ("fx-aim-icebeam", "720x170", {"screen": "game", "look": "may", "size": "medium", "battle": "move", "side": "foe", "foe": "seel:86", "mv": "58", "dur": "900", "fx": "1", "budget": "600"}),
    ("fx-aim-vortex", "720x170", {"screen": "game", "look": "may", "size": "medium", "battle": "move", "side": "foe", "foe": "charmander:4", "mv": "83", "dur": "900", "fx": "1", "budget": "900"}),
    ("fx-aim-wide-flame", "1600x190", {"screen": "game", "look": "may", "size": "medium", "battle": "move", "side": "foe", "mv": "53", "dur": "900", "fx": "1", "budget": "900"}),
    ("fx-aim-vine", "720x170", {"screen": "game", "look": "may", "size": "medium", "battle": "move", "side": "me", "mv": "22", "dur": "900", "fx": "1", "budget": "780"}),
    # 힘대결 = 일반 모드 대결 (모으기 → 밀고 밀리기 (연타) → 이긴 쪽이 뚫고 나감) — 기술 · 필살기
    ("fx-clash-move-1500", "720x170", {"screen": "game", "look": "may", "size": "medium", "battle": "clash", "fx": "1", "budget": "1500"}),
    ("fx-clash-move-2600", "720x170", {"screen": "game", "look": "may", "size": "medium", "battle": "clash", "fx": "1", "budget": "2600"}),
    ("fx-clash-move-4000", "720x170", {"screen": "game", "look": "may", "size": "medium", "battle": "clash", "fx": "1", "budget": "4000"}),
    ("fx-clash-move-5100", "720x170", {"screen": "game", "look": "may", "size": "medium", "battle": "clash", "fx": "1", "budget": "5100"}),
    ("fx-clash-move-6000", "720x170", {"screen": "game", "look": "may", "size": "medium", "battle": "clash", "fx": "1", "budget": "6000"}),
    ("fx-clash-ult-1500", "720x170", {"screen": "game", "look": "may", "size": "medium", "battle": "clash", "ckind": "ult", "fx": "1", "budget": "1500"}),
    ("fx-clash-ult-3000", "720x170", {"screen": "game", "look": "may", "size": "medium", "battle": "clash", "ckind": "ult", "fx": "1", "budget": "3000"}),
    ("fx-clash-ult-5000", "720x170", {"screen": "game", "look": "may", "size": "medium", "battle": "clash", "ckind": "ult", "fx": "1", "budget": "5000"}),
    ("fx-clash-ult-7200", "720x170", {"screen": "game", "look": "may", "size": "medium", "battle": "clash", "ckind": "ult", "fx": "1", "budget": "7200"}),
    ("fx-clash-ult-8000", "720x170", {"screen": "game", "look": "may", "size": "medium", "battle": "clash", "ckind": "ult", "fx": "1", "budget": "8000"}),
    # 필살기 = 일반 모드 필살기 (번쩍 · 어두워짐 · 컷인 · 큰 글씨 · 전용 연출). 엔진 dur 2.2초지만 연출이 끝날 때까지 붙잡음 (fx/hold)
    ("fx-ult-bulba-500", "720x170", {"screen": "game", "look": "may", "size": "medium", "battle": "ult-beam", "side": "me", "dur": "2200", "fx": "1", "budget": "500"}),
    ("fx-ult-bulba-1300", "720x170", {"screen": "game", "look": "may", "size": "medium", "battle": "ult-beam", "side": "me", "dur": "2200", "fx": "1", "budget": "1300"}),
    ("fx-ult-bulba-2600", "720x170", {"screen": "game", "look": "may", "size": "medium", "battle": "ult-beam", "side": "me", "dur": "2200", "fx": "1", "budget": "2600"}),
    ("fx-ult-bulba-4200", "720x170", {"screen": "game", "look": "may", "size": "medium", "battle": "ult-beam", "side": "me", "dur": "2200", "fx": "1", "budget": "4200"}),
    ("fx-ult-bulba-6500", "720x170", {"screen": "game", "look": "may", "size": "medium", "battle": "ult-beam", "side": "me", "dur": "2200", "fx": "1", "budget": "6500"}),
    ("fx-ult-charm-500", "720x170", {"screen": "game", "look": "may", "size": "medium", "battle": "ult-beam", "side": "foe", "dur": "2200", "fx": "1", "budget": "500"}),
    ("fx-ult-charm-1300", "720x170", {"screen": "game", "look": "may", "size": "medium", "battle": "ult-beam", "side": "foe", "dur": "2200", "fx": "1", "budget": "1300"}),
    ("fx-ult-charm-2600", "720x170", {"screen": "game", "look": "may", "size": "medium", "battle": "ult-beam", "side": "foe", "dur": "2200", "fx": "1", "budget": "2600"}),
    ("fx-ult-charm-4200", "720x170", {"screen": "game", "look": "may", "size": "medium", "battle": "ult-beam", "side": "foe", "dur": "2200", "fx": "1", "budget": "4200"}),
    ("fx-ult-charm-6500", "720x170", {"screen": "game", "look": "may", "size": "medium", "battle": "ult-beam", "side": "foe", "dur": "2200", "fx": "1", "budget": "6500"}),
    # 필살기가 0.5초에 끊김 (맞받아치기 힘대결로) — 1.5 · 3초에 필살기 본편 · 어둠 · 숨긴 그림이 안 남아야 함
    ("fx-ult-stop-450", "720x170", {"screen": "game", "look": "may", "size": "medium", "battle": "ult-beam", "side": "foe", "dur": "20000", "fx": "1", "stopult": "500", "budget": "450"}),
    ("fx-ult-stop-1500", "720x170", {"screen": "game", "look": "may", "size": "medium", "battle": "ult-beam", "side": "foe", "dur": "20000", "fx": "1", "stopult": "500", "budget": "1500"}),
    ("fx-ult-stop-3000", "720x170", {"screen": "game", "look": "may", "size": "medium", "battle": "ult-beam", "side": "foe", "dur": "20000", "fx": "1", "stopult": "500", "budget": "3000"}),
    # 파이어레드 원작 그림 (레드 = boy)
    ("p12-red-walk-68", "720x68", {"screen": "game", "look": "boy", "gender": "male"}),
    ("p12-red-walk-116", "720x116", {"screen": "game", "look": "boy", "gender": "male", "size": "medium"}),
    ("p12-red-trainer-92", "720x92", {"screen": "game", "look": "boy", "gender": "male", "place": "trainer", "budget": "600"}),
    ("p12-red-battle-140", "720x140", {"screen": "game", "look": "boy", "gender": "male", "battle": "choose", "size": "large"}),
    ("p12-red-gym-116", "720x116", {"screen": "game", "look": "boy", "gender": "male", "place": "lobby", "size": "medium"}),
]


class Quiet(SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=HERE, **k)

    def log_message(self, *a):
        pass


def serve():
    s = socket.socket()
    s.bind(("127.0.0.1", 0))
    port = s.getsockname()[1]
    s.close()
    httpd = ThreadingHTTPServer(("127.0.0.1", port), Quiet)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd, port


def browser():
    exe = next((c for c in EDGE_CANDIDATES if os.path.exists(c)), None)
    if not exe:
        sys.exit("Edge · Chrome 을 못 찾음")
    return exe


def png_size(path):
    with open(path, "rb") as f:
        head = f.read(24)
    return struct.unpack(">II", head[16:24])


def shoot(url, win, path, budget=3500):
    with tempfile.TemporaryDirectory() as prof:
        cmd = [browser(), "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check", "--hide-scrollbars", "--mute-audio",
               "--force-device-scale-factor=1", f"--user-data-dir={prof}", f"--window-size={win.replace('x', ',')}", f"--virtual-time-budget={budget}",
               f"--screenshot={path}", url]
        subprocess.run(cmd, capture_output=True, timeout=60)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--only")
    ap.add_argument("--out", default=os.path.join(HERE, "dev", "shots", "game"))
    a = ap.parse_args()
    if not os.path.exists(os.path.join(HERE, "extension", "media", "game", "game.js")):
        sys.exit("game.js 가 없음 — 먼저 npm run build")
    os.makedirs(a.out, exist_ok=True)
    httpd, port = serve()
    try:
        for name, win, params in SHOTS:
            if a.only and a.only not in name:
                continue
            path = os.path.join(a.out, f"{name}.png")
            if os.path.exists(path):
                os.remove(path)
            # 머리 없는 브라우저는 찍는 순간에야 창 크기가 맞음 → 처음부터 정확한 크기인 iframe 에 띄움 (dev/frame.html), 창 = iframe 크기
            w, h = win.split("x")
            frame = f"http://127.0.0.1:{port}/dev/frame.html?" + urllib.parse.urlencode({"w": w, "h": h, "page": "game.html", "q": urllib.parse.urlencode({**{k: v for k, v in params.items() if k != "budget"}, "shim": "1"})})
            shoot(frame, win, path, int(params.get("budget", 3500)))
            if os.path.exists(path):
                w, h = png_size(path)
                print(f"{path}  ({w}x{h})")
            else:
                print(f"✗ 못 찍음 {path}")
    finally:
        httpd.shutdown()


if __name__ == "__main__":
    main()
