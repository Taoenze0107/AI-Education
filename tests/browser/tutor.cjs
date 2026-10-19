// Browser integration: real local checks/history plus explicitly mocked model replies.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {autoRecordingAllowed} = require('../../app/static/tutor.js');
// Scope policy is tested without a DOM, timers, credentials or model requests.
for (const stage of ['home','history','library','classroom','topic','catalog','practice','experiment']) {
 assert.equal(autoRecordingAllowed(stage,null),false,`${stage} must not trigger automatic model calls`);
}
for (const stage of ['data','review','observations','checks','calculation','diagnosis','revision']) {
 assert.equal(autoRecordingAllowed(stage,null),true,`${stage} is an opt-in measured-record step`);
 for (const lesson of ['prediction','transfer']) assert.equal(autoRecordingAllowed(stage,lesson),false,`${lesson} experiences must not trigger automatic model calls`);
}
assert.equal(autoRecordingAllowed(undefined,null),false);
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.BASE_URL || 'http://127.0.0.1:8015';
const out = process.env.TUTOR_QA_OUTPUT || '/private/tmp/lab-tutor-browser-qa';
fs.mkdirSync(out, {recursive:true});
(async () => {
 const browser = await chromium.launch({headless:true});
 try {
  const context = await browser.newContext({viewport:{width:1280,height:900}});
  const page = await context.newPage(), errors=[], report={checks:[]};
  page.on('pageerror', e=>errors.push(e.message));
  let modelRequests=0;
  page.on('request', r=>{if(r.url().endsWith('/tutor/chat'))modelRequests++;});
  await page.goto(base+'/data');
  await page.locator('#tutorMode').filter({hasText:'课程资料模式'}).waitFor({state:'attached'});
  await page.locator('#quickVoltage').fill('1, 2, 3, 4, 5');
  await page.locator('#quickCurrent').fill('4, 8, 12, 16');
  const checks=page.locator('.tutor-feedback[data-tutor-stage="data"]');
  await checks.filter({hasText:'各列数量不同'}).waitFor();
  await page.locator('#quickCurrent').fill('4, 8, 12, 16, 20');
  await checks.filter({hasText:'区分读数单位与计算单位'}).waitFor();
  assert.equal(modelRequests,0);
  report.checks.push('live mismatch and unit checks without model calls');
  await page.locator('#tutorToggle').click();
  await page.locator('#tutorQuestion').fill('为什么要把 mA 换算为 A？');
  await page.locator('#tutorSend').click();
  await page.locator('.tutor-answer-origin').filter({hasText:'不是模型回答'}).waitFor({state:'attached'});
  await page.screenshot({path:path.join(out,'desktop-reference.png')});
  await page.locator('#tutorClose').click();
  assert.equal(await page.locator('#quickVoltage').inputValue(),'1, 2, 3, 4, 5');
  await page.reload();
  await page.locator('.tutor-answer-origin').filter({hasText:'不是模型回答'}).waitFor({state:'attached'});
  report.checks.push('reference disclosure, persistent conversation, unchanged measurements');
  for (const width of [320,375,768,1280]) {
   await page.setViewportSize({width,height:900});
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`overflow at ${width}`);
   await page.locator('#tutorToggle').click();
   const rect=await page.locator('#tutorPanel').boundingBox();
   assert(rect.x>=0&&rect.x+rect.width<=width+1&&rect.y>=0);
   if(width===375)await page.screenshot({path:path.join(out,'mobile-reference.png')});
   await page.keyboard.press('Escape');
  }
  report.checks.push('320/375/768/1280 layouts and keyboard close');

  // No OpenAI request is made in browser QA. Backend tests cover the SDK contract.
  await page.route('**/api/v1/tutor/status',r=>r.fulfill({json:{configured:true,signed_in:true,daily_limit:30,scope:'browser-model-fixture'}}));
  const calls=[];
  const reply={turn_id:'fixture',mode:'openai',notice:'AI 已结合当前实验回答。',citations:[],reply:{answer:'请先核对电流单位。\\(20\\,\\mathrm{mA}=0.02\\,\\mathrm{A}\\)\n<img src=x onerror="window.bad=true">',next_question:'你代入公式时用的是 A 还是 mA？',suggestions:['保留原始记录，再复算。'],knowledge_ids:[]}};
  await page.route('**/api/v1/tutor/chat',r=>{calls.push(r.request().postDataJSON());return r.fulfill({json:reply});});
  await page.reload();
  await page.locator('#tutorMode').filter({hasText:'AI 已连接'}).waitFor({state:'attached'});
  await checks.filter({hasText:'区分读数单位与计算单位'}).waitFor();
  await page.locator('#tutorToggle').click();
  await page.locator('.tutor-settings > summary').click();
  await page.locator('#tutorSettings .tutor-auto-option input').check();
  await page.locator('#tutorClose').click();
  await checks.locator('.tutor-auto-reply').filter({hasText:'AI 随行提示'}).waitFor();
  assert.equal(calls.length,1);
  assert.deepEqual(calls[0].context.columns.current_mA,[4,8,12,16,20]);
  await page.locator('#tutorToggle').click();
  await page.locator('#tutorSettings .tutor-auto-option input').uncheck();
  await page.locator('#tutorQuestion').fill('为什么除以 1000？');
  await page.locator('#tutorSend').click();
  await page.locator('#tutorSend').filter({hasText:'发送问题'}).waitFor();
  assert.equal(calls.length,2);
  assert.equal(await page.locator('#tutorMessages img').count(),0);
  assert.equal(await page.evaluate(()=>window.bad===true),false);
  assert(await page.locator('#tutorMessages .katex').count()>0);
  assert.equal(await page.locator('#quickVoltage').inputValue(),'1, 2, 3, 4, 5');
  await page.setViewportSize({width:1280,height:950});
  await page.screenshot({path:path.join(out,'desktop-ai-mocked.png')});
  report.checks.push('opt-in automatic AI and follow-up, correct draft context, formulas and escaped HTML');
  await page.locator('#tutorClose').click();
  await page.goto(base+'/experiments/simple_pendulum');
  await page.locator('#topicHeading').filter({hasText:'单摆'}).waitFor();
  await page.locator('#tutorToggle').click();
  await page.locator('#tutorContext').filter({hasText:'单摆'}).waitFor();
  await page.locator('#tutorClose').click();
  await page.goto(base+'/classroom');
  await page.locator('#tutorToggle').click();
  await page.locator('#tutorPanel').waitFor({state:'visible'});
  report.checks.push('assistant available on topic and classroom pages');
  report.errors=errors; assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(out,'browser-result.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify(report));
 } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
