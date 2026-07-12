/* =========================================================
   准时下班 · 前端逻辑（对接云端 API）
   纯静态前端 + Vercel 函数 + Vercel KV
   会话 token 存 localStorage（仅凭证，数据在云端）
   ========================================================= */

/* ---------- 标签常量 ---------- */
const MANDATORY_LABELS = [
  '入职30日内签正式劳动合同','入职即缴五险一金（试用期正常缴纳）','按实际工资基数缴纳社保公积金',
  '标准双休、每日8小时工作制','加班按法定标准支付加班费','带薪年假依法足额兑现',
  '产假/陪产假/婚假带薪足额休假','每月固定日期足额发薪不拖欠','离职正常开离职证明、不克扣工资','不收取押金、不扣押证件'
];
const BENEFITS_LABELS = ['双边12%公积金','六险一金（含补充医疗险）','年度13薪及以上','带薪病假','弹性工时/可居家办公','年度免费体检','年假天数高于法定标准','无强制加班、下班不线上待命','年度统一公开调薪','节日福利、餐补交通补贴'];
const SHORT = {
  '入职30日内签正式劳动合同':'签正式合同','入职即缴五险一金（试用期正常缴纳）':'五险一金','按实际工资基数缴纳社保公积金':'实缴社保',
  '标准双休、每日8小时工作制':'双休8h','加班按法定标准支付加班费':'法定加班费','带薪年假依法足额兑现':'带薪年假',
  '产假/陪产假/婚假带薪足额休假':'产假陪产婚假','每月固定日期足额发薪不拖欠':'按时发薪','离职正常开离职证明、不克扣工资':'离职不克扣','不收取押金、不扣押证件':'不押证件',
  '双边12%公积金':'双边12%公积金','六险一金（含补充医疗险）':'六险一金','年度13薪及以上':'13薪+','带薪病假':'带薪病假','弹性工时/可居家办公':'弹性/居家','年度免费体检':'免费体检',
  '年假天数高于法定标准':'超法定年假','无强制加班、下班不线上待命':'不线上待命','年度统一公开调薪':'公开调薪','节日福利、餐补交通补贴':'节日餐补'
};

/* ---------- 会话 ---------- */
const K_TOKEN = 'zsyx_token';
const K_SESSION = 'zsyx_session';
function getToken() { return localStorage.getItem(K_TOKEN) || ''; }
function getSession() { try { return JSON.parse(localStorage.getItem(K_SESSION) || 'null'); } catch(e){ return null; } }
function setSession(s) { localStorage.setItem(K_SESSION, JSON.stringify(s)); }
function clearSession() { localStorage.removeItem(K_TOKEN); localStorage.removeItem(K_SESSION); }

/* ---------- API 客户端 ---------- */
async function api(path, method = 'GET', body = null) {
  const headers = { 'content-type': 'application/json' };
  const t = getToken();
  if (t) headers['authorization'] = t;
  const res = await fetch('/api/' + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });
  let data = {};
  try { data = await res.json(); } catch(e) {}
  return { status: res.status, data };
}

/* ---------- 用户系统 ---------- */
async function registerUser(phone, pwd) {
  const { data } = await api('users?action=register', 'POST', { phone, pwd });
  if (data.ok) { localStorage.setItem(K_TOKEN, data.user ? '' : ''); }
  return data;
}
async function loginUser(phone, pwd) {
  const { data } = await api('users?action=login', 'POST', { phone, pwd });
  if (data.ok) {
    localStorage.setItem(K_TOKEN, data.token);
    setSession({ phone: data.phone ?? phone, role: data.role });
  }
  return data;
}
async function setRole(role) {
  const { data } = await api('users?action=setrole', 'POST', { role });
  if (data.ok) { const s = getSession() || {}; s.role = role; setSession(s); }
  return data;
}
async function refreshMe() {
  const { data } = await api('users?action=me', 'GET');
  if (data.ok) setSession({ phone: data.phone, role: data.role });
  else clearSession();
  return data;
}
function logout() { clearSession(); }

/* ---------- 职位 ---------- */
async function fetchJobs() {
  const { data } = await api('jobs?action=list', 'GET');
  return data.ok ? data.jobs : [];
}
async function addJob(job) {
  const { data } = await api('jobs?action=add', 'POST', job);
  return data;
}

/* ---------- 投递 / 收藏 ---------- */
async function applyJob(jobId) {
  const { data } = await api('apply?action=apply', 'POST', { jobId });
  return data;
}
async function toggleFav(jobId) {
  const { data } = await api('apply?action=fav', 'POST', { jobId });
  return data;
}
// 返回当前用户已投递/已收藏的 jobId 数组
let _myState = { applied: [], favs: [] };
async function loadMyState() {
  const s = getSession();
  if (!s) { _myState = { applied: [], favs: [] }; return; }
  const { data } = await api('apply?action=mine', 'GET');
  if (data.ok) _myState = { applied: data.applied || [], favs: data.favs || [] };
}
function getMyApps() { return _myState.applied; }
function getMyFavs() { return _myState.favs; }

/* ---------- 导航注入 ---------- */
function renderNav() {
  const s = getSession();
  const el = document.getElementById('navRight');
  if (!el) return;
  if (s) {
    const roleTxt = s.role === 'recruiter' ? ' · 招聘' : s.role === 'seeker' ? ' · 求职' : '';
    el.innerHTML = `<span class="text-sm text-slate-500 mr-2">${s.phone}${roleTxt}</span>
      <a href="dashboard.html" class="text-sm text-brand-600 font-medium hover:text-brand-800 mr-3">我的</a>
      <button onclick="logout();location.href='index.html'" class="text-sm text-slate-400 hover:text-red-500">退出</button>`;
  } else {
    el.innerHTML = `<a href="login.html" class="text-sm text-brand-600 font-medium hover:text-brand-800 mr-3">登录</a>
      <a href="register.html" class="text-sm bg-brand-600 text-white rounded-lg px-3 py-1.5 font-medium hover:bg-brand-700">注册</a>`;
  }
}
