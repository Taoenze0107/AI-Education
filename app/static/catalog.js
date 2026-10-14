"use strict";
// Topic resources are public teaching material; private trial history stays separate.
const CATALOG_AREAS = {measurement:'测量与仪器',mechanics:'力学',electricity:'电学',optics:'光学',thermal:'热学',waves:'振动与波',modern:'近代与综合'};
const CATALOG_LEVELS = {basic:"基础",standard:"标准",challenge:"探究"};
const LEGACY_EXPERIMENTS = new Set(["ohms_law","rc_time_constant","simple_pendulum"]);
let catalogTopics = [], catalogArea = "", catalogBuilt = false;
let catalogBooks=[],catalogBook='';
const catalogCaseCache = new Map();
let renderedCatalogPath = "";
let catalogStartupDraft = null, catalogStartupRestored = false;
try { catalogStartupDraft=JSON.parse(sessionStorage.getItem(DRAFT_KEY)); } catch (_) {}
function restoreCatalogStartup(){
  if(!catalogBuilt||!flowReady||catalogStartupRestored)return;
  catalogStartupRestored=true;
  const draft=catalogStartupDraft;
  if(!draft||draft.sessionId!==(state.session?.session_id||null))return;
  for(const [id,field] of Object.entries(draft.fields||{})){
    if(!id.startsWith("catalog-")&&!["catalogDataOrigin","catalogAnalysisCache"].includes(id))continue;
    const el=$(id);if(el&&el.type!=="file")el.value=field.value??"";
  }
}
function catalogTopic(id) { return catalogTopics.find(t => t.experiment_id === id); }
function catalogButton(label,callback,kind="secondary") {
  const b=node("button",label,kind);b.type="button";b.addEventListener("click",()=>{if(!state.busy)callback();});return b;
}
function catalogAnchor(label,path,kind="",route=true) {
  const a=node("a",label,kind);a.href=path;if(route)a.dataset.route="";return a;
}
function catalogSources(topic) {
  const p=node("p","实验与原理参考：","catalog-sources");
  topic.sources.forEach(s=>{const a=catalogAnchor(s.title,s.url,"",false);a.target="_blank";a.rel="noopener noreferrer";p.append(a);});return p;
}
function catalogTable(topic,caseData) {
  const wrap=node("div",null,"reading-table-wrap"), table=node("table",null,"reading-table");
  const caption=node("caption","教学模拟读数 · 非真实测量");table.append(caption);
  const head=node("thead"),row=node("tr");
  topic.columns.forEach(c=>{const th=node("th",`${c.label} / ${c.unit}`);th.scope="col";row.append(th);});head.append(row);table.append(head);
  const body=node("tbody");
  for(let i=0;i<caseData.columns[topic.columns[0].key].length;i++){
    const tr=node("tr");topic.columns.forEach(c=>tr.append(node("td",fmtLearning(caseData.columns[c.key][i]))));body.append(tr);
  }
  table.append(body);wrap.append(table);if(topic.columns.length>2)wrap.append(node("p","左右滑动表格，查看完整表头与读数。","table-scroll-hint"));return wrap;
}
function catalogCaseLinks(topic,caseData) {
  const bar=node("div",null,"resource-actions");
  bar.append(catalogAnchor("打开练习 →",`/practice/${caseData.case_id}`,"resource-primary"),
    catalogAnchor("数据 CSV",`/api/v1/practice/${caseData.case_id}/data.csv`,"",false),
    catalogAnchor("下载练习页",`/api/v1/practice/${caseData.case_id}/worksheet`,"",false),
    catalogAnchor("下载解答",`/api/v1/practice/${caseData.case_id}/worksheet?answers=true`,"",false));return bar;
}
function catalogFilterRows(){
  const query=$("catalogQuery").value.trim().toLowerCase(),level=$("catalogLevel").value;
  const chosen=catalogBooks.find(b=>b.book_id===catalogBook),allowed=chosen?new Set(chosen.items.flatMap(i=>i.experiment_ids)):null,aliases=chosen?chosen.items:catalogBooks.flatMap(b=>b.items);
  const topics=catalogTopics.filter(t=>(!allowed||allowed.has(t.experiment_id))&&(!catalogArea||t.area===catalogArea)&&(!query||JSON.stringify([t.title,t.summary,t.goal,t.relation,aliases.filter(i=>i.experiment_ids.includes(t.experiment_id)).map(i=>i.label),t.cases.map(c=>[c.description,c.questions.map(q=>q.prompt)])]).toLowerCase().includes(query)));
  const count=topics.reduce((n,t)=>n+t.cases.filter(c=>!level||c.level===level).length,0);
  $("catalogCount").textContent=`${topics.length} 个实验主题 · ${count} 组练习`;
  const directory=$("catalogDirectory");directory.replaceChildren();
  for(const area of Object.keys(CATALOG_AREAS)){
    const group=topics.filter(t=>t.area===area);if(!group.length)continue;
    const section=node("section",null,"catalog-subject"),head=node("div",null,"catalog-subject-heading");
    head.append(node("h2",CATALOG_AREAS[area]),node("span",`${group.length} 个主题`));section.append(head);
    for(const topic of group){
      const row=node("article",null,"catalog-topic-row"),name=node("div",null,"catalog-topic-name");
      name.append(catalogAnchor(topic.title,`/experiments/${topic.experiment_id}`),node("p",topic.summary));
      const resources=node("div",null,"catalog-level-links");
      for(const [key,label] of Object.entries(CATALOG_LEVELS)){
        const cases=topic.cases.filter(c=>c.level===key);if(!cases.length||(level&&level!==key))continue;
        resources.append(catalogAnchor(`${label} · ${cases.length} 组 ↗`,`/experiments/${topic.experiment_id}?level=${key}`,`level-${key}`));
      }
      row.append(name,resources);section.append(row);
    }
    directory.append(section);
  }
  if(!topics.length)directory.append(node("p","没有匹配的实验。可清空关键词或切换学科。","empty"));
  for(const button of $("catalogAreaFilters").querySelectorAll("button"))button.setAttribute("aria-pressed",String(button.dataset.area===catalogArea));
}
function renderTopic(topic){
  $("topicHeading").textContent=topic.title;$("topicSummary").textContent=topic.summary;
  $("topicEyebrow").textContent=`${CATALOG_AREAS[topic.area]} / 实验专题`;
  const holder=$("topicContent");holder.replaceChildren();
  const intro=node("div",null,"topic-overview"),left=node("section",null,"topic-plan"),right=node("aside",null,"topic-tools");
  left.append(node("p","学习目标","eyebrow"),node("h2",topic.goal),node("p",topic.relation,"topic-relation"),node("h3","实验路径"));
  const steps=node("ol",null,"topic-steps");topic.steps.forEach(s=>steps.append(node("li",s)));left.append(steps);
  left.append(catalogButton("记录我的实验 →",()=>catalogReplaceDraft(()=>catalogStartTopic(topic))));
  right.append(node("h3","准备这些器材"),list(topic.equipment),node("h3","先确认实验条件"),list(topic.conditions),catalogSources(topic));
  intro.append(left,right);holder.append(intro);
  const path=node("div",null,"resource-path");
  path.append(node("strong","从哪里开始？"),node("span","基础：单位与公式"),node("span","标准：多组数据与图线"),node("span","探究：偏差与复查"));holder.append(path);
  const requestedLevel=new URLSearchParams(location.search).get("level"),selectedLevel=Object.hasOwn(CATALOG_LEVELS,requestedLevel)?requestedLevel:"";
  const sets=node("section",null,"topic-practices");sets.append(node("h2",selectedLevel?`${CATALOG_LEVELS[selectedLevel]}练习与数据`:"配套练习与数据"),node("p","每组 3 道原创问题，先给提示，再按需展开解答。所有示例均为教学模拟数据。","hint"));
  const levels=node("nav",null,"resource-actions");levels.setAttribute("aria-label","选择练习层次");
  for(const [key,label] of [["","全部"],...Object.entries(CATALOG_LEVELS)]){
    const count=topic.cases.filter(c=>!key||c.level===key).length;
    const a=catalogAnchor(`${label} · ${count} 组`,`/experiments/${topic.experiment_id}${key?`?level=${key}`:""}`);
    if(selectedLevel===key)a.setAttribute("aria-current","page");levels.append(a);
  }
  sets.append(levels);
  const cases=topic.cases.filter(c=>!selectedLevel||c.level===selectedLevel).sort((a,b)=>Object.keys(CATALOG_LEVELS).indexOf(a.level)-Object.keys(CATALOG_LEVELS).indexOf(b.level));
  cases.forEach(c=>{const row=node("article",null,"practice-resource-row");row.append(node("span",CATALOG_LEVELS[c.level],`resource-level level-${c.level}`),node("div",null,"resource-description"));const desc=row.lastChild;desc.append(node("h3",c.title),node("p",c.description),catalogCaseLinks(topic,c));sets.append(row);});holder.append(sets);
  const refs=node("section",null,"topic-reading");refs.append(node("h2","继续阅读"),node("p","把实验关系、测量规范与常见偏差一起核对。"));
  refs.append(catalogAnchor(`查看${topic.title}的知识条目 →`,"/library","text-link"));refs.lastChild.addEventListener("click",event=>{event.preventDefault();$("knowledgeExperiment").value=topic.experiment_id;$("knowledgeQuery").value="";goPage("/library");action("正在查找知识…",browseKnowledge);});holder.append(refs);
}
function buildTextbookIndex(data){
  catalogBooks=data.books;
  const box=node('section',null,'textbook-index'),label=node('label','按教材查实验'),select=node('select');select.id='catalogBook';label.htmlFor=select.id;
  select.append(node('option','全部资料'));select.firstChild.value='';
  for(const b of catalogBooks){const o=node('option',`${b.title} · ${b.authors}`);o.value=b.book_id;o.title=o.textContent;select.append(o);}
  const selection=node('p',null,'textbook-current-selection');selection.id='catalogBookSelection';selection.hidden=true;select.setAttribute('aria-describedby',selection.id);
  box.append(label,select,selection,node('p','已对照 5 本教材的 169 个目录条目；同一实验合并收录，综合名称提供注明范围的专题组合。','hint'));
  const d=detail('查看教材对照与来源',node('div'));d.lastChild.id='textbookRows';box.append(d);
  select.addEventListener('change',()=>{updateCatalogBookSelection();catalogArea='';goPage(`/experiments${select.value?'?book='+encodeURIComponent(select.value):''}`,{focus:false});});
  document.querySelector('[data-view="catalog"] .page-heading').after(box);
}
function updateCatalogBookSelection(){
  const select=$('catalogBook'),selection=$('catalogBookSelection'),title=select.selectedOptions[0]?.textContent||'全部资料';
  select.title=title;selection.textContent=select.value?`当前教材：${title}`:'';selection.hidden=!select.value;
}
function renderTextbookRows(){
  const requested=new URLSearchParams(location.search).get('book');catalogBook=catalogBooks.some(b=>b.book_id===requested)?requested:'';$('catalogBook').value=catalogBook;
  updateCatalogBookSelection();
  const holder=$('textbookRows');holder.replaceChildren();
  for(const b of catalogBooks.filter(b=>!catalogBook||b.book_id===catalogBook)){
    const section=node('section',null,'textbook-book');section.append(node('h3',`${b.title} · ${b.authors}`),node('p',`${b.publisher} · ${b.items.length} 个目录条目`,'hint'));
    const source=catalogAnchor('查看出版社目录 ↗',b.url,'text-link',false);source.target='_blank';source.rel='noopener noreferrer';section.append(source);
    const list=node('ol',null,'textbook-crosswalk');for(const item of b.items){const row=node('li');row.append(node('strong',item.label));const links=node('div',null,'resource-actions');for(const eid of item.experiment_ids){const t=catalogTopic(eid);if(t)links.append(catalogAnchor(t.title,`/experiments/${eid}`));}row.append(links,node('p',item.note,'hint'));list.append(row);}section.append(list);holder.append(section);
  }
  holder.append(node('p','范围是这五本已核对的公开目录；各校选课和教材拓展可能不同。目录用于定位实验，讲解、练习和模拟数据由项目编写。','hint'),catalogAnchor('下载教材对照 CSV','/api/v1/textbooks/coverage.csv','text-link',false));
}
function catalogHeatmap(c){
  const figure=node('figure',null,'learning-plot');figure.append(node('figcaption',c.title));
  const make=(tag,attrs,text)=>{const e=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [k,v] of Object.entries(attrs))e.setAttribute(k,v);if(text!=null)e.textContent=text;return e;};
  const xs=[...new Set(c.points.map(p=>p.x))].sort((a,b)=>a-b),ys=[...new Set(c.points.map(p=>p.y))].sort((a,b)=>a-b),lo=Math.min(...c.points.map(p=>p.z)),hi=Math.max(...c.points.map(p=>p.z));
  const svg=make('svg',{viewBox:'0 0 600 330',role:'img','aria-label':`${c.title}；${c.points.length} 个网格读数；颜色表示${c.z_label}`}),w=490/xs.length,h=240/ys.length;
  for(const p of c.points){const t=hi===lo?0.5:(p.z-lo)/(hi-lo),x=70+xs.indexOf(p.x)*w,y=35+(ys.length-1-ys.indexOf(p.y))*h;
    const r=make('rect',{x,y,width:w-2,height:h-2,fill:`hsl(${80+75*t},25%,${88-48*t}%)`});r.append(make('title',{},`x=${p.x} cm；y=${p.y} cm；${fmtLearning(p.z)} V`));svg.append(r);
    if(xs.length<=8&&ys.length<=8)svg.append(make('text',{x:x+w/2,y:y+h/2+4,'text-anchor':'middle',fill:t>.6?'#fff':'#213d2c','font-size':13},fmtLearning(p.z)));
  }
  xs.forEach((v,i)=>svg.append(make('text',{x:70+(i+.5)*w,y:297,'text-anchor':'middle',class:'learning-tick'},fmtLearning(v))));ys.forEach((v,i)=>svg.append(make('text',{x:57,y:35+(ys.length-i-.5)*h+4,'text-anchor':'end',class:'learning-tick'},fmtLearning(v))));
  svg.append(make('text',{x:70,y:19,class:'learning-axis-label'},c.y_label),make('text',{x:560,y:322,'text-anchor':'end',class:'learning-axis-label'},c.x_label));
  figure.append(svg,node('p',`${c.z_label}：${fmtLearning(lo)} → ${fmtLearning(hi)}；颜色从浅到深，保留全部网格读数。`,'plot-legend'));return figure;
}
function renderPractice(topic,caseData){
  $("practiceHeading").textContent=caseData.title;$("practiceEyebrow").textContent=`${CATALOG_AREAS[topic.area]} / ${CATALOG_LEVELS[caseData.level]}练习`;
  $("practiceBackLink").textContent=`← ${topic.title}`;$("practiceBackLink").href=`/experiments/${topic.experiment_id}`;
  $("practiceDescription").textContent=caseData.description;
  const holder=$("practiceContent");holder.replaceChildren();
  const toolbar=node("div",null,"practice-toolbar");toolbar.append(catalogCaseLinks(topic,caseData));toolbar.firstChild.firstChild.remove();
  toolbar.append(catalogButton("用这组示例开始 →",()=>action("正在准备示例…",async()=>{
    const data=await getCatalogCase(caseData.case_id);
    catalogReplaceDraft(()=>catalogLoadCase(topic,caseData,data.analysis));
  })));holder.append(toolbar);
  const data=node("section",null,"practice-data");data.append(node("p","示例数据 · 仅用于练习，非真实测量","example-label"));
  if(topic.parameters.length)data.append(node("p",topic.parameters.map(p=>`${p.label} ${fmtLearning(caseData.parameters[p.key])} ${p.unit}`).join(" · "),"practice-parameters"));
  data.append(catalogTable(topic,caseData));holder.append(data);
  const plot=node("details",null,"practice-plot");plot.append(node("summary","查看数据图与处理方法"));const plotBody=node("div","正在准备图表…");plot.append(plotBody);holder.append(plot);
  getCatalogCase(caseData.case_id).then(result=>{if(!plot.isConnected)return;plotBody.replaceChildren();drawCatalogAnalysis(plotBody,result.analysis,false);}).catch(()=>{plotBody.textContent="图表暂时未能载入，可使用数据表继续练习。";});
  const saved=readPracticeAnswers(caseData.case_id),exercises=node("section",null,"practice-exercises");exercises.id="practiceExercises";
  const progress=node("p","先写自己的想法，再看提示。","practice-progress");progress.id="practiceProgress";exercises.append(progress);
  caseData.questions.forEach((q,i)=>{
    const block=node("article",null,"practice-question");block.append(node("p",`问题 ${String(i+1).padStart(2,"0")}`,"eyebrow"),node("h2",q.prompt));
    const label=node("label","我的思路与计算"),input=node("textarea");input.id=`practiceAnswer-${i}`;label.htmlFor=input.id;input.rows=3;input.value=saved[i]||"";input.placeholder="写出判断、代入过程或待核实的条件。";
    input.addEventListener("input",()=>savePracticeAnswers(caseData.case_id));block.append(label,input);
    const hint=detail("需要一点提示",node("p",q.hint));const solution=detail("查看完整解答",list(q.solution));solution.className="practice-solution";block.append(hint,solution);exercises.append(block);
  });holder.append(exercises);updatePracticeProgress();
  const next=node("div",null,"practice-next");
  const sameLevel=topic.cases.filter(c=>c.level===caseData.level),nextCase=sameLevel[sameLevel.findIndex(c=>c.case_id===caseData.case_id)+1];
  if(nextCase)next.append(catalogAnchor(`再练一组${CATALOG_LEVELS[caseData.level]} →`,`/practice/${nextCase.case_id}`,"button"));
  else if(caseData.level!=="challenge"){const level=caseData.level==="basic"?"standard":"challenge",following=topic.cases.find(c=>c.level===level);if(following)next.append(catalogAnchor(`继续${CATALOG_LEVELS[level]}练习 →`,`/practice/${following.case_id}`,"button"));}
  next.append(catalogAnchor("返回实验资料库","/experiments","text-link"));holder.append(next,catalogSources(topic));
}
function readPracticeAnswers(id){try{return JSON.parse(sessionStorage.getItem(`at-practice-${id}`))||[];}catch(_){return[];}}
function savePracticeAnswers(id){const answers=[...$("practiceExercises").querySelectorAll("textarea")].map(el=>el.value);try{sessionStorage.setItem(`at-practice-${id}`,JSON.stringify(answers));}catch(_){}updatePracticeProgress();}
function updatePracticeProgress(){if(!$("practiceExercises"))return;const n=[...$("practiceExercises").querySelectorAll("textarea")].filter(el=>el.value.trim()).length;$("practiceProgress").textContent=`已记录 ${n} / 3 道题的思路 · 内容保留在当前浏览器，按需展开提示与解答。`;}
async function getCatalogCase(id){if(!catalogCaseCache.has(id)){const promise=request(`/api/v1/practice/${id}`).catch(e=>{catalogCaseCache.delete(id);throw e;});catalogCaseCache.set(id,promise);}return catalogCaseCache.get(id);}
function catalogReplaceDraft(callback){
  const hasData=Object.keys(rawLearningValues()).length>0||$("studentResult").value.trim();
  if(!hasData){callback();return;}
  const view=document.querySelector(`[data-view="${currentPage}"]`);view.querySelector(".catalog-replace-prompt")?.remove();
  const prompt=node("div",null,"catalog-replace-prompt");prompt.setAttribute("role","status");prompt.append(node("p","这会替换当前未提交的实验草稿。已提交的历史记录会保留。"));
  prompt.append(catalogButton("替换草稿并继续",()=>{prompt.remove();callback();}),catalogButton("保留当前草稿",()=>{prompt.remove();announce("已保留当前草稿。");},"plain"));view.querySelector(".page-heading").after(prompt);prompt.scrollIntoView({behavior:"smooth",block:"center"});announce("示例已准备好，选择是否替换当前草稿。");
}
function clearCatalogMaterial(){importedMaterialFile=null;importedCsvRuns.clear();lastCharts=null;$("materialCharts").hidden=true;$("csvImportStatus").textContent="";$("materialAnalysisStatus").textContent="";$("catalogAnalysisCache").value="";clearErrors();}
function catalogStartTopic(topic){clearCatalogMaterial();addExperiment(topic.experiment_id,topic.title);$("experimentId").value=topic.experiment_id;resetSession();fillPayload(emptyPayload());persist();goPage("/experiment");announce(`已选择${topic.title}。填写匿名编号后录入自己的读数。`);}
function catalogLoadCase(topic,caseData,analysis){
  clearCatalogMaterial();addExperiment(topic.experiment_id,topic.title);$("experimentId").value=topic.experiment_id;resetSession();
  const raw={...analysis.raw_measurements};
  if(topic.experiment_id==="rc_time_constant"){raw.resistance_ohm=caseData.parameters.resistance_kohm*1000;raw.capacitance_F=caseData.parameters.capacitance_uF*1e-6;}
  if(topic.experiment_id==="simple_pendulum"){raw.length_m=caseData.parameters.length_cm/100;raw.periods_per_trial=caseData.parameters.cycles;}
  const payload={anomaly:null,consistency:{checks:topic.checks.map(name=>({name,passed:null}))},mathematics:analysis.mathematics,raw_measurements:raw,metadata:{source:"synthetic-example",practice_title:caseData.title},student_explanation:null};
  fillPayload(payload);$("catalogDataOrigin").value="synthetic-example";
  if(!LEGACY_EXPERIMENTS.has(topic.experiment_id)){
    setCatalogReadings(topic,{columns:caseData.columns,parameters:caseData.parameters});
    storeCatalogAnalysis(topic,{columns:caseData.columns,parameters:caseData.parameters},analysis,"synthetic-example");
  }else if(topic.experiment_id==="ohms_law"){
    $("quickVoltage").value=caseData.columns.voltage_V.join(", ");$("quickCurrent").value=caseData.columns.current_mA.join(", ");
  }
  persist();goPage($("studentId").value.trim()?"/data":"/experiment");saveDraft();
  announce("已载入教学模拟数据。请写自己的观察和计算，并核实条件后再提交；示例不代表真实测量。");
}
function inputId(topic,key){return `catalog-${topic.experiment_id}-${key}`;}
function setCatalogReadings(topic,data){topic.columns.forEach(c=>{$(inputId(topic,c.key)).value=(data.columns[c.key]||[]).join(", ");});topic.parameters.forEach(p=>{$(inputId(topic,p.key)).value=data.parameters[p.key]??p.default;});}
function readCatalogReadings(topic){
  const columns={};
  for(const c of topic.columns){const text=$(inputId(topic,c.key)).value.trim();const tokens=text.split(/[,，;；\n]/).map(v=>v.trim());if(!text||tokens.some(v=>!v||!Number.isFinite(Number(v))))throw new Error(`请在${c.label}中填写用逗号分隔的有效数值。`);columns[c.key]=tokens.map(Number);}
  const parameters={};for(const p of topic.parameters){const text=$(inputId(topic,p.key)).value.trim();if(!text||!Number.isFinite(Number(text)))throw new Error(`请填写${p.label}。`);parameters[p.key]=Number(text);}
  return {columns,parameters};
}
function drawCatalogAnalysis(holder,analysis,withResult=true){
  holder.replaceChildren();
  if(withResult){const metrics=node("div",null,"learning-stats");analysis.metrics.forEach(m=>metrics.append(learningStat(m.label,`${fmtLearning(m.value)} ${m.unit}`)));holder.append(metrics);}
  const charts=node("div",null,"catalog-charts");
  analysis.charts.forEach(c=>charts.append(c.kind==='heatmap'?catalogHeatmap(c):learningPlot(c.title,c.points,c.model.length?[{name:c.model_label,points:c.model,dashed:true}]:[],c.x_label,c.y_label,{connectPoints:!!c.connect,tightY:c.title.includes("各组")||c.title.includes("残差"),pointLabel:c.connect?'当前读数 · 按采集顺序连接':'当前读数'})));holder.append(charts,list(analysis.notes));
}
function storeCatalogAnalysis(topic,reading,analysis,origin){$("catalogAnalysisCache").value=JSON.stringify({id:topic.experiment_id,reading,analysis,origin});refreshCatalogInputs();}
function applyCatalogReadings(topic,reading,analysis,origin){
  $("measurementRows").replaceChildren();Object.entries(analysis.raw_measurements).forEach(([k,v])=>addKeyValue("measurementRows",k,v));
  $("includeMath").checked=true;$("formula").value=analysis.mathematics.formula;$("mathUnit").value=analysis.unit;$("referenceResult").value=analysis.result;
  $("variableRows").replaceChildren();Object.entries(analysis.mathematics.variables).forEach(([k,v])=>addVariable(k,v));
  setKeyValue("metadataRows","source",origin);$("catalogDataOrigin").value=origin;sourceVisibility();storeCatalogAnalysis(topic,reading,analysis,origin);refreshLearningGuides();renderOverview();saveDraft();
  announce("读数已写入并绘图。继续描述观察、核实条件，并填写你自己的计算。仪器条件不会自动标为通过。");
}
function refreshCatalogInputs({hydrate=false}={}){
  if(!catalogBuilt)return;
  const topic=catalogTopic($("experimentId").value),extended=topic&&!LEGACY_EXPERIMENTS.has(topic.experiment_id);
  $("catalogInputPanel").hidden=!extended;
  document.querySelectorAll(".catalog-experiment-input").forEach(el=>el.hidden=el.dataset.experiment!==topic?.experiment_id);
  if(extended){
    document.querySelector(".advanced-data").open=false;
    if(hydrate){const raw=rawLearningValues();setCatalogReadings(topic,{columns:Object.fromEntries(topic.columns.map(c=>[c.key,Array.isArray(raw[c.key])?raw[c.key]:[]])),parameters:Object.fromEntries(topic.parameters.map(p=>[p.key,raw[p.key]??p.default]))});$("catalogDataOrigin").value=readKeyValues("metadataRows",[]).source||"manual-entry";}
    const output=$("catalogDataCharts"),status=$("catalogDataStatus");output.hidden=true;
    try{
      const cached=JSON.parse($("catalogAnalysisCache").value||"null"),current=readCatalogReadings(topic),raw=rawLearningValues();
      const matches=cached?.id===topic.experiment_id&&JSON.stringify(cached.reading)===JSON.stringify(current)&&Object.entries({...current.columns,...current.parameters}).every(([k,v])=>JSON.stringify(v)===JSON.stringify(raw[k]));
      if(matches){drawCatalogAnalysis(output,cached.analysis);output.hidden=false;status.textContent=`${cached.origin.includes("example")?"教学模拟数据（非真实测量）":"当前填写的读数"}已写入。计算值只适用于页面所列模型条件。`;}
      else status.textContent="填写后点击“写入数据并绘图”。修改读数后需重新写入，图表才会更新。";
    }catch(_){status.textContent="填写对应读数后，点击“写入数据并绘图”。";}
  }
  document.querySelector('[data-view="data"] .sample-details').hidden=!!extended;
}
function buildCatalogInputs(){
  const holder=node("section",null,"catalog-input-panel");holder.id="catalogInputPanel";holder.hidden=true;
  for(const [id,value] of [["catalogDataOrigin","manual-entry"],["catalogAnalysisCache",""]]){const input=node("input");input.type="hidden";input.id=id;input.value=value;holder.append(input);}
  catalogTopics.filter(t=>!LEGACY_EXPERIMENTS.has(t.experiment_id)).forEach(topic=>{
    const panel=node("section",null,"catalog-experiment-input");panel.dataset.experiment=topic.experiment_id;panel.hidden=true;panel.append(node("h3",`${topic.title} · 录入读数`),node("p","每列用逗号分隔，读数一一对应。保留原始单位，系统按下面的处理方法换算。","hint"));
    const grid=node("div",null,"grid-2");topic.columns.forEach(c=>learningField(grid,inputId(topic,c.key),`${c.label}（${c.unit}，逗号分隔）`,"填写至少 3 组读数"));topic.parameters.forEach(p=>learningField(grid,inputId(topic,p.key),`${p.label}（${p.unit}）`,"填写实验参数",{type:"number",value:String(p.default)}));panel.append(grid);
    const actions=node("div",null,"actions");actions.append(catalogButton("写入数据并绘图",()=>action("正在处理读数…",async()=>{const reading=readCatalogReadings(topic);const analysis=await request(`/api/v1/experiments/${topic.experiment_id}/analyze`,{method:"POST",body:pretty(reading)});applyCatalogReadings(topic,reading,analysis,$("catalogDataOrigin").value||"manual-entry");})),catalogAnchor("浏览本实验的分级练习",`/experiments/${topic.experiment_id}`,"text-link"));panel.append(actions);
    const csv=detail("使用 CSV 文件录入",node("div"));const csvBody=csv.lastChild;const file=node("input");file.id=`catalogFile-${topic.experiment_id}`;file.type="file";file.accept=".csv,text/csv";const label=node("label","选择本实验 CSV 文件");label.htmlFor=file.id;
    file.addEventListener("change",()=>{const upload=file.files?.[0];if(!upload)return;action("正在读取实验表…",async()=>{const result=await request(`/api/v1/experiments/${topic.experiment_id}/import`,{method:"POST",body:pretty({filename:upload.name,content_base64:bufferToBase64(await upload.arrayBuffer())})});setCatalogReadings(topic,result.readings);applyCatalogReadings(topic,result.readings,result.analysis,result.origin);});});
    csvBody.append(node("p","请使用本实验的表头。一个文件只记录一组参数；支持 UTF-8 与 GB18030 编码。","hint"),catalogAnchor("下载空白 CSV 模板",`/api/v1/experiments/${topic.experiment_id}/template.csv`,"text-link",false),label,file);panel.append(csv);
    const method=detail("处理方法与适用条件",node("div"));method.lastChild.append(node("p",topic.relation),list(topic.steps),list(topic.conditions));panel.append(method);holder.append(panel);
  });
  const status=node("p","", "hint");status.id="catalogDataStatus";status.setAttribute("aria-live","polite");const charts=node("div");charts.id="catalogDataCharts";charts.hidden=true;holder.append(status,charts);
  document.querySelector('[data-view="data"] > .card').prepend(holder);
  holder.addEventListener("input",()=>{$("catalogDataOrigin").value=$("catalogDataOrigin").value.includes("example")?"edited-example":"manual-entry";refreshCatalogInputs();});
}
window.renderCatalogPage=function(page,path){
  if(!catalogBuilt)return;
  const route=path+location.search;
  if(page==="catalog"){renderTextbookRows();catalogFilterRows();renderedCatalogPath=route;return;}
  if(!["topic","practice"].includes(page)||renderedCatalogPath===route)return;
  if(page==="topic"){const topic=catalogTopic(path.split("/").pop());if(topic)renderTopic(topic);}
  else{const id=path.split("/").pop();const topic=catalogTopics.find(t=>t.cases.some(c=>c.case_id===id));if(topic)renderPractice(topic,topic.cases.find(c=>c.case_id===id));}
  renderedCatalogPath=route;
};
window.refreshCatalog=refreshCatalogInputs;
window.catalogHasInput=id=>!!catalogTopic(id)&&!LEGACY_EXPERIMENTS.has(id);
async function buildCatalog(){
  try{
    const [data,books]=await Promise.all([request('/api/v1/experiments'),request('/api/v1/textbooks')]);catalogTopics=data.topics;buildTextbookIndex(books);
    $("catalogStats").textContent=`${data.experiment_count} 个实验 · ${data.case_count} 组分级数据 · ${data.question_count} 道原创练习`;
    const filters=$("catalogAreaFilters");filters.replaceChildren();
    for(const [area,label] of [["","全部学科"],...Object.entries(CATALOG_AREAS)]){const button=catalogButton(label,()=>{catalogArea=area;catalogFilterRows();},"plain");button.dataset.area=area;button.setAttribute("aria-pressed",String(!area));filters.append(button);}
    for(const topic of catalogTopics){
      EXPERIMENTS[topic.experiment_id]=topic.title;addExperiment(topic.experiment_id,topic.title);
      if(!LEGACY_EXPERIMENTS.has(topic.experiment_id))LEARNING_PLANS[topic.experiment_id]={goal:topic.goal,data:topic.data_questions,checks:topic.checks,formula:topic.relation,unit:topic.output_unit,example:topic.cases[0].questions[0].solution[0],notes:topic.knowledge_ids};
    }
    buildCatalogInputs();catalogBuilt=true;
    refreshCatalogInputs({hydrate:true});restoreCatalogStartup();renderPage();if(flowReady)saveDraft();
    const home=$("homeFeaturedTopics");catalogTopics.filter(t=>["archimedes","grating_diffraction","thermal_expansion"].includes(t.experiment_id)).forEach(topic=>{const a=catalogAnchor("",`/experiments/${topic.experiment_id}`);a.append(node("small",CATALOG_AREAS[topic.area]),node("strong",topic.title),node("span","原理 · 分级练习 · 示例数据 ↗"));home.append(a);});
  }catch(error){$("catalogCount").textContent="实验资料暂时无法加载。";$("catalogDirectory").replaceChildren(catalogButton("重新载入实验资料",()=>location.reload()));}
}
$("catalogSearchForm").addEventListener("submit",event=>{event.preventDefault();catalogFilterRows();});
$("catalogLevel").addEventListener("change",catalogFilterRows);
$("catalogResetButton").addEventListener("click",()=>{catalogArea="";$("catalogQuery").value="";$("catalogLevel").value="";goPage('/experiments',{focus:false});});
window.addEventListener("tutor-ready",()=>{if(catalogBuilt){restoreCatalogStartup();refreshCatalogInputs();saveDraft();}});
buildCatalog();
