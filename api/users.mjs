import { db } from './_db.mjs';

function hashPwd(pwd) {
  let h = 0;
  for (let i = 0; i < pwd.length; i++) { h = (h << 5) - h + pwd.charCodeAt(i); h |= 0; }
  return 'h' + (h >>> 0).toString(16);
}

const SECRET = 'zsyx-sign-v1';

function decodeToken(token) {
  try {
    const s = Buffer.from(token, 'base64').toString('utf8');
    const [phone, sec] = s.split(':');
    if (sec === SECRET && phone) return phone;
  } catch (e) {}
  return null;
}

async function readBody(req) {
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', c => raw += c);
    req.on('end', () => {
      try { resolve(JSON.parse(raw)); } catch (e) { resolve({}); }
    });
    req.on('error', () => resolve({}));
  });
}

function send(res, data, code = 200) {
  res.setHeader('content-type', 'application/json');
  res.statusCode = code;
  res.end(JSON.stringify(data));
}

export default async function handler(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const action = url.searchParams.get('action');
  const body = await readBody(req);

  if (action === 'register') {
    const phone = (body.phone || '').trim();
    const pwd = body.pwd || '';
    if (!/^1\d{10}$/.test(phone)) return send(res, { ok: false, msg: '手机号格式不正确' }, 400);
    if (pwd.length < 6) return send(res, { ok: false, msg: '密码至少6位' }, 400);
    const users = await db.getUsers();
    if (users.find(u => u.phone === phone)) return send(res, { ok: false, msg: '该手机号已注册' }, 400);
    const user = { phone, pwd: hashPwd(pwd), role: null, createdAt: Date.now() };
    users.push(user);
    await db.saveUsers(users);
    return send(res, { ok: true, user });
  }

  if (action === 'login') {
    const phone = (body.phone || '').trim();
    const pwd = body.pwd || '';
    const users = await db.getUsers();
    const user = users.find(u => u.phone === phone);
    if (!user) return send(res, { ok: false, msg: '账号不存在，请先注册' }, 400);
    if (user.pwd !== hashPwd(pwd)) return send(res, { ok: false, msg: '密码错误' }, 400);
    const token = Buffer.from(phone + ':' + SECRET).toString('base64');
    return send(res, { ok: true, token, role: user.role });
  }

  if (action === 'setrole') {
    const token = (req.headers.authorization || req.headers.Authorization || '');
    const phone = decodeToken(token);
    if (!phone) return send(res, { ok: false, msg: '未登录' }, 401);
    const role = body.role;
    if (role !== 'recruiter' && role !== 'seeker') return send(res, { ok: false, msg: '角色无效' }, 400);
    const users = await db.getUsers();
    const u = users.find(x => x.phone === phone);
    if (!u) return send(res, { ok: false, msg: '账号不存在' }, 401);
    u.role = role; await db.saveUsers(users);
    return send(res, { ok: true, role });
  }

  if (action === 'me') {
    const token = (req.headers.authorization || req.headers.Authorization || '');
    const phone = decodeToken(token);
    if (!phone) return send(res, { ok: false, msg: '未登录' }, 401);
    const users = await db.getUsers();
    const u = users.find(x => x.phone === phone);
    if (!u) return send(res, { ok: false, msg: '账号不存在' }, 401);
    return send(res, { ok: true, phone: u.phone, role: u.role });
  }

  return send(res, { ok: false, msg: 'unknown action' }, 400);
}
