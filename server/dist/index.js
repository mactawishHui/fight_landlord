"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * 斗地主 Game Server
 *
 * Provides:
 *  - POST /api/auth/wechat  — WeChat code2Session → JWT
 *  - GET  /api/leaderboard  — Top players
 *  - GET  /api/user/me      — Current user profile
 *  - WS   /ws               — Real-time multiplayer game server
 *
 * Usage:
 *  cp .env.example .env && edit .env
 *  npm install
 *  npm run dev
 */
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const http_1 = require("http");
const ws_1 = require("ws");
const auth_1 = require("./auth");
const db_1 = require("./db");
const gameRoom_1 = require("./gameRoom");
const app = (0, express_1.default)();
const http = (0, http_1.createServer)(app);
const wss = new ws_1.WebSocketServer({ server: http, path: '/ws' });
const PORT = Number(process.env.PORT ?? 3001);
app.use(express_1.default.json());
// ── CORS (allow WeChat Mini Game domains) ─────────────────────────────────────
app.use((_req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    next();
});
// ── Auth ──────────────────────────────────────────────────────────────────────
/**
 * POST /api/auth/wechat
 * Body: { code, nickname?, avatarUrl? }
 * Returns: { user, token }
 */
app.post('/api/auth/wechat', async (req, res) => {
    try {
        const { code, nickname = '玩家', avatarUrl = '' } = req.body;
        if (!code) {
            res.status(400).json({ error: 'code is required' });
            return;
        }
        const result = await (0, auth_1.loginWithCode)(code, nickname, avatarUrl);
        res.json(result);
    }
    catch (e) {
        console.error('[Auth] login error:', e.message);
        res.status(500).json({ error: e.message });
    }
});
// ── Leaderboard ───────────────────────────────────────────────────────────────
app.get('/api/leaderboard', async (req, res) => {
    try {
        const limit = Math.min(Number(req.query.limit ?? 20), 50);
        const entries = await (0, db_1.getLeaderboard)(limit);
        res.json({ entries });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// ── User profile ──────────────────────────────────────────────────────────────
app.get('/api/user/me', async (req, res) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }
    const user = await (0, auth_1.verifyToken)(token);
    if (!user) {
        res.status(401).json({ error: 'Invalid token' });
        return;
    }
    res.json({ user });
});
// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok', ts: Date.now() }));
// ── WebSocket ─────────────────────────────────────────────────────────────────
wss.on('connection', (ws) => {
    let authed = false;
    ws.on('message', async (data) => {
        const raw = data.toString();
        let msg;
        try {
            msg = JSON.parse(raw);
        }
        catch {
            return;
        }
        // First message must be AUTH
        if (!authed) {
            if (msg.type !== 'AUTH') {
                ws.send(JSON.stringify({ type: 'ERROR', message: '请先认证' }));
                return;
            }
            const user = await (0, auth_1.verifyToken)(msg.token);
            if (!user) {
                ws.send(JSON.stringify({ type: 'ERROR', message: '认证失败' }));
                ws.close();
                return;
            }
            authed = true;
            (0, gameRoom_1.registerClient)(ws, user);
            ws.send(JSON.stringify({ type: 'AUTHENTICATED', user }));
            return;
        }
        (0, gameRoom_1.handleMessage)(ws, raw);
    });
    ws.on('error', (err) => console.error('[WS] error:', err));
});
// ── Start ─────────────────────────────────────────────────────────────────────
http.listen(PORT, () => {
    console.log(`[Server] Listening on http://localhost:${PORT}`);
    console.log(`[Server] WebSocket: ws://localhost:${PORT}/ws`);
    console.log(`[Server] Health:    http://localhost:${PORT}/health`);
});
