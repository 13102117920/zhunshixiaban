/* =========================================================
   准时下班 · 共享逻辑（用户系统 + 数据存储 + 标签常量）
   纯前端零后端：localStorage 持久化
   ========================================================= */

/* ---------- 标签常量（与发布/筛选页完全对应） ---------- */
const MANDATORY_LABELS = [
  '入职30日内签正式劳动合同',
  '入职即缴五险一金（试用期正常缴纳）',
  '按实际工资基数缴纳社保公积金',
  '标准双休、每日8小时工作制',
  '加班按法定标准支付加班费',
  '带薪年假依法足额兑现',
  '产假/陪产假/婚假带薪足额休假',
  '每月固定日期足额发薪不拖欠',
  '离职正常开离职证明、不克扣工资',
  '不收取押金、不扣押证件'
];
const BENEFIT_LABELS = [
  '双边12%公积金',
  '六险一金（含补充医疗险）',
  '年度13薪及以上',
  '带薪病假',
  '弹性工时/可居家办公',
  '年度免费体检',
  '年假天数高于法定标准',
  '无强制加班、下班不线上待命',
  '年度统一公开调薪',
  '节日福利、餐补交通补贴'
];
const SHORT = {
  '入职30日内签正式劳动合同': '签正式合同',
  '入职即缴五险一金（试用期正常缴纳）': '五险一金',
  '按实际工资基数缴纳社保公积金': '实缴社保',
  '标准双休、每日8小时工作制': '双休8h',
  '加班按法定标准支付加班费': '法定加班费',
  '带薪年假依法足额兑现': '带薪年假',
  '产假/陪产假/婚假带薪足额休假': '产假陪产婚假',
  '每月固定日期足额发薪不拖欠': '按时发薪',
  '离职正常开离职证明、不克扣工资': '离职不克扣',
  '不收取押金、不扣押证件': '不押证件',
  '双边12%公积金': '双边12%公积金',
  '六险一金（含补充医疗险）': '六险一金',
  '年度13薪及以上': '13薪+',
  '带薪病假': '带薪病假',
  '弹性工时/可居家办公': '弹性/居家',
  '年度免费体检': '免费体检',
  '年假天数高于法定标准': '超法定年假',
  '无强制加班、下班不线上待命': '不线上待命',
  '年度统一公开调薪': '公开调薪',
  '节日福利、餐补交通补贴': '节日餐补'
};

/* ---------- 安全层（纯前端无服务端，仅做基本防护） ---------- */
function hashPwd(pwd) {
  // 简单哈希，仅用于本地存储隔离，非安全加密
  let h = 0;
  for (let i = 0; i < pwd.length; i++) {
    h = (h << 5) - h + pwd.charCodeAt(i);
    h |= 0;
  }
  return 'h' + (h >>> 0).toString(16);
}

/* ---------- 存储键 ---------- */
const K_USERS = 'zsyx_users';
const K_SESSION = 'zsyx_session';
const K_JOBS = 'zsyx_jobs';
const K_APPLICATIONS = 'zsyx_applications';
const K_FAVS = 'zsyx_favs';

/* ---------- 用户系统 ---------- */
function getUsers() { return JSON.parse(localStorage.getItem(K_USERS) || '[]'); }
function saveUsers(u) { localStorage.setItem(K_USERS, JSON.stringify(u)); }

function getSession() { return JSON.parse(localStorage.getItem(K_SESSION) || 'null'); }
function setSession(s) { localStorage.setItem(K_SESSION, JSON.stringify(s)); }
function clearSession() { localStorage.removeItem(K_SESSION); }

function registerUser(phone, pwd) {
  phone = (phone || '').trim();
  if (!/^1\d{10}$/.test(phone)) return { ok: false, msg: '手机号格式不正确' };
  if ((pwd || '').length < 6) return { ok: false, msg: '密码至少6位' };
  const users = getUsers();
  if (users.find(u => u.phone === phone)) return { ok: false, msg: '该手机号已注册' };
  const user = { phone, pwd: hashPwd(pwd), role: null, createdAt: Date.now() };
  users.push(user);
  saveUsers(users);
  return { ok: true, user };
}

function loginUser(phone, pwd) {
  phone = (phone || '').trim();
  const users = getUsers();
  const user = users.find(u => u.phone === phone);
  if (!user) return { ok: false, msg: '账号不存在，请先注册' };
  if (user.pwd !== hashPwd(pwd)) return { ok: false, msg: '密码错误' };
  setSession({ phone: user.phone, role: user.role, loginAt: Date.now() });
  return { ok: true, user };
}

function setRole(role) {
  const s = getSession();
  if (!s) return false;
  s.role = role;
  setSession(s);
  const users = getUsers();
  const u = users.find(x => x.phone === s.phone);
  if (u) { u.role = role; saveUsers(users); }
  return true;
}

function logout() { clearSession(); }

/* ---------- 职位数据（含全国种子数据） ---------- */
function getJobs() { return JSON.parse(localStorage.getItem(K_JOBS) || 'null'); }

function seedJobs() {
  // 全国合规标杆企业种子（城市分布广，含外企/国企/大厂正规部门），均为合规示例
  return [
    // 北京
    { id:'s1', company:'微软(中国)有限公司', city:'北京', job:'高级软件工程师', salary:'30-50K·14薪', source:'seed',
      mandatory: MANDATORY_LABELS, benefits:['双边12%公积金','六险一金（含补充医疗险）','年度13薪及以上','带薪病假','弹性工时/可居家办公','年度免费体检','年假天数高于法定标准','无强制加班、下班不线上待命','年度统一公开调薪','节日福利、餐补交通补贴'] },
    { id:'s2', company:'亚马逊云科技', city:'北京', job:'解决方案架构师', salary:'35-55K·13薪', source:'seed',
      mandatory: MANDATORY_LABELS, benefits:['双边12%公积金','六险一金（含补充医疗险）','年度13薪及以上','带薪病假','弹性工时/可居家办公','年度免费体检','无强制加班、下班不线上待命','年度统一公开调薪','节日福利、餐补交通补贴'] },
    // 上海
    { id:'s3', company:'联合利华(中国)', city:'上海', job:'品牌市场经理', salary:'20-35K·13薪', source:'seed',
      mandatory: MANDATORY_LABELS, benefits:['双边12%公积金','六险一金（含补充医疗险）','年度13薪及以上','带薪病假','弹性工时/可居家办公','年度免费体检','年假天数高于法定标准','无强制加班、下班不线上待命','节日福利、餐补交通补贴'] },
    { id:'s4', company:'上海汽车集团', city:'上海', job:'动力电池研发工程师', salary:'18-30K·13薪', source:'seed',
      mandatory: MANDATORY_LABELS, benefits:['年度13薪及以上','带薪病假','年度免费体检','年假天数高于法定标准','年度统一公开调薪','节日福利、餐补交通补贴'] },
    // 深圳
    { id:'s5', company:'腾讯科技(深圳)', city:'深圳', job:'后台开发工程师', salary:'25-45K·16薪', source:'seed',
      mandatory: MANDATORY_LABELS, benefits:['双边12%公积金','六险一金（含补充医疗险）','年度13薪及以上','带薪病假','弹性工时/可居家办公','年度免费体检','年假天数高于法定标准','无强制加班、下班不线上待命','年度统一公开调薪','节日福利、餐补交通补贴'] },
    { id:'s6', company:'大疆创新', city:'深圳', job:'硬件测试工程师', salary:'15-25K·13薪', source:'seed',
      mandatory: MANDATORY_LABELS, benefits:['六险一金（含补充医疗险）','年度13薪及以上','带薪病假','年度免费体检','年度统一公开调薪','节日福利、餐补交通补贴'] },
    // 广州
    { id:'s7', company:'宝洁(中国)', city:'广州', job:'供应链管培生', salary:'12-18K·13薪', source:'seed',
      mandatory: MANDATORY_LABELS, benefits:['双边12%公积金','六险一金（含补充医疗险）','年度13薪及以上','带薪病假','弹性工时/可居家办公','年度免费体检','年假天数高于法定标准','无强制加班、下班不线上待命','节日福利、餐补交通补贴'] },
    // 杭州
    { id:'s8', company:'阿里巴巴(杭州)', city:'杭州', job:'产品经理', salary:'25-40K·16薪', source:'seed',
      mandatory: MANDATORY_LABELS, benefits:['双边12%公积金','六险一金（含补充医疗险）','年度13薪及以上','带薪病假','弹性工时/可居家办公','年度免费体检','年假天数高于法定标准','无强制加班、下班不线上待命','年度统一公开调薪','节日福利、餐补交通补贴'] },
    // 成都
    { id:'s9', company:'英特尔(成都)', city:'成都', job:'封装测试工程师', salary:'12-20K·13薪', source:'seed',
      mandatory: MANDATORY_LABELS, benefits:['双边12%公积金','六险一金（含补充医疗险）','年度13薪及以上','带薪病假','年度免费体检','年假天数高于法定标准','节日福利、餐补交通补贴'] },
    // 苏州
    { id:'s10', company:'博世(苏州)', city:'苏州', job:'机械设计工程师', salary:'14-22K·13薪', source:'seed',
      mandatory: MANDATORY_LABELS, benefits:['双边12%公积金','六险一金（含补充医疗险）','年度13薪及以上','带薪病假','弹性工时/可居家办公','年度免费体检','年假天数高于法定标准','无强制加班、下班不线上待命','节日福利、餐补交通补贴'] },
    // 武汉
    { id:'s11', company:'东风汽车(武汉)', city:'武汉', job:'智能网联工程师', salary:'13-22K·13薪', source:'seed',
      mandatory: MANDATORY_LABELS, benefits:['年度13薪及以上','带薪病假','年度免费体检','年假天数高于法定标准','年度统一公开调薪','节日福利、餐补交通补贴'] },
    // 南京
    { id:'s12', company:'SAP(南京)', city:'南京', job:'实施顾问', salary:'15-25K·13薪', source:'seed',
      mandatory: MANDATORY_LABELS, benefits:['双边12%公积金','六险一金（含补充医疗险）','年度13薪及以上','带薪病假','弹性工时/可居家办公','年度免费体检','无强制加班、下班不线上待命','节日福利、餐补交通补贴'] },
    // 西安
    { id:'s13', company:'华为(西安)', city:'西安', job:'嵌入式软件工程师', salary:'18-30K·14薪', source:'seed',
      mandatory: MANDATORY_LABELS, benefits:['六险一金（含补充医疗险）','年度13薪及以上','带薪病假','年度免费体检','年假天数高于法定标准','年度统一公开调薪','节日福利、餐补交通补贴'] },
    // 天津
    { id:'s14', company:'空客(天津)', city:'天津', job:'质量工程师', salary:'12-20K·13薪', source:'seed',
      mandatory: MANDATORY_LABELS, benefits:['双边12%公积金','六险一金（含补充医疗险）','年度13薪及以上','带薪病假','年度免费体检','年假天数高于法定标准','节日福利、餐补交通补贴'] },
    // 青岛
    { id:'s15', company:'海尔智家(青岛)', city:'青岛', job:'用户体验设计师', salary:'11-18K·13薪', source:'seed',
      mandatory: MANDATORY_LABELS, benefits:['六险一金（含补充医疗险）','年度13薪及以上','带薪病假','年度免费体检','年假天数高于法定标准','节日福利、餐补交通补贴'] },
    // 重庆
    { id:'s16', company:'长安汽车(重庆)', city:'重庆', job:'自动驾驶算法工程师', salary:'20-35K·14薪', source:'seed',
      mandatory: MANDATORY_LABELS, benefits:['双边12%公积金','六险一金（含补充医疗险）','年度13薪及以上','带薪病假','年度免费体检','年假天数高于法定标准','年度统一公开调薪','节日福利、餐补交通补贴'] },
    // 厦门
    { id:'s17', company:'戴尔(厦门)', city:'厦门', job:'IT支持工程师', salary:'10-16K·13薪', source:'seed',
      mandatory: MANDATORY_LABELS, benefits:['双边12%公积金','六险一金（含补充医疗险）','年度13薪及以上','带薪病假','弹性工时/可居家办公','年度免费体检','节日福利、餐补交通补贴'] },
    // 大连
    { id:'s18', company:'IBM(大连)', city:'大连', job:'数据分析师', salary:'12-20K·13薪', source:'seed',
      mandatory: MANDATORY_LABELS, benefits:['双边12%公积金','六险一金（含补充医疗险）','年度13薪及以上','带薪病假','弹性工时/可居家办公','年度免费体检','无强制加班、下班不线上待命','节日福利、餐补交通补贴'] }
  ];
}

function ensureSeed() {
  if (getJobs() === null) localStorage.setItem(K_JOBS, JSON.stringify(seedJobs()));
}
function addJob(job) {
  const jobs = getJobs() || [];
  jobs.unshift(job);
  localStorage.setItem(K_JOBS, JSON.stringify(jobs));
}

/* ---------- 投递 / 收藏 ---------- */
function applyJob(jobId) {
  const s = getSession(); if (!s) return { ok:false, msg:'请先登录' };
  const apps = JSON.parse(localStorage.getItem(K_APPLICATIONS) || '[]');
  if (apps.find(a => a.phone === s.phone && a.jobId === jobId)) return { ok:false, msg:'已投递过该职位' };
  apps.push({ phone: s.phone, jobId, at: Date.now() });
  localStorage.setItem(K_APPLICATIONS, JSON.stringify(apps));
  return { ok:true };
}
function toggleFav(jobId) {
  const s = getSession(); if (!s) return { ok:false, msg:'请先登录' };
  const favs = JSON.parse(localStorage.getItem(K_FAVS) || '[]');
  const i = favs.findIndex(f => f.phone === s.phone && f.jobId === jobId);
  if (i >= 0) favs.splice(i, 1); else favs.push({ phone: s.phone, jobId });
  localStorage.setItem(K_FAVS, JSON.stringify(favs));
  return { ok:true, fav: i < 0 };
}
function getMyApps() {
  const s = getSession(); if (!s) return [];
  const apps = JSON.parse(localStorage.getItem(K_APPLICATIONS) || '[]');
  return apps.filter(a => a.phone === s.phone).map(a => a.jobId);
}
function getMyFavs() {
  const s = getSession(); if (!s) return [];
  const favs = JSON.parse(localStorage.getItem(K_FAVS) || '[]');
  return favs.filter(f => f.phone === s.phone).map(f => f.jobId);
}

/* ---------- 导航注入（所有页面共用） ---------- */
function renderNav(active) {
  const s = getSession();
  const navRight = s
    ? `<span class="text-sm text-slate-500 mr-2">${s.phone}${s.role === 'recruiter' ? ' · 招聘' : s.role === 'seeker' ? ' · 求职' : ''}</span>
       <a href="dashboard.html" class="text-sm text-brand-600 font-medium hover:text-brand-800 mr-3">我的</a>
       <button onclick="logout();location.reload()" class="text-sm text-slate-400 hover:text-red-500">退出</button>`
    : `<a href="login.html" class="text-sm text-brand-600 font-medium hover:text-brand-800 mr-3">登录</a>
       <a href="register.html" class="text-sm bg-brand-600 text-white rounded-lg px-3 py-1.5 font-medium hover:bg-brand-700">注册</a>`;
  const el = document.getElementById('navRight');
  if (el) el.innerHTML = navRight;
}
