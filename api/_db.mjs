// 共享数据层：Vercel KV（Redis REST）封装 —— 惰性初始化，无 KV 时内存降级
let kvClient = null;
let HAS_KV = false;

async function getKv() {
  if (kvClient === null) {
    if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
      const { kv } = await import('@vercel/kv');
      kvClient = kv;
      HAS_KV = true;
    } else {
      kvClient = false; // 标记：无 KV
      HAS_KV = false;
    }
  }
  return kvClient;
}

const mem = { 'zsyx:users': [], 'zsyx:jobs': [], 'zsyx:apps': [], 'zsyx:favs': [], vals: {} };

async function getList(key) {
  const kv = await getKv();
  if (kv) return (await kv.lrange(key, 0, -1)) || [];
  return mem[key] || [];
}
async function setList(key, arr) {
  const kv = await getKv();
  if (kv) {
    await kv.del(key);
    if (arr.length) await kv.rpush(key, ...arr);
    return;
  }
  mem[key] = arr;
}
async function getValue(key) {
  const kv = await getKv();
  if (kv) return await kv.get(key);
  return mem.vals[key] ?? null;
}
async function setValue(key, val) {
  const kv = await getKv();
  if (kv) return await kv.set(key, val);
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
