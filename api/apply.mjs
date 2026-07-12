import { db } from './_db.mjs';

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
    req.on('end', () => { try { resolve(JSON.parse(raw)); } catch (e) { resolve({}); } });
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
  const action = url.searchParams.get('action') || 'apply';
  const token = (req.headers.authorization || req.headers.Authorization || '');
  const phone = decodeToken(token);
  if (!phone) return send(res, { ok: false, msg: '请先登录' }, 401);
  const users = await db.getUsers();
  const u = users.find(x => x.phone === phone);
  if (!u || u.role !== 'seeker') return send(res, { ok: false, msg: '仅求职者可操作' }, 403);
  const body = await readBody(req);

  if (action === 'apply') {
    const jobId = body.jobId;
    const apps = await db.getApps();
    if (apps.find(a => a.phone === phone && a.jobId === jobId)) return send(res, { ok: false, msg: '已投递过该职位' }, 400);
    apps.push({ phone, jobId, at: Date.now() });
    await db.saveApps(apps);
    return send(res, { ok: true });
  }

  if (action === 'fav') {
    const jobId = body.jobId;
    const favs = await db.getFavs();
    const i = favs.findIndex(f => f.phone === phone && f.jobId === jobId);
    let fav = false;
    if (i >= 0) favs.splice(i, 1); else { favs.push({ phone, jobId }); fav = true; }
    await db.saveFavs(favs);
    return send(res, { ok: true, fav });
  }

  if (action === 'mine') {
    const apps = await db.getApps();
    const favs = await db.getFavs();
    return send(res, { ok: true, applied: apps.filter(a => a.phone === phone).map(a => a.jobId), favs: favs.filter(f => f.phone === phone).map(f => f.jobId) });
  }

  return send(res, { ok: false, msg: 'unknown action' }, 400);
}
