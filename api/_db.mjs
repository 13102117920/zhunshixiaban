// 共享数据层：通过 GitHub API 读写仓库内 data.json
// 环境变量：GH_TOKEN（有 repo 权限）、GH_REPO（owner/name）、GH_BRANCH
// 降级：无 GH_TOKEN 时内存态（数据不持久）

const GH_REPO = process.env.GH_REPO || '13102117920/zhunshixiaban';
const GH_BRANCH = process.env.GH_BRANCH || 'master';
const DATA_PATH = 'data.json';
function hasGH() { return !!process.env.GH_TOKEN; }

async function ghApi(method, path, body) {
  const res = await fetch(`https://api.github.com/repos/${GH_REPO}/contents/${path}?ref=${GH_BRANCH}`, {
    method,
    headers: {
      Authorization: `Bearer ${process.env.GH_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'User-Agent': 'zhunshi-bot'
    },
    body: body ? JSON.stringify(body) : undefined
  });
  return res;
}

async function readData() {
  if (!hasGH()) return memStore;
  try {
    const res = await ghApi('GET', DATA_PATH);
    if (res.status === 404) return { users: [], jobs: [], apps: [], favs: [], seeded: false, seq: 0 };
    if (!res.ok) throw new Error('read ' + res.status);
    const meta = await res.json();
    const content = JSON.parse(Buffer.from(meta.content.replace(/\s/g, ''), 'base64').toString('utf8'));
    return content;
  } catch (e) {
    console.error('readData err', e.message);
    return { users: [], jobs: [], apps: [], favs: [], seeded: false, seq: 0 };
  }
}

async function writeData(data) {
  if (!hasGH()) { memStore = data; return; }
  // 取当前文件 sha（更新用）
  let sha = undefined;
  const cur = await ghApi('GET', DATA_PATH);
  if (cur.ok) { const m = await cur.json(); sha = m.sha; }
  const body = {
    message: 'update data.json via zhunshi api',
    content: Buffer.from(JSON.stringify(data, null, 2)).toString('base64'),
    branch: GH_BRANCH
  };
  if (sha) body.sha = sha;
  const res = await ghApi('PUT', DATA_PATH, body);
  if (!res.ok) throw new Error('write ' + res.status);
}

const memStore = { users: [], jobs: [], apps: [], favs: [], seeded: false, seq: 0 };
// 写操作时串行化，避免并发覆盖
let writeChain = Promise.resolve();

async function withWrite(fn) {
  writeChain = writeChain.then(async () => {
    const data = await readData();
    const result = await fn(data);
    await writeData(data);
    return result;
  });
  return writeChain;
}

export const db = {
  get HAS_GH() { return hasGH(); },
  async getUsers() { const d = await readData(); return d.users; },
  async saveUsers(u) { await withWrite(d => { d.users = u; }); },
  async getJobs() { const d = await readData(); return d.jobs; },
  async saveJobs(j) { await withWrite(d => { d.jobs = j; }); },
  async getApps() { const d = await readData(); return d.apps; },
  async saveApps(a) { await withWrite(d => { d.apps = a; }); },
  async getFavs() { const d = await readData(); return d.favs; },
  async saveFavs(f) { await withWrite(d => { d.favs = f; }); },
  async getSeeded() { const d = await readData(); return d.seeded; },
  async setSeeded(v) { await withWrite(d => { d.seeded = v; }); },
  async nextId(prefix) {
    let id;
    await withWrite(d => { d.seq = (d.seq || 0) + 1; id = prefix + d.seq; });
    return id;
  }
};
