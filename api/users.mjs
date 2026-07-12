import { db } from './_db.mjs';

function hashPwd(pwd) {
  let h = 0;
  for (let i = 0; i < pwd.length; i++) { h = (h << 5) - h + pwd.charCodeAt(i); h |= 0; }
  return 'h' + (h >>> 0).toString(16);
}
function ok(data, code = 200) { return new Response(JSON.stringify(data), { status: code, headers: { 'content-type': 'application/json' } }); }
function err(msg, code = 400) { return new Response(JSON.stringify({ ok: false, msg }), { status: code, headers: { 'content-type': 'application/json' } }); }

const SECRET = 'zsyx-sign-v1';

export default async function handler(req) {
  const url = new URL(req.url);
  const action = url.searchParams.get('action');
  let body = {};
  try { body = await req.json(); } catch (e) {}

  // 注册
  if (action === 'register') {
    const phone = (body.phone || '').trim();
    const pwd = body.pwd || '';
    if (!/^1\d{10}$/.test(phone)) return err('手机号格式不正确');
    if (pwd.length < 6) return err('密码至少6位');
    const users = await db.getUsers();
    if (users.find(u => u.phone === phone)) return err('该手机号已注册');
    const user = { phone, pwd: hashPwd(pwd), role: null, createdAt: Date.now() };
    users.push(user);
    await db.saveUsers(users);
    return ok({ ok: true, user });
  }

  // 登录
  if (action === 'login') {
    const phone = (body.phone || '').trim();
    const pwd = body.pwd || '';
    const users = await db.getUsers();
    const user = users.find(u => u.phone === phone);
    if (!user) return err('账号不存在，请先注册');
    if (user.pwd !== hashPwd(pwd)) return err('密码错误');
    // 签发简单 token：base64(phone:secret)
    const token = Buffer.from(phone + ':' + SECRET).toString('base64');
    return ok({ ok: true, token, role: user.role });
  }

  // 设置角色
  if (action === 'setrole') {
    const token = req.headers.get('authorization') || '';
    const phone = decodeToken(token);
    if (!phone) return err('未登录', 401);
    const role = body.role;
    if (role !== 'recruiter' && role !== 'seeker') return err('角色无效');
    const users = await db.getUsers();
    const u = users.find(x => x.phone === phone);
    if (!u) return err('账号不存在', 401);
    u.role = role; await db.saveUsers(users);
    return ok({ ok: true, role });
  }

  // 当前用户
  if (action === 'me') {
    const token = req.headers.get('authorization') || '';
    const phone = decodeToken(token);
    if (!phone) return err('未登录', 401);
    const users = await db.getUsers();
    const u = users.find(x => x.phone === phone);
    if (!u) return err('账号不存在', 401);
    return ok({ ok: true, phone: u.phone, role: u.role });
  }

  return err('unknown action');
}

function decodeToken(token) {
  try {
    const s = Buffer.from(token, 'base64').toString('utf8');
    const [phone, sec] = s.split(':');
    if (sec === SECRET && phone) return phone;
  } catch (e) {}
  return null;
}
