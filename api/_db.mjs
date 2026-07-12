// 共享数据层：Vercel KV（Redis REST）封装
// 绑定 KV 后 Vercel 自动注入 KV_REST_API_URL / KV_REST_API_TOKEN
import { kv } from '@vercel/kv';

const HAS_KV = !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);

// 无 KV 时的内存退化（仅在本地未绑定时用，部署后不生效）
const mem = { users: [], jobs: [], apps: [], favs: [] };

async function getList(key) {
  if (HAS_KV) return (await kv.lrange(key, 0, -1)) || [];
  return mem[key] || [];
}
async function setList(key, arr) {
  if (HAS_KV) {
    await kv.del(key);
    if (arr.length) await kv.rpush(key, ...arr);
    return;
  }
  mem[key] = arr;
}
async function getValue(key) {
  if (HAS_KV) return await kv.get(key);
  return mem[key] || null;
}
async function setValue(key, val) {
  if (HAS_KV) return await kv.set(key, val);
  mem[key] = val;
}

export const db = {
  HAS_KV,
  // 用户
  async getUsers() { return await getList('zsyx:users'); },
  async saveUsers(u) { await setList('zsyx:users', u); },
  // 职位
  async getJobs() { return await getList('zsyx:jobs'); },
  async saveJobs(j) { await setList('zsyx:jobs', j); },
  // 投递
  async getApps() { return await getList('zsyx:apps'); },
  async saveApps(a) { await setList('zsyx:apps', a); },
  // 收藏
  async getFavs() { return await getList('zsyx:favs'); },
  async saveFavs(f) { await setList('zsyx:favs', f); },
  // 种子标记
  async getSeeded() { return await getValue('zsyx:seeded'); },
  async setSeeded(v) { await setValue('zsyx:seeded', v); },
  // 简易自增 id
  async nextId(prefix) {
    const n = (await getValue(prefix + ':seq')) || 0;
    const v = n + 1;
    await setValue(prefix + ':seq', v);
    return prefix + v;
  }
};
