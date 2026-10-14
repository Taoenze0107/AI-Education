'use strict';
// Attach classroom work to the existing step-by-step notebook without duplicating its form.
(() => {
 let assignment=null;
 async function refreshContext(){
  if(!state.session){document.getElementById('classroomContext')?.remove();assignment=null;return;}
  const sid=state.session.session_id;
  const context=await request('/api/v1/classroom/work/'+encodeURIComponent(sid));
  if(state.session?.session_id!==sid)return;
  const old=document.getElementById('classroomContext');
  assignment=context.assignment;
  if(!assignment){old?.remove();return;}
  const box=old||document.createElement('section');box.id='classroomContext';box.className='classroom-context';box.setAttribute('aria-label','本次班级作业');
  const line=node('div',null,'context-line');line.append(node('strong',assignment.title));
  const link=node('a','查看任务与老师反馈 →');link.href='/classroom/assignments/'+encodeURIComponent(assignment.assignment_id);line.append(link);
  const details=node('details');details.append(node('summary','任务要求'),node('p',assignment.instructions,'classroom-note'));
  const hint=node('p',assignment.closed?'老师已结束收集。你仍可查看自己的记录与已交版本。':'完成诊断后，可在诊断或修改页提交给老师。继续修改会保留之前交过的版本。');
  const note=node('textarea');note.id='classroomSubmitNote';note.maxLength=4000;note.placeholder='给老师的提交说明（选填）';note.setAttribute('aria-label','给老师的提交说明');note.value=old?.querySelector('textarea')?.value||'';
  const button=node('button','提交给老师 →','button');button.type='button';button.disabled=!!assignment.closed||!state.attempt;
  const result=node('p','', 'hint');result.setAttribute('role','status');
  button.addEventListener('click',()=>action('正在提交给老师…',async()=>{
   const response=await request('/api/v1/classroom/assignments/'+encodeURIComponent(assignment.assignment_id)+'/submit',{method:'POST',body:pretty({session_id:state.session.session_id,note:note.value})});
   result.textContent=response.duplicate?`第 ${response.version} 版已收到，内容未变化，无需重复提交。`:`第 ${response.version} 版已提交${response.late?'，标记为迟交':''}。老师可以查看这次提交的诊断与修改。`;
   announce(result.textContent);
  }));
  const controls=node('div',null,'classroom-submit-controls');controls.append(note,button,result);
  box.replaceChildren(line,details,hint,controls);
  if(!old)document.querySelector('.flow-frame').before(box);
  for(const id of ['studentId','experimentId','courseId'])$(id).disabled=true;
  $('newSessionButton').hidden=true;
 }
 const originalLocks=refreshLocks;
 refreshLocks=function(){originalLocks();if(assignment){for(const id of ['studentId','experimentId','courseId'])$(id).disabled=true;const b=document.querySelector('#classroomContext button');if(b)b.disabled=state.busy||!!assignment.closed||!state.attempt;}};
 const originalSetSession=setSession,originalReset=resetSession,originalSelect=selectAttempt;
 setSession=function(...args){originalSetSession(...args);refreshContext().catch(err=>announce(err.message));};
 resetSession=function(...args){originalReset(...args);document.getElementById('classroomContext')?.remove();assignment=null;for(const id of ['studentId','experimentId','courseId'])$(id).disabled=false;$('newSessionButton').hidden=false;};
 selectAttempt=function(...args){originalSelect(...args);const b=document.querySelector('#classroomContext button');if(b)b.disabled=!!assignment?.closed||!state.attempt;};
 function bootstrap(){
  request('/api/v1/classroom/me').then(data=>{
   const account=document.getElementById('classroomAccountLink');
   if(account)account.textContent=data.user?'班级空间 · '+data.user.name:'班级空间 / 登录';
   if(data.user&&!$('studentId').value){$('studentId').value=data.user.name;persist();}
   refreshContext().catch(err=>announce(err.message));
  }).catch(()=>{});
 }
 window.addEventListener('tutor-ready',bootstrap,{once:true});
 if(window.tutorReady)bootstrap();
})();
