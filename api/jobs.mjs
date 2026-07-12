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

const MANDATORY = [
  '入职30日内签正式劳动合同','入职即缴五险一金（试用期正常缴纳）','按实际工资基数缴纳社保公积金',
  '标准双休、每日8小时工作制','加班按法定标准支付加班费','带薪年假依法足额兑现',
  '产假/陪产假/婚假带薪足额休假','每月固定日期足额发薪不拖欠','离职正常开离职证明、不克扣工资','不收取押金、不扣押证件'
];

export default async function handler(req) {
  const url = new URL(req.url, 'http://localhost');
  const action = url.searchParams.get('action') || 'list';

  if (action === 'list') {
    const jobs = await db.getJobs();
    // 倒序：新发布在前
    jobs.sort((a, b) => (b.at || 0) - (a.at || 0));
    return ok({ ok: true, jobs });
  }

  if (action === 'add') {
    const token = req.headers.get('authorization') || '';
    const phone = decodeToken(token);
    if (!phone) return err('请先登录企业账号', 401);
    const users = await db.getUsers();
    const u = users.find(x => x.phone === phone);
    if (!u || u.role !== 'recruiter') return err('仅企业账号可发布职位', 403);
    let body = {};
    try { body = await req.json(); } catch (e) {}
    const company = (body.company || '').trim();
    const city = (body.city || '').trim();
    const job = (body.job || '').trim();
    const salary = (body.salary || '').trim();
    const mandatory = Array.isArray(body.mandatory) ? body.mandatory : [];
    const benefits = Array.isArray(body.benefits) ? body.benefits : [];
    if (!company || !city || !job || !salary) return err('基础信息不完整');
    if (mandatory.length !== MANDATORY.length) return err('劳动法强制项必须全部勾选');
    const newJob = { id: await db.nextId('j'), owner: phone, company, city, job, salary, mandatory, benefits, source: 'user', at: Date.now() };
    const jobs = await db.getJobs();
    jobs.push(newJob);
    await db.saveJobs(jobs);
    return ok({ ok: true, job: newJob });
  }

  return err('unknown action');
}
