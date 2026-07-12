import { db } from './_db.mjs';

function ok(data, code = 200) { return new Response(JSON.stringify(data), { status: code, headers: { 'content-type': 'application/json' } }); }
function err(msg, code = 400) { return new Response(JSON.stringify({ ok: false, msg }), { status: code, headers: { 'content-type': 'application/json' } }); }

const SECRET = 'zsyx-sign-v1';
function decodeToken(token) {
  try {
    const s = Buffer.from(token, 'base64').toString('utf8');
    const [phone, sec] = s.split(':');
    if (sec === SECRET && phone) return phone;
  } catch (e) {}
  return null;
}

export default async function handler(req) {
  const url = new URL(req.url);
  const action = url.searchParams.get('action') || 'apply';
  const token = req.headers.get('authorization') || '';
  const phone = decodeToken(token);
  if (!phone) return err('请先登录', 401);
  const users = await db.getUsers();
  const u = users.find(x => x.phone === phone);
  if (!u || u.role !== 'seeker') return err('仅求职者可操作', 403);

  let body = {};
  try { body = await req.json(); } catch (e) {}

  if (action === 'apply') {
    const jobId = body.jobId;
    const apps = await db.getApps();
    if (apps.find(a => a.phone === phone && a.jobId === jobId)) return err('已投递过该职位');
    apps.push({ phone, jobId, at: Date.now() });
    await db.saveApps(apps);
    return ok({ ok: true });
  }

  if (action === 'fav') {
    const jobId = body.jobId;
    const favs = await db.getFavs();
    const i = favs.findIndex(f => f.phone === phone && f.jobId === jobId);
    let fav = false;
    if (i >= 0) favs.splice(i, 1); else { favs.push({ phone, jobId }); fav = true; }
    await db.saveFavs(favs);
    return ok({ ok: true, fav });
  }

  if (action === 'mine') {
    const apps = await db.getApps();
    const favs = await db.getFavs();
    return ok({
      ok: true,
      applied: apps.filter(a => a.phone === phone).map(a => a.jobId),
      favs: favs.filter(f => f.phone === phone).map(f => f.jobId)
    });
  }

  return err('unknown action');
}
