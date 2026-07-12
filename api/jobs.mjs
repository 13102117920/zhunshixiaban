import { db } from './_db.mjs';

const MANDATORY = [
  '入职30日内签正式劳动合同','入职即缴五险一金（试用期正常缴纳）','按实际工资基数缴纳社保公积金',
  '标准双休、每日8小时工作制','加班按法定标准支付加班费','带薪年假依法足额兑现',
  '产假/陪产假/婚假带薪足额休假','每月固定日期足额发薪不拖欠','离职正常开离职证明、不克扣工资','不收取押金、不扣押证件'
];

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
  const action = url.searchParams.get('action') || 'list';
  const body = await readBody(req);

  if (action === 'list') {
    const jobs = await db.getJobs();
    jobs.sort((a, b) => (b.at || 0) - (a.at || 0));
    return send(res, { ok: true, jobs });
  }

  if (action === 'add') {
    const token = (req.headers.authorization || req.headers.Authorization || '');
    const phone = decodeToken(token);
    if (!phone) return send(res, { ok: false, msg: '请先登录企业账号' }, 401);
    const users = await db.getUsers();
    const u = users.find(x => x.phone === phone);
    if (!u || u.role !== 'recruiter') return send(res, { ok: false, msg: '仅企业账号可发布职位' }, 403);
    const company = (body.company || '').trim();
    const city = (body.city || '').trim();
    const job = (body.job || '').trim();
    const salary = (body.salary || '').trim();
    const mandatory = Array.isArray(body.mandatory) ? body.mandatory : [];
    const benefits = Array.isArray(body.benefits) ? body.benefits : [];
    if (!company || !city || !job || !salary) return send(res, { ok: false, msg: '基础信息不完整' }, 400);
    if (mandatory.length !== MANDATORY.length) return send(res, { ok: false, msg: '劳动法强制项必须全部勾选' }, 400);
    const newJob = { id: await db.nextId('j'), owner: phone, company, city, job, salary, mandatory, benefits, source: 'user', at: Date.now() };
    const jobs = await db.getJobs();
    jobs.unshift(newJob);
    await db.saveJobs(jobs);
    return send(res, { ok: true, job: newJob });
  }

  return send(res, { ok: false, msg: 'unknown action' }, 400);
}
