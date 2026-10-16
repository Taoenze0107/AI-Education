"use strict";
// Each URL represents one task. The same form remains mounted so navigation never clears input.
const PAGE_ROUTES={"/":"home","/experiment":"experiment","/data":"data","/review":"review","/observations":"observations","/checks":"checks","/calculation":"calculation","/diagnosis":"diagnosis","/revision":"revision","/history":"history","/library":"library","/help":"help"};
function pageForPath(path){
 if(PAGE_ROUTES[path])return PAGE_ROUTES[path];
 if(/^\/experiments\/[a-z0-9_]+$/.test(path))return "topic";
 if(/^\/practice\/[a-z0-9_-]+$/.test(path))return "practice";
 return null;
}
PAGE_ROUTES["/experiments"]="catalog";
const FLOW_PAGES=new Set(["experiment","data","review","observations","checks","calculation","diagnosis","revision"]);
const DRAFT_KEY="at-lab-tutor-draft-v3";
const DYNAMIC_ROWS=["variableRows","checkRows","measurementRows","metadataRows"];
let flowReady=false;
let currentPage=pageForPath(location.pathname)||"home";
let lastCharts=null;
function captureDraft(){
 const fields={};
 for(const el of document.querySelectorAll("input[id],select[id],textarea[id]")){
  if(el.closest("#labTutor,.tutor-feedback,#academyRoot,.learning-review"))continue;
  if(el.type==="file"||el.id.startsWith("row-")||DYNAMIC_ROWS.some(id=>$(id).contains(el)))continue;
  fields[el.id]={value:el.value,checked:el.checked};
 }
 const rows={};
 for(const id of DYNAMIC_ROWS) rows[id]=[...$(id).children].map(row=>Object.fromEntries([...row.querySelectorAll("[data-role]")].map(el=>[el.dataset.role,el.value])));
 return {sessionId:state.session?.session_id||null,fields,rows,mode:state.mode,file:importedMaterialFile,runs:[...importedCsvRuns.entries()],charts:lastCharts,status:$("materialAnalysisStatus").textContent,uploadStatus:$("csvImportStatus").textContent};
}
function saveDraft(){
 if(!flowReady)return;
 try{sessionStorage.setItem(DRAFT_KEY,JSON.stringify(captureDraft()));}catch(_){ /* A large file may exceed storage. The running form is unaffected. */ }
}
function restoreDraft(){
 let draft;
 try{draft=JSON.parse(sessionStorage.getItem(DRAFT_KEY));}catch(_){return;}
 if(!draft||draft.sessionId!==(state.session?.session_id||null))return;
 for(const [id,values] of Object.entries(draft.fields||{})){
  const el=$(id);if(!el||!["INPUT","SELECT","TEXTAREA"].includes(el.tagName))continue;
  if(id==="experimentId")addExperiment(values.value);
  el.value=values.value??"";
  if(el.type==="checkbox")el.checked=!!values.checked;
 }
 for(const id of DYNAMIC_ROWS){
  if(!Array.isArray(draft.rows?.[id]))continue;
  $(id).replaceChildren();
  for(const values of draft.rows[id]){
   const row=id==="variableRows"?addVariable():id==="checkRows"?addCheck():addKeyValue(id);
   for(const el of row.querySelectorAll("[data-role]"))if(Object.hasOwn(values,el.dataset.role))el.value=values[el.dataset.role];
  }
 }
 importedMaterialFile=draft.file||null;
 importedCsvRuns=new Map(draft.runs||[]);
 $("csvRunSelect").replaceChildren(...[...importedCsvRuns.keys()].map(value=>{const option=node("option",value);option.value=value;return option;}));
 if(draft.fields?.csvRunSelect)$("csvRunSelect").value=draft.fields.csvRunSelect.value;
 $("csvRunFields").hidden=importedCsvRuns.size<=1;
 $("csvImportStatus").textContent=draft.uploadStatus||"";
 $("materialAnalysisStatus").textContent=draft.status||"";
 if(draft.charts){lastCharts=draft.charts;renderMaterialCharts(lastCharts);}
 state.mode=draft.mode==="json"?"json":"guided";
 document.querySelector(`input[name="entryMode"][value="${state.mode}"]`).checked=true;
 $("jsonFields").hidden=state.mode!=="json";
 document.querySelector('[data-view="calculation"] .evidence-group').hidden=state.mode==="json";
 $("studentExplanation").parentElement.hidden=state.mode==="json";
 if(state.mode==="json")document.querySelector(".advanced-mode").open=true;
 sourceVisibility();
}
function renderOverview(){
 const checks=[...$("checkRows").children].filter(row=>fieldValue(row,"name").value.trim());
 const confirmed=checks.filter(row=>["true","false"].includes(fieldValue(row,"passed").value)).length;
 const mathReady=$("includeMath").checked&&$("studentResult").value.trim()&&$("studentSteps").value.trim();
 const definitions=[
  ["异常观察",$("includeAnomaly").checked&&$("observedFeatures").value.trim(),$("anomalySummary").value||"还没有观察证据。可进入观察页补充。"],
  ["一致性核查",$("includeConsistency").checked&&confirmed,`${checks.length} 项具名检查，${confirmed} 项已有结论。未经核实的项目请保留待确认。`],
  ["数学计算",mathReady,mathReady?`你的结果：${$("studentResult").value} ${$("mathUnit").value}；保留了 ${lines($("studentSteps").value).length} 步计算。可继续核对或提交诊断。`:"下一步填写自己的计算结果与步骤；参考值会保留。"]
 ];
 $("evidenceOverview").replaceChildren(...definitions.map(([title,ready,description])=>{
  const row=node("div",null,"evidence-item");row.append(node("strong",title),node("p",description),node("span",ready?"已填写":"待补充",`evidence-state ${ready?"":"pending"}`));return row;
 }));
}
function configureExperiment(){
 const ohms=$("experimentId").value==="ohms_law";
 $("quickInputHeading").closest("section").hidden=!ohms;
 $("csvImportHeading").closest("section").hidden=!ohms;
 $("autoAnomalyButton").hidden=!ohms;
 $("autoAnomalyHint").hidden=!ohms;
 document.querySelector('[data-view="observations"] .page-description').textContent=ohms
  ?"可以使用自动分析，也可以补充自己的观察。"
  :"根据实验记录补充观察到的特征与异常判断。";
 document.querySelector('[data-view="data"] .page-description').textContent=ohms
  ?"上传实验表，或直接填写读数。伏安法数据可自动分析。"
  :"填写本次实验的测量记录，再核对观察与计算证据。";
 const raw=document.querySelector(".advanced-data");
 if(!ohms&&!["rc_time_constant","simple_pendulum"].includes($("experimentId").value)&&!window.catalogHasInput?.($("experimentId").value))raw.open=true;
 $("flowExperimentLabel").textContent=EXPERIMENTS[$("experimentId").value]||$("experimentId").value;
}
function renderPage({focus=false}={}){
 document.querySelectorAll("[data-view]").forEach(el=>el.hidden=el.dataset.view!==currentPage);
 document.body.dataset.page=currentPage;
 document.querySelector(".flow-frame").hidden=!FLOW_PAGES.has(currentPage);
 const step=currentPage==="observations"||currentPage==="checks"?"review":currentPage==="revision"?"diagnosis":currentPage;
 for(const link of document.querySelectorAll(".step-nav a")){
  if(PAGE_ROUTES[link.pathname]===step)link.setAttribute("aria-current","step");else link.removeAttribute("aria-current");
 }
 for(const link of document.querySelectorAll(".masthead nav a")){
  const active=link.pathname==="/experiment"?FLOW_PAGES.has(currentPage):link.pathname==="/experiments"?["catalog","topic","practice"].includes(currentPage):PAGE_ROUTES[link.pathname]===currentPage;
  if(active)link.setAttribute("aria-current","page");else link.removeAttribute("aria-current");
 }
 window.renderCatalogPage?.(currentPage,location.pathname);
 configureExperiment();renderOverview();
 window.refreshCatalog?.();
 window.refreshLearning?.();
  window.refreshAcademy?.();
  window.refreshLearningReview?.();
 $("revisionEmpty").hidden=!!state.attempt;
 const heading=document.querySelector(`[data-view="${currentPage}"] h1`);
 document.title=`${heading?.textContent||"实验学习助手"} | 实验学习助手`;
 if(focus){window.scrollTo(0,0);heading?.focus({preventScroll:true});}
}
function goPage(path,{replace=false,focus=true,save=true}={}){
 const url=new URL(path,location.origin),target=url.pathname+url.search;
 if(url.origin!==location.origin||!pageForPath(url.pathname))return;
 if(save)saveDraft();
 if(location.pathname+location.search!==target)history[replace?"replaceState":"pushState"]({},"",target);
 currentPage=pageForPath(url.pathname);renderPage({focus});
}
window.flowReveal=function(element){
 if(!flowReady)return;
 const view=element.closest("[data-view]");
 if(view&&view.dataset.view!==currentPage){
  const route=Object.keys(PAGE_ROUTES).find(path=>PAGE_ROUTES[path]===view.dataset.view);
  goPage(route,{focus:false});
 }
};
document.addEventListener("click",event=>{
 const link=event.target.closest("a[data-route]");
 if(!link||event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
 event.preventDefault();
 if(state.busy){announce("正在处理，请稍候再跳转。");return;}
 const target=link.pathname+link.search;
 if((currentPage==="experiment"||currentPage==="home")&&target==="/data"&&!$("studentId").value.trim()){
  goPage('/experiment');showErrors([{field:"studentId",message:"请先填写用于查找记录的编号。"}]);return;
 }
 goPage(target);
});
window.addEventListener("popstate",()=>{saveDraft();currentPage=pageForPath(location.pathname)||"home";renderPage({focus:true});});
document.addEventListener("input",()=>{if(flowReady)saveDraft();});
document.addEventListener("change",()=>{if(flowReady){configureExperiment();renderOverview();saveDraft();}});
window.addEventListener("pagehide",saveDraft);
window.addEventListener("tutor-ready",()=>{
 restoreDraft();flowReady=true;window.tutorReady=true;
 renderPage();saveDraft();
});
renderPage();
