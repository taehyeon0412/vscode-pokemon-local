"use strict";
// GAME-PATCH: 게임 모드 연결 — 빌드된 게임(out/game/host.js, 원본은 src/game)을 불러온다.
// 게임 빌드가 없거나(저장소를 받아 python install.py 만 한 경우) 게임 코드에서 오류가 나도
// 일반 모드는 그대로 돌게, 모든 호출을 try 로 감싼다.
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadGame = void 0;
const fs = require("fs");
const path = require("path");
function loadGame(context, options) {
    const hostPath = (options && options.hostPath) || path.join(context.extensionPath, 'out', 'game', 'host.js');
    const log = (options && options.log) || ((...args) => console.error('[pokemon-game]', ...args));
    if (!fs.existsSync(hostPath)) {
        return undefined;
    }
    let host;
    let hostExports;
    try {
        host = require(hostPath).activate(context);
        if (!host || typeof host !== 'object') {
            throw new Error('activate 가 게임 객체를 돌려주지 않음');
        }
        hostExports = host.exports;
    }
    catch (e) {
        log('게임 모드를 불러오지 못함 — 일반 모드만 씀', e);
        return undefined;
    }
    // 게임 쪽 함수가 던지거나 실패한 Promise 를 내도 원래 확장까지 번지지 않게
    const safe = (name, fallback) => (...args) => {
        try {
            const result = host[name](...args);
            if (result && typeof result.then === 'function') {
                return result.then(undefined, (e) => {
                    log(name, e);
                    return fallback;
                });
            }
            return result;
        }
        catch (e) {
            log(name, e);
            return fallback;
        }
    };
    return {
        attachView: safe('attachView', undefined),
        webviewHtml: safe('webviewHtml', ''),
        deactivate: safe('deactivate', undefined),
        exports: hostExports,
    };
}
exports.loadGame = loadGame;
