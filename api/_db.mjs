// 共享数据层：Vercel KV（Redis REST）原生 fetch 封装
// 绑定 KV 后会注入 KV_REST_API_URL / KV_REST_API_TOKEN
// 未绑定 KV 时走内存降级（数据不持久，仅用于未配置环境验证）

const KV_URL = process.env.KV_REST_API_URL || '';
const KV_TOKEN = process.env.KV_REST_API_TOKEN || '';
const HAS_KV = !!(KV_URL && KV_TOKEN);

async function kvCmd(args) {
  // Vercel KV REST: POST / urlencoded command=SET&args=...
  const body = new URLSearchParams();
  body.set('command', args[0]);
  // args[1..] 作为位置参数
  args.slice(1).forEach((a, i) => body.set('args', a));
  const res = await fetch(KV_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KV_TOKEN}`, 'content-type': 'application/x-www-form-urlencoded' },
    body
  });
  return await res.json();
}

const mem = { 'zsyx:users': [], 'zsyx:jobs': [], 'zsyx:apps': [], 'zsyx:favs': [], vals: {} };

async function getList(key) {
  if (HAS_KV) {
    const r = await kvCmd(['LRANGE', key, '0', '-1']);
    return (r.result || []).map(s => JSON.parse(s));
  }
  return mem[key] || [];
}
async function setList(key, arr) {
  if (HAS_KV) {
    await kvCmd(['DEL', key]);
    if (arr.length) {
      const args = ['RPUSH', key, ...arr.map(a => JSON.stringify(a))];
      await kvCmd(args);
    }
    return;
  }
  mem[key] = arr;
}
async function getValue(key) {
  if (HAS_KV) {
    const r = await kvCmd(['GET', key]);
    return r.result ? JSON.parse(r.result) : null;
  }
  return mem.vals[key] ?? null;
}
async function setValue(key, val) {
  if (HAS_KV) { await kvCmd(['SET', key, JSON.stringify(val)]); return; }
  mem.vals[key] = val;
}

export const db = {
  get HAS_KV() { return HAS_KV; },
  async getUsers() { return await getList('zsyx:users'); },
  async saveUsers(u) { await setList('zsyx:users', u); },
  async getJobs() { return await getList('zsyx:jobs'); },
  async saveJobs(j) { await setList('zsyx:jobs', j); },
  async getApps() { return await getList('zsyx:apps'); },
  async saveApps(a) { await setList('zsyx:apps', a); },
  async getFavs() { return await getList('zsyx:favs'); },
  async saveFavs(f) { await setList('zsyx:favs', f); },
  async getSeeded() { return await getValue('zsyx:seeded'); },
  async setSeeded(v) { await setValue('zsyx:seeded', v); },
  async nextId(prefix) {
    const n = (await getValue(prefix + ':seq')) || 0;
    const v = n + 1;
    await setValue(prefix + ':seq', v);
    return prefix + v;
  }
};
