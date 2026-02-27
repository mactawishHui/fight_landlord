"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.code2Session = code2Session;
exports.loginWithCode = loginWithCode;
exports.verifyToken = verifyToken;
/**
 * WeChat OAuth — exchange mini-game login code for openid.
 * The appSecret is only ever used server-side (never in client code).
 */
const axios_1 = __importDefault(require("axios"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const db_1 = require("./db");
const APP_ID = process.env.WECHAT_APP_ID ?? '';
const APP_SECRET = process.env.WECHAT_APP_SECRET ?? '';
const JWT_SECRET = process.env.JWT_SECRET ?? 'change_me';
/**
 * Exchange a WeChat login `code` for openid via the WeChat server API.
 * Reference: https://developers.weixin.qq.com/minigame/dev/api-backend/open-api/login/auth.code2Session.html
 */
async function code2Session(code) {
    const url = `https://api.weixin.qq.com/sns/jscode2session?appid=${APP_ID}&secret=${APP_SECRET}&js_code=${code}&grant_type=authorization_code`;
    const resp = await axios_1.default.get(url);
    if (resp.data.errcode && resp.data.errcode !== 0) {
        throw new Error(`WeChat code2Session error ${resp.data.errcode}: ${resp.data.errmsg}`);
    }
    return resp.data;
}
/**
 * Full login flow: exchange code, upsert user, return signed JWT.
 */
async function loginWithCode(code, nickname, avatarUrl) {
    const session = await code2Session(code);
    const user = await (0, db_1.upsertUser)(session.openid, nickname, avatarUrl);
    const token = jsonwebtoken_1.default.sign({ openid: session.openid, userId: user.id }, JWT_SECRET, { expiresIn: '30d' });
    return { user, token };
}
/**
 * Verify a JWT and return the user. Returns null if invalid/expired.
 */
async function verifyToken(token) {
    try {
        const payload = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        return (0, db_1.getUserByOpenid)(payload.openid);
    }
    catch {
        return null;
    }
}
