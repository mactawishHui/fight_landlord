/**
 * WeChat OAuth — exchange mini-game login code for openid.
 * The appSecret is only ever used server-side (never in client code).
 */
import axios from 'axios';
import jwt from 'jsonwebtoken';
import { upsertUser, getUserByOpenid } from './db';
import { User } from './types';

const APP_ID     = process.env.WECHAT_APP_ID     ?? '';
const APP_SECRET = process.env.WECHAT_APP_SECRET ?? '';
const JWT_SECRET = process.env.JWT_SECRET        ?? 'change_me';

interface WxSession {
  openid:      string;
  session_key: string;
  unionid?:    string;
  errcode?:    number;
  errmsg?:     string;
}

/**
 * Exchange a WeChat login `code` for openid via the WeChat server API.
 * Reference: https://developers.weixin.qq.com/minigame/dev/api-backend/open-api/login/auth.code2Session.html
 */
export async function code2Session(code: string): Promise<WxSession> {
  const url = `https://api.weixin.qq.com/sns/jscode2session?appid=${APP_ID}&secret=${APP_SECRET}&js_code=${code}&grant_type=authorization_code`;
  const resp = await axios.get<WxSession>(url);
  if (resp.data.errcode && resp.data.errcode !== 0) {
    throw new Error(`WeChat code2Session error ${resp.data.errcode}: ${resp.data.errmsg}`);
  }
  return resp.data;
}

/**
 * Full login flow: exchange code, upsert user, return signed JWT.
 */
export async function loginWithCode(
  code: string,
  nickname: string,
  avatarUrl: string,
): Promise<{ user: User; token: string }> {
  const session = await code2Session(code);
  const user    = await upsertUser(session.openid, nickname, avatarUrl);
  const token   = jwt.sign({ openid: session.openid, userId: user.id }, JWT_SECRET, { expiresIn: '30d' });
  return { user, token };
}

/**
 * Verify a JWT and return the user. Returns null if invalid/expired.
 */
export async function verifyToken(token: string): Promise<User | null> {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { openid: string };
    return getUserByOpenid(payload.openid);
  } catch {
    return null;
  }
}
