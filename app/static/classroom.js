'use strict';
(() => {
 const main=document.getElementById('classroomContent'),status=document.getElementById('classroomStatus'),errorBox=document.getElementById('classroomError');
 let user=null,catalog=[],authMode='login',busy=false;
 const e=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const d=value=>value?new Date(value).toLocaleString('zh-CN',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}):'未设置截止';
 const path=(type,id)=>'/classroom/'+type+'/'+encodeURIComponent(id);
 const reviewText=s=>s==='accepted'?'已通过':s==='needs_revision'?'需修改':'待批阅';
 const diagnosticText=s=>({completed:'本轮核查通过',teaching_intervention:'有问题待修正',needs_more_evidence:'需补充证据'}[s]||'尚未诊断');
 const issueLabels={data_error:'数据采集或录入',calculation_error:'计算与单位换算',concept_misunderstanding:'概念理解',mixed:'多因素问题',insufficient:'补充实验依据'};
 const outcomeText=s=>({corrected:'已修正',partially_corrected:'部分修正',unchanged:'尚未修正',abandoned:'暂时搁置'}[s]||s);
 const field=(label,name,type='text',extra='')=>`<div class="field"><label for="${name}">${label}</label><input id="${name}" name="${name}" type="${type}" ${extra}></div>`;
 const empty=text=>`<p class="classroom-empty">${e(text)}</p>`;
 const pill=(text,warn=false)=>`<span class="classroom-pill${warn?' warn':''}">${e(text)}</span>`;
 const breadcrumb=(links)=>`<nav class="classroom-breadcrumb" aria-label="班级位置">${links.map(([label,url])=>url?`<a href="${e(url)}">${e(label)}</a>`:`<span>${e(label)}</span>`).join('<span aria-hidden="true">/</span>')}</nav>`;
 async function api(url,method='GET',data){
  const response=await fetch('/api/v1/classroom'+url,{method,headers:{Accept:'application/json',...(data!==undefined?{'Content-Type':'application/json'}:{})},...(data!==undefined?{body:JSON.stringify(data)}:{})});
  const body=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(typeof body.detail==='string'?body.detail:Array.isArray(body.detail)?'请检查必填内容、长度和时间格式。':'操作暂时失败，请重试。');
  if(['/login','/register','/logout'].includes(url))window.dispatchEvent(new Event('lab-account-changed'));
  return body;
 }
 function clearPrivateDrafts(){
  for(const storage of [localStorage,sessionStorage])for(const key of Object.keys(storage))if(key.startsWith('at-lab-tutor-'))storage.removeItem(key);
 }
 async function action(fn){
  if(busy)return;busy=true;errorBox.hidden=true;
  const buttons=[...document.querySelectorAll('button')].map(b=>[b,b.disabled]);buttons.forEach(([b])=>b.disabled=true);
  try{await fn();}catch(err){errorBox.textContent=err.message;errorBox.hidden=false;errorBox.focus();status.textContent='操作未完成，请查看提示。';}
  finally{window.LabMath?.enhance(main);busy=false;buttons.filter(([b])=>b.isConnected).forEach(([b,disabled])=>b.disabled=disabled);}
 }
 function form(id,fn){const node=document.getElementById(id);if(node)node.addEventListener('submit',ev=>{ev.preventDefault();if(node.reportValidity())action(()=>fn(Object.fromEntries(new FormData(node))));});}
 function menu(){
  document.getElementById('accountMenu').innerHTML=user?`<span>${e(user.name)} · ${user.role==='teacher'?'教师':'学生'}</span><button type="button" id="logout">退出</button>`:'';
  document.getElementById('logout')?.addEventListener('click',()=>action(async()=>{await api('/logout','POST',{});clearPrivateDrafts();location.href='/classroom';}));
 }
 function auth(){
  status.textContent='登录后，可跨设备找回自己的班级与作业。';
  main.innerHTML=`<div class="classroom-hero"><p class="eyebrow">CLASSROOM / 班级空间</p><h1>把每次实验，连成一个学习过程。</h1><p>老师布置任务，学生逐步完成。每次提交保留测量、计算和修改，便于一起讨论哪里还需要核查。</p></div><div class="classroom-layout"><section><h2>在这里怎样上课</h2><ol class="classroom-steps"><li>建立班级，邀请学生<small>使用邀请码加入，实验记录归自己的账号保存。</small></li><li>选择实验，说明本次任务<small>从现有实验资料中选题，填写要求和截止时间。</small></li><li>提交过程，获得老师反馈<small>完成诊断后主动提交，修改后可以提交新版本。</small></li><li>用班级共性问题安排讲解<small>查看提交进度、待补证据与常见问题分布。</small></li></ol><p class="classroom-muted">个人练习也可以<a href="/experiment">直接开始</a>。班级作业需使用学生账号。</p></section><section class="classroom-panel"><div class="classroom-auth-tabs" role="tablist" aria-label="账号操作"><button id="loginTab" type="button" role="tab" aria-selected="${authMode==='login'}">登录</button><button id="registerTab" type="button" role="tab" aria-selected="${authMode==='register'}">创建账号</button></div><form id="authForm">${authMode==='register'?field('你的姓名','name','text','required maxlength="60" autocomplete="name"')+'<div class="field"><label for="role">使用身份</label><select id="role" name="role"><option value="student">学生 · 加入老师的班级</option><option value="teacher">教师 · 建立自己的班级</option></select></div>':''}${field('账号名','username','text','required minlength="3" maxlength="60" autocomplete="username" placeholder="字母、数字或邮箱"')}${field('密码','password','password',`required ${authMode==='register'?'minlength="10"':''} maxlength="128" autocomplete="${authMode==='register'?'new-password':'current-password'}"`)}${authMode==='register'?'<p class="hint">密码至少 10 位。请记好账号和密码，当前版本需联系网站管理者处理账号恢复。</p>':''}<button type="submit">${authMode==='register'?'创建账号':'登录班级空间'}</button></form></section></div>`;
  document.getElementById('loginTab').onclick=()=>{authMode='login';auth();};document.getElementById('registerTab').onclick=()=>{authMode='register';auth();};
  form('authForm',async values=>{await api('/'+authMode,'POST',values);clearPrivateDrafts();location.reload();});
 }
 async function home(){
  const data=await api('/classes');
  main.innerHTML=`<div class="classroom-top"><div><p class="eyebrow">CLASSROOM / ${user.role==='teacher'?'教学工作台':'我的班级'}</p><h1>${user.role==='teacher'?'从一个班级开始。':'找到这次实验任务。'}</h1><p class="classroom-muted">${user.role==='teacher'?'布置实验，关注提交进度，再看学生怎样修正。':'进入班级查看任务，按步骤实验，完成后提交给老师。'}</p></div><a href="/experiments">浏览实验资料 ↗</a></div><div class="classroom-layout"><section><h2>${user.role==='teacher'?'任教班级':'已加入的班级'}</h2>${data.classes.length?data.classes.map(c=>`<article class="classroom-row"><h3><a href="${path('classes',c.class_id)}">${e(c.name)} ↗</a></h3><p>${c.member_count} 位学生 · ${c.assignment_count} 份作业</p><div class="row-tail"><span class="classroom-muted">建立于 ${d(c.created_at)}</span><a href="${path('classes',c.class_id)}">进入班级 →</a></div></article>`).join(''):empty(user.role==='teacher'?'还没有班级。先在右侧建立一个班级，再邀请学生。':'还没有加入班级。请向老师索取邀请码。')}</section><aside class="classroom-panel"><h2>${user.role==='teacher'?'建立新班级':'加入班级'}</h2><form id="classForm">${user.role==='teacher'?field('班级名称','name','text','required maxlength="100" placeholder="例如：大学物理实验 · 周三班"'):field('老师的邀请码','code','text','required minlength="8" maxlength="8" placeholder="8 位邀请码"')+field('你的班级编号','student_number','text','required maxlength="60" placeholder="例如：2026001"')}<button type="submit">${user.role==='teacher'?'建立班级':'加入班级'}</button></form><p class="hint">${user.role==='teacher'?'建立后可复制邀请链接。每位学生使用自己的账号提交。':'请填写老师指定的学号或编号，方便老师核对名册。'}</p></aside></div>`;
  const joinCode=new URLSearchParams(location.search).get('join');if(joinCode&&document.getElementById('code'))document.getElementById('code').value=joinCode;
  form('classForm',async values=>{const cl=await api(user.role==='teacher'?'/classes':'/join','POST',values);location.href=path('classes',cl.class_id);});
 }
 function assignmentCard(a){
  const s=a.summary,my=a.my_submission;
  return `<article class="classroom-row"><h3><a href="${path('assignments',a.assignment_id)}">${e(a.title)} ↗</a></h3><p>${e(a.experiment_title)} · ${a.due_at?'截止 '+d(a.due_at):'未设置截止时间'}</p><div class="row-tail">${a.closed?pill('已结束收集'):s?`<span class="classroom-muted">${s.submitted_count} / ${s.member_count} 人已提交 · ${s.unreviewed_count} 份待批阅</span>`:my?pill(reviewText(my.review_status),my.review_status==='needs_revision'):pill('还未提交',true)}<a href="${path('assignments',a.assignment_id)}">${user.role==='teacher'?'查看作业':'进入任务'} →</a></div></article>`;
 }
 async function classPage(id){
  const cl=await api('/classes/'+id),teacher=user.role==='teacher';
  main.innerHTML=breadcrumb([['班级空间','/classroom'],[cl.name]])+`<div class="classroom-top"><div><p class="eyebrow">CLASS / ${teacher?'任教班级':'学习任务'}</p><h1>${e(cl.name)}</h1><p class="classroom-muted">${cl.member_count} 位学生 · ${cl.assignments.length} 份作业</p></div>${teacher?'<a href="#assignmentForm">布置新实验 ↓</a>':''}</div><div class="classroom-layout"><section><h2>实验任务</h2>${cl.assignments.length?cl.assignments.map(assignmentCard).join(''):empty('老师还没有布置实验。')}${teacher?`<section class="classroom-panel" style="margin-top:28px"><h2>班级名册</h2>${cl.members.length?`<div class="classroom-table-wrap"><table class="classroom-table"><thead><tr><th scope="col">姓名</th><th scope="col">班级编号</th><th scope="col">加入时间</th></tr></thead><tbody>${cl.members.map(m=>`<tr><td>${e(m.name)}</td><td>${e(m.student_number)}</td><td>${d(m.joined_at)}</td></tr>`).join('')}</tbody></table></div>`:empty('邀请学生加入后，名册会出现在这里。')}</section>`:''}</section><aside>${teacher?`<section class="classroom-panel"><h2>邀请学生</h2><p>学生登录后输入邀请码，或打开邀请链接。</p><strong class="invite-code">${e(cl.invite_code)}</strong><button id="copyInvite" type="button" class="secondary">复制邀请链接</button><p id="inviteFallback" class="hint" hidden></p></section><section class="classroom-panel"><h2>布置一次实验</h2><form id="assignmentForm">${field('作业标题','title','text','required maxlength="120" placeholder="例如：单摆 · 测量与误差核查"')}<div class="field"><label for="experiment_id">实验主题</label><select id="experiment_id" name="experiment_id" required>${catalog.map(t=>`<option value="${e(t.experiment_id)}">${e(t.title)}</option>`).join('')}</select></div><div class="field"><label for="instructions">任务要求</label><textarea id="instructions" name="instructions" required maxlength="6000" placeholder="说明测量要求、需提交的计算过程，以及本次关注的问题。"></textarea></div>${field('截止时间（选填，使用本机时区）','due_at','datetime-local')}<p class="hint">截止后仍允许提交，并标记为迟交。需要停止收集时，可在作业页结束收集。</p><button type="submit">发布作业</button></form></section>`:`<section class="classroom-panel"><h2>完成一次任务</h2><ol class="classroom-steps"><li>阅读老师的任务要求</li><li>填写测量、观察和计算</li><li>核查诊断，记录修改</li><li>主动提交给老师</li></ol><p>提交之后继续修改，不会改变已交的版本。修正后请再次提交。</p></section>`}</aside></div>`;
  document.getElementById('copyInvite')?.addEventListener('click',()=>action(async()=>{const url=location.origin+'/classroom?join='+encodeURIComponent(cl.invite_code);try{await navigator.clipboard.writeText(url);status.textContent='邀请链接已复制，可以发给学生。';}catch(_){const f=document.getElementById('inviteFallback');f.textContent=url;f.hidden=false;status.textContent='请复制下方邀请链接。';}}));
  form('assignmentForm',async values=>{values.due_at=values.due_at?new Date(values.due_at).toISOString():null;const a=await api('/classes/'+id+'/assignments','POST',values);location.href=path('assignments',a.assignment_id);});
 }
 function summaryHTML(s){
  const ratio=s.member_count?Math.round(100*s.submitted_count/s.member_count):0;
  return `<div class="classroom-metrics"><div><strong>${s.submitted_count}<small> / ${s.member_count}</small></strong><span>学生已提交</span></div><div><strong>${s.pending_count}</strong><span>尚未提交</span></div><div><strong>${s.unreviewed_count}</strong><span>最新版本待批阅</span></div><div><strong>${s.accepted_count}</strong><span>老师已通过</span></div></div><div class="classroom-progress"><progress value="${s.submitted_count}" max="${Math.max(s.member_count,1)}" aria-label="学生提交进度">${ratio}%</progress><span class="classroom-muted">提交进度 ${ratio}% · ${s.needs_revision_count} 人需修改 · ${s.late_count} 人迟交</span></div>`;
 }
 function memberHasIssue(member,issue){
  return issue==='all'||(issue==='insufficient'?member.needs_more_evidence:(member.issue_types||[]).includes(issue));
 }
 function diagnosisChangeHTML(change){
  if(!change)return '';
  const describe=(types,state)=>state==='needs_more_evidence'?'证据待补充':types.length?types.map(type=>issueLabels[type]||type).join('、'):'未标出这四类问题';
  return `<small class="classroom-diagnosis-change">诊断变化：首版末轮「${e(describe(change.first_issue_types,change.first_status))}」→ 最新版末轮「${e(describe(change.latest_issue_types,change.latest_status))}」。<br>输入与诊断可能同时变化，待老师核查。</small>`;
 }
 function roster(s,filter='all',issue='all'){
  const rows=s.members.filter(m=>memberHasIssue(m,issue)&&(filter==='all'||filter==='pending'&&!m.submission||filter==='unreviewed'&&m.submission&&!m.submission.review_status||filter==='needs_revision'&&m.submission?.review_status==='needs_revision'));
  return rows.length?`<div class="classroom-table-wrap" tabindex="0" aria-label="提交名册，可横向滚动"><table class="classroom-table"><thead><tr><th scope="col">学生</th><th scope="col">提交情况</th><th scope="col">学习过程与诊断</th><th scope="col">批阅</th></tr></thead><tbody>${rows.map(m=>{const sub=m.submission;return `<tr><td>${e(m.name)}<small>${e(m.student_number)}</small></td><td>${sub?`第 ${sub.version} 版${sub.late?' · 迟交':''}<small>${d(sub.submitted_at)}</small>`:'尚未提交'}</td><td>${sub?`${sub.attempt_count} 轮诊断 · ${sub.modification_count} 次修改<small>${m.needs_more_evidence?'末轮需补充证据；':''}${(m.issue_types||[]).length?'过程出现：'+m.issue_types.map(type=>e(issueLabels[type]||type)).join('、'):'过程未标出四类问题'}</small>${diagnosisChangeHTML(m.diagnosis_change)}`:'—'}</td><td>${sub?`<a href="${path('submissions',sub.submission_id)}">${reviewText(sub.review_status)} →</a>`:'—'}</td></tr>`;}).join('')}</tbody></table></div>`:empty('这个筛选下暂无学生。');
 }
 function errorsHTML(s){
  return `<section class="classroom-panel"><h2>这次实验，哪里需要讲解</h2>${s.submitted_count?s.errors.map(row=>`<div class="classroom-issue"><button type="button" class="classroom-issue-filter" data-issue-filter="${e(row.issue_type)}" aria-pressed="false" ${row.affected_students?'':'disabled'}><span>${e(row.label)}</span><strong>${row.affected_students} 人</strong><span class="classroom-bar-track" aria-hidden="true"><i style="width:${100*row.affected_students/s.submitted_count}%"></i></span><small>查看相关学生的最新提交 →</small></button>${row.affected_students?`<button type="button" class="secondary classroom-prepare" data-prepare-issue="${e(row.issue_type)}">准备补充练习</button>`:''}</div>`).join(''):empty('收到提交后，再统计班级共性问题。')}<p class="hint">按每位学生最新提交的完整过程统计，同一类问题每人只计一次，包含后来已修正的诊断。不同类别可重叠；需结合老师批阅。</p><button type="button" class="secondary classroom-issue-filter" data-issue-filter="insufficient" aria-pressed="false" ${s.insufficient_count?'':'disabled'}>末轮需补充证据 · ${s.insufficient_count} 人</button>${s.insufficient_count?'<button type="button" class="secondary classroom-prepare" data-prepare-issue="insufficient">准备补证任务</button>':''}<p class="hint">证据不足单独统计，不直接计为错误。</p></section><section class="classroom-panel classroom-supplement" id="supplementPanel" hidden></section>`;
 }
 const supplementPrompts={
  data_error:['重新核对量程、读数和录入，记录一组复测结果，并解释与原数据的差异。','逐项注明仪器、单位和读数方法；保留原记录，不把疑似异常点直接删除。'],
  calculation_error:['统一变量单位后独立复算，逐行写出公式、代入和结果，并对照原计算定位差异。','核查每个量的单位、数量级和有效数字；用另一组数据或方法复核结果。'],
  concept_misunderstanding:['说明所用物理模型的适用条件，先预测一个变化，再用实验记录检验预测。','写清预测依据、观察结果和不一致处；说明哪些结论仍需要证据。'],
  mixed:['分别列出测量、条件与计算中的待核查问题，先排查一项，再记录复测和复算过程。','每次只改变一个明确因素，保留前后证据，说明判断仍有哪些限制。'],
  insufficient:['补充本实验缺少的原始数据、单位、实验条件和计算过程，说明每项新增证据解决什么疑问。','区分实测值、参考值与估计值；未核实的条件标为待确认，不直接勾选通过。']
 };
 function supplementInstructions(a,issue,values){
  return `实验：${a.experiment_title}\n本次关注：${issueLabels[issue]}\n\n练习目标\n${values.goal.trim()}\n\n自检要求\n${values.self_check.trim()}\n\n${values.additional.trim()?'补充要求\n'+values.additional.trim()+'\n\n':''}提交要求\n保留原始记录，写出本次修改与复核依据；完成实验诊断后主动提交给老师。`;
 }
 function prepareSupplement(a,issue){
  const panel=document.getElementById('supplementPanel'),prompts=supplementPrompts[issue];
  if(!panel||!prompts)return;
  const affected=a.summary.members.filter(member=>member.submission&&memberHasIssue(member,issue));
  panel.hidden=false;
  panel.innerHTML=`<div class="classroom-supplement-title"><h2 tabindex="-1" id="supplementHeading">准备补充练习</h2><button type="button" id="closeSupplement" class="secondary" aria-label="关闭补充练习草稿">关闭</button></div><p class="classroom-draft-label">待老师编辑 · 尚未发布</p><dl class="classroom-recipients"><dt>目标班级</dt><dd>${e(a.class_name)}</dd><dt>接收范围</dt><dd>发布后全班 ${a.summary.member_count} 位学生可见。</dd><dt>建议重点关注</dt><dd>${affected.length} 位：${affected.map(member=>e(member.name)+'（'+e(member.student_number)+'）').join('、')||'暂无学生'}</dd></dl><p class="hint">建议名单仅供备课参考。此处发布的是全班任务，不会仅发送给筛选学生。沿用实验「${e(a.experiment_title)}」。</p><form id="supplementForm">${field('补练标题','supplement_title','text','required maxlength="120"')}<div class="field"><label for="supplement_goal">练习目标（请按班级情况编辑）</label><textarea id="supplement_goal" name="goal" required maxlength="1800">${e(prompts[0])}</textarea></div><div class="field"><label for="supplement_check">学生自检要求</label><textarea id="supplement_check" name="self_check" required maxlength="1800">${e(prompts[1])}</textarea></div><div class="field"><label for="supplement_additional">补充要求（选填）</label><textarea id="supplement_additional" name="additional" maxlength="1200"></textarea></div>${field('截止时间（选填，本机时区）','supplement_due','datetime-local')}<details class="classroom-supplement-preview" open><summary>发布内容预览</summary><p id="supplementPreview" class="classroom-note"></p></details><p class="hint">确认班级、接收范围和要求后，由你手动发布。</p><button type="submit">发布补练到全班</button></form>`;
  document.getElementById('supplement_title').value=(a.experiment_title+' · '+issueLabels[issue]+'补练').slice(0,120);
  const formNode=document.getElementById('supplementForm');
  const refresh=()=>{document.getElementById('supplementPreview').textContent=supplementInstructions(a,issue,Object.fromEntries(new FormData(formNode)));};
  formNode.addEventListener('input',refresh);refresh();
  document.getElementById('closeSupplement').onclick=()=>{panel.hidden=true;panel.innerHTML='';};
  form('supplementForm',async values=>{
   const instructions=supplementInstructions(a,issue,values);
   if(!values.goal.trim()||!values.self_check.trim())throw new Error('请填写具体练习目标和学生自检要求。');
   if(instructions.length>6000)throw new Error('任务要求过长，请精简后再发布。');
   const result=await api('/classes/'+a.class_id+'/assignments','POST',{title:values.supplement_title,experiment_id:a.experiment_id,instructions,due_at:values.supplement_due?new Date(values.supplement_due).toISOString():null});
   location.href=path('assignments',result.assignment_id);
  });
  document.getElementById('supplementHeading').focus();
  status.textContent='已准备补练草稿，请编辑后手动发布。';
 }
 function versionsHTML(submissions){
  return submissions.length?submissions.map(s=>`<article class="classroom-row"><h3><a href="${path('submissions',s.submission_id)}">第 ${s.version} 版 · ${e(s.name)} ↗</a></h3><p>${d(s.submitted_at)}${s.late?' · 迟交':''} · ${s.attempt_count} 轮诊断</p>${pill(reviewText(s.review_status),s.review_status==='needs_revision')}${s.feedback?`<p class="classroom-note">老师反馈：${e(s.feedback)}</p>`:''}</article>`).join(''):empty('还没有提交版本。先开始实验，完成诊断后主动提交。');
 }
 async function assignmentPage(id){
  const a=await api('/assignments/'+id),teacher=user.role==='teacher';
  main.innerHTML=breadcrumb([['班级空间','/classroom'],[a.class_name,path('classes',a.class_id)],[a.title]])+`<div class="classroom-top"><div><p class="eyebrow">ASSIGNMENT / ${e(a.experiment_title)}</p><h1>${e(a.title)}</h1><p class="classroom-muted">${a.due_at?'截止 '+d(a.due_at):'未设置截止时间'} · ${a.closed?'已结束收集':'正在收集'}</p></div>${teacher?`<button id="closeAssignment" type="button" class="secondary">${a.closed?'重新开放收集':'结束收集'}</button>`:''}</div><section class="classroom-panel"><h2>本次任务</h2><p class="classroom-note">${e(a.instructions)}</p><a href="/experiments/${encodeURIComponent(a.experiment_id)}">查看实验资料 ↗</a></section>${teacher?summaryHTML(a.summary):''}<div class="classroom-layout"><section>${teacher?`<div class="classroom-filter"><h2 id="rosterHeading" tabindex="-1">学生提交</h2><div class="classroom-filter-fields"><label>提交状态 <select id="rosterFilter"><option value="all">全部学生</option><option value="pending">尚未提交</option><option value="unreviewed">待批阅</option><option value="needs_revision">需修改</option></select></label><label>过程中的问题 <select id="issueFilter"><option value="all">全部问题</option>${Object.entries(issueLabels).map(([key,label])=>`<option value="${e(key)}">${e(label)}</option>`).join('')}</select></label></div></div><p class="hint" id="rosterSelection" aria-live="polite">显示全班最新提交；点击右侧问题可查看相关学生。</p><div id="roster">${roster(a.summary)}</div><p><a href="/api/v1/classroom/assignments/${encodeURIComponent(id)}/export.csv">下载提交名册（CSV） ↓</a></p><details style="margin-top:26px"><summary>查看所有提交版本</summary>${versionsHTML(a.submissions)}</details>`:`<h2>我的提交与老师反馈</h2>${versionsHTML(a.submissions)}`}</section><aside>${teacher?errorsHTML(a.summary):`<section class="classroom-panel"><h2>下一步</h2><p>${a.closed?'老师已结束收集，可以查看已交版本与反馈。':'从这份任务开始，按准备、数据、证据、计算、诊断逐步完成。'}</p><button id="startAssignment" type="button" ${a.closed?'disabled':''}>${a.submissions.length?'继续实验并修正':'开始这份实验'} →</button><p class="hint">诊断保存到自己的记录。只有点击“提交给老师”后，老师才会收到。</p><p class="hint">老师反馈针对提交版本。修改完成后再次提交，保留前一版便于对照。</p></section>`}</aside></div>`;
  const updateRoster=()=>{
   const issue=document.getElementById('issueFilter').value,filter=document.getElementById('rosterFilter').value;
   document.getElementById('roster').innerHTML=roster(a.summary,filter,issue);
   document.getElementById('rosterSelection').textContent=issue==='all'?'显示全班最新提交；可叠加提交状态筛选。':(issue==='insufficient'?'末轮仍需补充证据':('最新提交过程中出现过「'+issueLabels[issue]+'」'))+'，共 '+a.summary.members.filter(member=>member.submission&&memberHasIssue(member,issue)).length+' 位。表中同时应用提交状态筛选。';
   document.querySelectorAll('[data-issue-filter]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.issueFilter===issue)));
  };
  document.getElementById('rosterFilter')?.addEventListener('change',updateRoster);
  document.getElementById('issueFilter')?.addEventListener('change',updateRoster);
  document.querySelectorAll('[data-issue-filter]').forEach(button=>button.addEventListener('click',()=>{
   document.getElementById('issueFilter').value=button.dataset.issueFilter;document.getElementById('rosterFilter').value='all';updateRoster();document.getElementById('rosterHeading').focus();
  }));
  document.querySelectorAll('[data-prepare-issue]').forEach(button=>button.addEventListener('click',()=>prepareSupplement(a,button.dataset.prepareIssue)));
  document.getElementById('closeAssignment')?.addEventListener('click',()=>action(async()=>{await api('/assignments/'+id,'PATCH',{closed:!a.closed});await assignmentPage(id);status.textContent=a.closed?'已重新开放收集。':'已结束收集，学生仍可查看原提交。';}));
  document.getElementById('startAssignment')?.addEventListener('click',()=>action(async()=>{const work=await api('/assignments/'+id+'/start','POST',{});location.href='/experiment?work='+encodeURIComponent(work.session_id);}));
 }
 function readable(value){
  if(value===null||value===undefined)return '未记录';
  if(Array.isArray(value))return value.map(readable).join('，');
  if(typeof value==='object')return Object.entries(value).map(([k,v])=>k+'：'+readable(v)).join('；');
  return String(value);
 }
 function measurementsHTML(values,labels){
  const entries=Object.entries(values||{});
  return entries.length?`<table class="classroom-readings"><tbody>${entries.map(([key,value])=>`<tr><th scope="row">${e(labels[key]||key)}</th><td>${e(readable(value))}</td></tr>`).join('')}</tbody></table>`:'<p>没有提供原始测量。</p>';
 }
 function checksHTML(req){
  const observations=req.anomaly,checks=req.consistency?.checks||[];
  return `${observations?`<p>观察：${e({normal:'未见异常',anomalous:'发现异常',uncertain:'待确认'}[observations.status]||'待确认')}</p><p>${e(observations.summary||'')}</p><ul>${(observations.observed_features||[]).map(v=>`<li>${e(v)}</li>`).join('')}</ul>`:'<p>未提供观察证据。</p>'}${checks.length?`<ul>${checks.map(c=>`<li><strong>${e(c.name)}</strong> · ${c.passed===true?'核查通过':c.passed===false?'未通过':'待确认'}${c.observed!==null&&c.observed!==undefined?`<br>观察值：${e(readable(c.observed))}`:''}${c.expected!==null&&c.expected!==undefined?`；预期：${e(readable(c.expected))}`:''}${c.note?`<br>${e(c.note)}`:''}</li>`).join('')}</ul>`:'<p>未提供条件核查。</p>'}`;
 }
 function roundHTML(a,previous,labels){
  const req=a.request,res=a.response,math=req.mathematics,oldmath=previous?.request.mathematics,outcome=a.outcome;
  const changed=previous?JSON.stringify(previous.request)!==JSON.stringify(req):false;
  return `<article class="classroom-round"><h3>第 ${a.attempt_number} 轮 · ${diagnosticText(a.status)}</h3><p class="classroom-muted">${d(a.created_at)}</p>${previous?`<p>${changed?'本轮更新了输入证据。':'本轮输入与上一轮相同。'}</p>`:''}${math?`<h4>学生计算</h4><p>${e(math.formula||'未填公式')}</p><div class="comparison">${oldmath?`<div><p class="classroom-muted">上一轮结果</p><p>${e(oldmath.student_result??'未填写')} ${e(oldmath.unit||'')}</p></div>`:''}<div><p class="classroom-muted">本轮结果</p><p>${e(math.student_result??'未填写')} ${e(math.unit||'')}</p></div></div><p class="classroom-note">${e((math.student_steps||[]).join('\n'))}</p>`:''}${req.student_explanation?`<h4>学生说明</h4><p class="classroom-note">${e(req.student_explanation)}</p>`:''}<h4>诊断与引导</h4><p>${e(res.diagnosis?.summary||res.follow_up?.message||diagnosticText(a.status))}</p>${res.intervention?`<p>${e(res.intervention.content)}</p>`:''}${res.follow_up?.questions?.length?`<ul>${res.follow_up.questions.map(q=>`<li>${e(q)}</li>`).join('')}</ul>`:''}${outcome?`<div class="classroom-changed"><h4>本轮修改 · ${outcomeText(outcome.result)}</h4><p class="classroom-note">${e(outcome.student_revision)}</p>${outcome.final_result?`<p>修改后结果：${e(outcome.final_result)}</p>`:''}${outcome.self_check_notes?`<p>复查：${e(outcome.self_check_notes)}</p>`:''}</div>`:'<p class="hint">这轮尚未记录修改说明。</p>'}<details><summary>查看这轮测量与全部证据</summary><h4>原始测量</h4>${measurementsHTML(req.raw_measurements,labels)}<h4>观察与核查</h4>${checksHTML(req)}${math?`<h4>代入变量</h4>${measurementsHTML(math.variables,{})}`:''}<h4>诊断依据</h4><ul>${(res.evidence_assessment?.findings||[]).map(f=>`<li>${e(f.message)}</li>`).join('')}</ul></details></article>`;
 }
 async function submissionPage(id){
  const data=await api('/submissions/'+id),s=data.submission,a=data.assignment,teacher=user.role==='teacher';
  const topic=await fetch('/api/v1/experiments/'+encodeURIComponent(a.experiment_id)).then(r=>r.json());
  const labels=Object.fromEntries([...(topic.columns||[]),...(topic.parameters||[])].map(c=>[c.key,c.label+(c.unit?'（'+c.unit+'）':'')]));
  main.innerHTML=breadcrumb([['班级空间','/classroom'],[a.class_name,path('classes',a.class_id)],[a.title,path('assignments',a.assignment_id)],['第 '+s.version+' 版']])+`<div class="classroom-top"><div><p class="eyebrow">SUBMISSION / ${e(a.experiment_title)}</p><h1>${e(s.name)}的实验过程</h1><p class="classroom-muted">班级编号 ${e(s.student_number)} · 第 ${s.version} 版 · ${d(s.submitted_at)}${s.late?' · 迟交':''}</p></div>${pill(reviewText(s.review_status),s.review_status==='needs_revision')}</div><div class="classroom-layout"><section>${s.note?`<section class="classroom-panel"><h2>提交说明</h2><p class="classroom-note">${e(s.note)}</p></section>`:''}<h2>${s.attempt_count} 轮诊断，${s.modification_count} 次修改</h2><p class="hint">这里保留提交时的过程。之后的个人修改会在再次提交时形成新版本。</p><div class="classroom-timeline">${s.snapshot.attempts.map((r,i)=>roundHTML(r,s.snapshot.attempts[i-1],labels)).join('')}</div></section><aside><section class="classroom-panel"><h2>${teacher?'给这版作业反馈':'老师反馈'}</h2>${teacher?`<form id="reviewForm"><div class="field"><label for="reviewStatus">批阅结论</label><select name="status" id="reviewStatus"><option value="needs_revision" ${s.review_status==='needs_revision'?'selected':''}>需修改</option><option value="accepted" ${s.review_status==='accepted'?'selected':''}>已通过</option></select></div><div class="field"><label for="feedback">具体反馈</label><textarea name="feedback" id="feedback" required maxlength="6000" placeholder="指出要复查的地方，或说明通过的依据。">${e(s.feedback||'')}</textarea></div><button type="submit">保存反馈</button></form>`:s.feedback?`<p class="classroom-note">${e(s.feedback)}</p>`:'<p>老师尚未批阅这版作业。</p>'}${s.reviewed_at?`<p class="hint">最近批阅 ${d(s.reviewed_at)}</p>`:''}</section><section class="classroom-panel"><h2>核查时可以关注</h2><ul><li>测量记录是否足够</li><li>单位、公式与代入是否一致</li><li>每次修正是否有复查依据</li></ul><a href="${path('assignments',a.assignment_id)}">返回作业 →</a></section></aside></div>`;
  form('reviewForm',async values=>{await api('/submissions/'+id+'/review','POST',values);await submissionPage(id);status.textContent='反馈已保存，学生可以在这版提交中查看。';});
 }
 async function load(){
  user=(await api('/me')).user;menu();if(!user){auth();return;}
  const parts=location.pathname.split('/').filter(Boolean);
  if(parts[1]==='classes'&&parts[2]){catalog=(await fetch('/api/v1/experiments').then(r=>r.json())).topics;await classPage(parts[2]);}
  else if(parts[1]==='assignments'&&parts[2])await assignmentPage(parts[2]);
  else if(parts[1]==='submissions'&&parts[2])await submissionPage(parts[2]);
  else await home();
  status.textContent='已打开你的班级空间。';
 }
 action(load);
})();
