const KEY="study-task-helper-v1";
const FORMAT=`# Day 1：任务标题
## 当前任务
用一两句话说明今天要完成什么。
## 任务讲解
解释学习顺序、为什么学、怎么操作。
## 知识点
### 知识点一
分段讲解内容。
### 知识点二
分段讲解内容。
## 重点关注
- 容易混淆的地方
- 需要观察的参数或现象
## 完成标志
- [问题] 请用自己的话回答一个问题
- [证据] 粘贴运行输出、实验结果或文件位置
- [确认] 我已经完成某项操作`;
const SAMPLE=`# Day 1：DCGAN 原理预习
## 当前任务
用 60 分钟阅读 PyTorch DCGAN 教程，从 Introduction 学到 Inputs，看到 Data 时停止。
## 任务讲解
先快速浏览全文，再重点理解生成器和判别器的目标。今天不下载 CelebA，也不进行完整训练。英文官方版作为代码依据，中文资料只辅助理解。
## 知识点
### GAN 的两个角色
生成器 G 接收随机噪声 z，输出生成图像 G(z)。判别器 D 接收图像，输出它来自真实数据的概率。
### 对抗与交替训练
判别器努力分清真实图像和生成图像；生成器努力产生能够骗过判别器的图像。两个网络需要交替更新。
### DCGAN 的图像结构
生成器主要使用转置卷积、BatchNorm、ReLU，并在最后使用 Tanh；判别器主要使用卷积、BatchNorm 和 LeakyReLU。
### 主要输入参数
nz 是随机噪声维度，image_size 是图像尺寸，batch_size 是每批样本数量，ngf 和 ndf 控制两个网络的特征规模。
## 重点关注
- Adversarial Example Generation 不是 GAN 教程
- Spatial Transformer Network 也不是老师所说的 Transformer 主线
- 先理解输入、输出和 shape，不要求今天推导完整目标函数
## 完成标志
- [问题] 生成器和判别器分别想达到什么目标？
- [问题] 为什么 G 和 D 需要交替训练？
- [问题] nz、image_size、batch_size 分别是什么？
- [证据] 写下你今天看到的最后一个教程标题
- [确认] 我可以不看原文讲出 GAN 的基本流程`;

let state={source:"",date:new Date().toISOString().slice(0,10),lesson:null,answers:{},done:{},notes:"",cardDone:{},cardNotes:{},cardImportant:{},plans:{total:"",quarter:"",month:"",current:"",next:"",progress:0},journals:[],weeklyReview:"",timer:{active:false,start:null,lastActivity:null,lastStopReason:null,lastStoppedAt:null,sessions:[]}};
const IDLE_LIMIT_MS=5*60*1000;
let calendarCursor=new Date(new Date().getFullYear(),new Date().getMonth(),1),timerTick=null,activityCheckTick=null,lastActivityPersistAt=0;
let installPrompt=null;
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
function save(){localStorage.setItem(KEY,JSON.stringify(state));$("#saveState").textContent="已自动保存 "+new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});refreshProgress();}
function load(){try{state={...state,...JSON.parse(localStorage.getItem(KEY)||"{}")}}catch(e){} state.plans={total:"",quarter:"",month:"",current:"",next:"",progress:0,...(state.plans||{})};state.journals=Array.isArray(state.journals)?state.journals:[];state.timer={active:false,start:null,lastActivity:null,lastStopReason:null,lastStoppedAt:null,sessions:[],...(state.timer||{})};state.timer.sessions=Array.isArray(state.timer.sessions)?state.timer.sessions:[];if(state.timer.active&&!state.timer.lastActivity)state.timer.lastActivity=state.timer.start;$("#taskInput").value=state.source||"";$("#studyDate").value=state.date;$("#documentEditor").value=state.notes||"";fillPlans();resetJournalForm();renderJournalList();if(state.lesson)renderLesson();renderDashboard();renderTimer();reconcileIdleTimer();}
function sections(md){
  const title=(md.match(/^#\s+(.+)$/m)||[])[1]||"未命名学习任务";
  const map={}; let key="",sub="";
  md.split(/\r?\n/).forEach(line=>{
    const h2=line.match(/^##\s+(.+)/); const h3=line.match(/^###\s+(.+)/);
    if(h2){key=h2[1].trim();map[key]=map[key]||"";sub="";return}
    if(h3&&key==="知识点"){sub=h3[1].trim();map.__knowledge=map.__knowledge||[];map.__knowledge.push({title:sub,body:""});return}
    if(key==="知识点"&&sub){map.__knowledge[map.__knowledge.length-1].body+=(map.__knowledge.at(-1).body?"\n":"")+line}
    else if(key)map[key]+=(map[key]?"\n":"")+line;
  });
  const checks=(map["完成标志"]||"").split("\n").map(x=>x.match(/^\s*-\s*\[(问题|证据|确认)\]\s*(.+)/)).filter(Boolean).map((m,i)=>({id:"c"+i,type:m[1],text:m[2]}));
  return{title,task:map["当前任务"]||"",explanation:map["任务讲解"]||"",focus:map["重点关注"]||"",knowledge:map.__knowledge||[],checks};
}
function rich(text){return text.split(/\n+/).filter(Boolean).map(x=>x.trim().startsWith("- ")?`<p>• ${esc(x.trim().slice(2))}</p>`:`<p>${esc(x)}</p>`).join("")||"<p>暂无内容</p>"}
function esc(s){return String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]))}
function renderLesson(){
  $("#inputPanel").classList.add("hidden");$("#lessonPanel").classList.remove("hidden");
  $("#lessonTitle").textContent=state.lesson.title;$("#lessonTask").textContent=state.lesson.task;$("#lessonDate").textContent=state.date;
  $("#explanation").innerHTML=rich(state.lesson.explanation);$("#focus").innerHTML=rich(state.lesson.focus);
  $("#cardCounter").textContent=`共 ${state.lesson.knowledge.length} 个知识点`;
  $("#knowledgeCards").innerHTML=state.lesson.knowledge.map((k,i)=>`<article class="knowledge-card ${state.cardImportant[i]?"important":""}" data-knowledge-index="${i}"><button class="card-head" data-toggle="${i}"><span>${state.cardImportant[i]?'<b class="important-badge">重点</b> ':""}${i+1}. ${esc(k.title)}</span><span>展开/收起</span></button><div class="card-body">${rich(k.body)}<div class="knowledge-actions"><label class="important-toggle"><input type="checkbox" data-important="${i}" ${state.cardImportant[i]?"checked":""}>标记为重点</label><label class="card-done"><input type="checkbox" data-card="${i}" ${state.cardDone[i]?"checked":""}>我已理解并能复述</label></div><label class="confusion-label" for="confusion-${i}">针对本知识点的困惑</label><textarea id="confusion-${i}" class="confusion-input" data-confusion="${i}" placeholder="例如：我不明白这一层的输入输出 shape；如果没有困惑，可以留空。">${esc(state.cardNotes[i]||"")}</textarea></div></article>`).join("")||'<div class="panel">尚未识别到知识点，请用“### 知识点名称”分段。</div>';
  $("#checks").innerHTML=state.lesson.checks.map(c=>`<article class="check-card" data-check-id="${c.id}"><label>${c.type} · ${esc(c.text)}</label>${c.type==="确认"?`<div class="status-line"><input type="checkbox" data-confirm="${c.id}" ${state.done[c.id]?"checked":""}>确认完成</div>`:`<textarea data-answer="${c.id}" placeholder="${c.type==="问题"?"用自己的话回答……":"粘贴输出、结果或文件位置……"}">${esc(state.answers[c.id]||"")}</textarea><div class="status-line"><input type="checkbox" data-check="${c.id}" ${state.done[c.id]?"checked":""}>标记为已完成</div>`}</article>`).join("");
  bindDynamic();save();
}
function bindDynamic(){
  $$("[data-toggle]").forEach(b=>b.onclick=()=>b.closest(".knowledge-card").classList.toggle("collapsed"));
  $$("[data-card]").forEach(x=>x.onchange=()=>{state.cardDone[x.dataset.card]=x.checked;save()});
  $$("[data-important]").forEach(x=>x.onchange=()=>{state.cardImportant[x.dataset.important]=x.checked;save();renderLesson()});
  $$("[data-confusion]").forEach(x=>x.oninput=()=>{state.cardNotes[x.dataset.confusion]=x.value;save()});
  $$("[data-answer]").forEach(x=>x.oninput=()=>{state.answers[x.dataset.answer]=x.value;save()});
  $$("[data-check]").forEach(x=>x.onchange=()=>{state.done[x.dataset.check]=x.checked;save()});
  $$("[data-confirm]").forEach(x=>x.onchange=()=>{state.done[x.dataset.confirm]=x.checked;save()});
}
function jumpToFirstIncomplete(){
  if(!state.lesson)return;
  let target=null;
  for(let i=0;i<state.lesson.knowledge.length;i++){if(!state.cardDone[i]){target=document.querySelector(`[data-knowledge-index="${i}"]`);break}}
  if(!target){const check=state.lesson.checks.find(c=>!state.done[c.id]);if(check)target=document.querySelector(`[data-check-id="${check.id}"]`)}
  if(!target)return alert("太棒了，当前任务已经全部完成！");
  target.classList.remove("collapsed","jump-highlight");target.scrollIntoView({behavior:"smooth",block:"center"});requestAnimationFrame(()=>target.classList.add("jump-highlight"));setTimeout(()=>target.classList.remove("jump-highlight"),1700);
}
function refreshProgress(){
  const total=(state.lesson?.knowledge.length||0)+(state.lesson?.checks.length||0);
  const yes=Object.values(state.cardDone).filter(Boolean).length+Object.values(state.done).filter(Boolean).length;
  $("#progressText").textContent=`${Math.min(yes,total)} / ${total}`;$("#progressBar").style.width=total?`${Math.min(100,yes/total*100)}%`:"0";
}
function homework(){
  if(!state.lesson)return "# 当天作业\n\n尚未载入任务。";
  let out=`# ${state.lesson.title}｜当天作业\n\n- 日期：${state.date}\n- 完成进度：${$("#progressText").textContent}\n\n## 当前任务\n${state.lesson.task}\n\n## 知识点复述情况\n`;
  state.lesson.knowledge.forEach((k,i)=>out+=`- [${state.cardDone[i]?"x":" "}] ${state.cardImportant[i]?"【重点】":""}${k.title}\n`);
  const knowledgeNotes=state.lesson.knowledge.map((k,i)=>({k,i,n:(state.cardNotes[i]||"").trim()})).filter(x=>x.n||state.cardImportant[x.i]);
  if(knowledgeNotes.length){
    out+="\n## 重点知识点与针对性困惑\n";
    knowledgeNotes.forEach(({k,i,n})=>out+=`\n### ${state.cardImportant[i]?"【重点】":""}${k.title}\n${n||"（已标记为重点，暂未填写困惑）"}\n`);
  }
  out+="\n## 回答与完成证据\n";
  state.lesson.checks.forEach(c=>out+=`\n### ${c.type}：${c.text}\n状态：${state.done[c.id]?"已完成":"未完成"}\n\n${state.answers[c.id]||"（未填写）"}\n`);
  if(state.notes.trim())out+=`\n## 学习文档与个人笔记\n\n${state.notes.trim()}\n`;
  out+="\n## 请老师/助手重点检查\n\n- 我的回答是否准确：\n- 我的实验证据是否充分：\n- 下一步建议：\n";return out;
}
function fillPlans(){
  $("#totalPlan").value=state.plans.total||"";$("#quarterPlan").value=state.plans.quarter||"";$("#monthPlan").value=state.plans.month||"";$("#currentPlan").value=state.plans.current||"";$("#nextPlan").value=state.plans.next||"";$("#manualProgress").value=Number(state.plans.progress)||0;$("#manualProgressLabel").textContent=`${Number(state.plans.progress)||0}%`;$("#weeklyReview").value=state.weeklyReview||"";
}
function resetJournalForm(){
  $("#journalId").value="";$("#journalDate").value=new Date().toISOString().slice(0,10);$("#journalHours").value="";$("#journalStatus").value="进行中";["journalPlan","journalDone","journalOutputs","journalProblems","journalNext"].forEach(id=>$("#"+id).value="");
}
function journalMarkdown(entries=state.journals){
  let out="# 学习日记汇总\n\n";
  [...entries].sort((a,b)=>b.date.localeCompare(a.date)).forEach(j=>{out+=`## ${j.date}｜${j.status}\n\n- 学习时长：${j.hours||0} 小时\n\n### 当天学习计划\n${j.plan||"（未填写）"}\n\n### 实际完成情况\n${j.done||"（未填写）"}\n\n### 产出与证据\n${j.outputs||"（未填写）"}\n\n### 困惑与问题\n${j.problems||"（未填写）"}\n\n### 下一步\n${j.next||"（未填写）"}\n\n`});return out;
}
function archiveMarkdown(){
  return `# 深度学习学习档案\n\n- 导出时间：${new Date().toLocaleString()}\n- 当前总进度：${Number(state.plans.progress)||0}%\n\n## 总计划\n${state.plans.total||"（未填写）"}\n\n## 季度计划\n${state.plans.quarter||"（未填写）"}\n\n## 月计划\n${state.plans.month||"（未填写）"}\n\n## 当前计划\n${state.plans.current||"（未填写）"}\n\n## 下一步计划\n${state.plans.next||"（未填写）"}\n\n## 周复盘\n${state.weeklyReview||"（未填写）"}\n\n${journalMarkdown()}\n\n# 当前学习任务与作业\n\n${homework()}`;
}
function renderJournalList(){
  const list=[...state.journals].sort((a,b)=>b.date.localeCompare(a.date));
  $("#journalList").innerHTML=list.length?list.map(j=>`<article class="journal-entry"><div class="journal-entry-head"><div><h3>${esc(j.date)} <span class="status-pill">${esc(j.status)}</span></h3><span class="meta">${Number(j.hours||0).toFixed(2)} 小时</span></div><div class="journal-actions"><button class="ghost" data-edit-journal="${j.id}">编辑</button><button class="danger" data-delete-journal="${j.id}">删除</button></div></div><p><strong>完成：</strong>${esc(j.done||"尚未填写")}</p><p><strong>产出：</strong>${esc(j.outputs||"尚未填写")}</p></article>`).join(""):'<div class="empty-state">还没有学习日记。完成今天的学习后，留下第一条可追溯记录。</div>';
  $$("[data-edit-journal]").forEach(b=>b.onclick=()=>editJournal(b.dataset.editJournal));
  $$("[data-delete-journal]").forEach(b=>b.onclick=()=>{if(confirm("确定删除这条学习日记吗？")){state.journals=state.journals.filter(j=>j.id!==b.dataset.deleteJournal);save();renderJournalList();renderDashboard()}});
}
function editJournal(id){
  const j=state.journals.find(x=>x.id===id);if(!j)return;$("#journalId").value=j.id;$("#journalDate").value=j.date;$("#journalHours").value=j.hours;$("#journalStatus").value=j.status;$("#journalPlan").value=j.plan;$("#journalDone").value=j.done;$("#journalOutputs").value=j.outputs;$("#journalProblems").value=j.problems;$("#journalNext").value=j.next;window.scrollTo({top:0,behavior:"smooth"});
}
function streakCount(){
  const dates=[...new Set(state.journals.map(j=>j.date))].sort().reverse();if(!dates.length)return 0;let count=1;let cursor=new Date(dates[0]+"T00:00:00");for(let i=1;i<dates.length;i++){cursor.setDate(cursor.getDate()-1);const expected=cursor.toISOString().slice(0,10);if(dates[i]===expected)count++;else break}return count;
}
function localDate(d=new Date()){const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,"0"),day=String(d.getDate()).padStart(2,"0");return `${y}-${m}-${day}`}
function formatDuration(seconds){seconds=Math.max(0,Math.floor(seconds));const h=String(Math.floor(seconds/3600)).padStart(2,"0"),m=String(Math.floor(seconds%3600/60)).padStart(2,"0"),s=String(seconds%60).padStart(2,"0");return `${h}:${m}:${s}`}
function renderTimer(){
  if(timerTick){clearInterval(timerTick);timerTick=null}
  const draw=()=>{const active=state.timer.active&&state.timer.start;const seconds=active?(Date.now()-new Date(state.timer.start).getTime())/1000:0;$("#timerClock").textContent=formatDuration(seconds);const idleText=state.timer.lastStopReason==="idle"?"上一段已因连续5分钟无学习区操作自动结束。":"当前处于自动计时待机。";$("#timerStatus").textContent=active?`自动计时中：本次从 ${new Date(state.timer.start).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})} 开始；连续5分钟无“今日学习”操作将自动结束。`:`${idleText} 进入“今日学习”并点击、触摸、输入或滚动会重新开始。今天已记录 ${todayHours().toFixed(2)} 小时。`;$("#clockIn").disabled=!!active;$("#clockOut").disabled=!active};
  draw();if(state.timer.active)timerTick=setInterval(draw,1000);
}
function todayHours(){const today=localDate();return state.journals.filter(j=>j.date===today).reduce((s,j)=>s+Number(j.hours||0),0)}
function startTimer(source="auto"){
  if(state.timer.active)return;
  const now=new Date().toISOString();state.timer.active=true;state.timer.start=now;state.timer.lastActivity=now;state.timer.lastStopReason=null;state.timer.startedBy=source;save();renderTimer();
}
function finishTimer(endDate=new Date(),notifyUser=false,reason="manual"){
  if(!state.timer.active||!state.timer.start)return;
  const start=new Date(state.timer.start),end=new Date(Math.max(start.getTime()+1000,new Date(endDate).getTime())),seconds=Math.max(1,Math.round((end-start)/1000)),date=localDate(start);
  state.timer.sessions.push({id:`s-${Date.now()}`,date,start:start.toISOString(),end:end.toISOString(),seconds,reason});state.timer.active=false;state.timer.start=null;state.timer.lastActivity=null;state.timer.lastStopReason=reason;state.timer.lastStoppedAt=end.toISOString();
  let journal=state.journals.find(j=>j.date===date);if(!journal){journal={id:`j-${Date.now()}`,date,hours:0,status:"进行中",plan:"",done:"",outputs:"",problems:"",next:""};state.journals.push(journal)}journal.hours=Number(journal.hours||0)+seconds/3600;
  save();renderTimer();renderJournalList();renderDashboard();if(notifyUser)alert(`本次学习 ${formatDuration(seconds)}，已计入 ${date}。`);
}
function clockOut(){finishTimer(new Date(),true,"manual")}
function reconcileIdleTimer(){
  if(!state.timer.active||!state.timer.start)return false;const last=new Date(state.timer.lastActivity||state.timer.start).getTime();if(!Number.isFinite(last)||Date.now()-last<IDLE_LIMIT_MS)return false;finishTimer(new Date(last+IDLE_LIMIT_MS),false,"idle");return true;
}
function registerStudyActivity(){
  if(!$("#learnView").classList.contains("active"))return;const now=Date.now();if(state.timer.active){if(reconcileIdleTimer()){startTimer("auto");return}state.timer.lastActivity=new Date(now).toISOString();if(now-lastActivityPersistAt>10000){lastActivityPersistAt=now;localStorage.setItem(KEY,JSON.stringify(state))}}else startTimer("auto");
}
function setupActivityTracking(){
  const learnView=$("#learnView");["pointerdown","keydown","touchstart"].forEach(type=>learnView.addEventListener(type,registerStudyActivity,{passive:true}));window.addEventListener("scroll",()=>{if(learnView.classList.contains("active"))registerStudyActivity()},{passive:true});document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")reconcileIdleTimer()});if(activityCheckTick)clearInterval(activityCheckTick);activityCheckTick=setInterval(reconcileIdleTimer,15000);
}
function heatLevel(hours){return hours<=0?0:hours<=1?1:hours<=3?2:hours<=5?3:4}
function renderCalendar(){
  const y=calendarCursor.getFullYear(),m=calendarCursor.getMonth(),first=new Date(y,m,1),days=new Date(y,m+1,0).getDate(),offset=(first.getDay()+6)%7,today=localDate();
  const totals={};state.journals.forEach(j=>totals[j.date]=(totals[j.date]||0)+Number(j.hours||0));$("#calendarMonth").textContent=`${y} 年 ${m+1} 月`;
  let html="";for(let i=0;i<offset;i++)html+='<span class="calendar-day empty"></span>';
  for(let d=1;d<=days;d++){const date=`${y}-${String(m+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`,hours=totals[date]||0;html+=`<button class="calendar-day heat-${heatLevel(hours)} ${date===today?"today":""}" data-calendar-date="${date}" title="${date}：${hours.toFixed(2)} 小时"><span>${d}</span><small>${hours?hours.toFixed(hours<1?1:1)+"h":""}</small></button>`}$("#studyCalendar").innerHTML=html;
  $$('[data-calendar-date]').forEach(b=>b.onclick=()=>{const date=b.dataset.calendarDate,j=state.journals.find(x=>x.date===date);goView("journal");if(j)editJournal(j.id);else{resetJournalForm();$("#journalDate").value=date}});
}
function markdownParts(text){const parts={};let key="";text.split(/\r?\n/).forEach(line=>{const h=line.match(/^#{2,3}\s+(.+)/);if(h){key=h[1].trim();parts[key]="";return}if(key)parts[key]+=(parts[key]?"\n":"")+line});Object.keys(parts).forEach(k=>parts[k]=parts[k].trim());return parts}
function pickPart(parts,names){for(const name of names){const key=Object.keys(parts).find(k=>k===name||k.includes(name));if(key)return parts[key]}return ""}
function parseJournalPaste(){const text=$("#journalPaste").value.trim();if(!text)return alert("请先粘贴整篇日记");const p=markdownParts(text),date=(text.match(/(?:日期|学习日期)\s*[：:]\s*(\d{4}-\d{1,2}-\d{1,2})/)||[])[1],hours=(text.match(/学习时长\s*[：:]\s*([\d.]+)/)||[])[1],status=(text.match(/状态\s*[：:]\s*([^\n]+)/)||[])[1];if(date)$("#journalDate").value=date;if(hours)$("#journalHours").value=hours;if(status&&[...$("#journalStatus").options].some(o=>o.value===status.trim()))$("#journalStatus").value=status.trim();$("#journalPlan").value=pickPart(p,["当天学习计划","学习计划"]);$("#journalDone").value=pickPart(p,["实际完成情况","完成情况"]);$("#journalOutputs").value=pickPart(p,["产出与证据","学习产出","产出"]);$("#journalProblems").value=pickPart(p,["困惑与问题","问题与困惑","问题"]);$("#journalNext").value=pickPart(p,["下一步计划","下一步"]);$("#parseJournalPaste").textContent="已拆分 ✓";setTimeout(()=>$("#parseJournalPaste").textContent="自动拆分到下方",1200)}
function parsePlansPaste(){const text=$("#plansPaste").value.trim();if(!text)return alert("请先粘贴整份计划");const p=markdownParts(text),progress=(text.match(/当前完成进度\s*[：:]\s*(\d+)/)||[])[1];$("#totalPlan").value=pickPart(p,["总计划"]);$("#quarterPlan").value=pickPart(p,["季度计划"]);$("#monthPlan").value=pickPart(p,["月计划","月度计划"]);$("#currentPlan").value=pickPart(p,["当前计划"]);$("#nextPlan").value=pickPart(p,["下一步计划","下一步"]);const review=pickPart(p,["周复盘"]);if(review)$("#weeklyReview").value=review;if(progress){$("#manualProgress").value=progress;$("#manualProgressLabel").textContent=`${progress}%`}$("#parsePlansPaste").textContent="已拆分 ✓";setTimeout(()=>$("#parsePlansPaste").textContent="自动拆分到下方",1200)}
function renderDashboard(){
  const pct=Math.max(0,Math.min(100,Number(state.plans.progress)||0));$("#overallPercent").textContent=`${pct}%`;$("#overallRing").style.setProperty("--ring",`${pct}%`);$("#totalHours").textContent=`${state.journals.reduce((s,j)=>s+Number(j.hours||0),0).toFixed(1)}h`;$("#studyDays").textContent=new Set(state.journals.map(j=>j.date)).size;$("#taskProgressMini").textContent=$("#progressText").textContent;$("#studyStreak").textContent=`${streakCount()}天`;$("#currentPlanPreview").textContent=state.plans.current||"尚未录入当前计划。";$("#nextPlanPreview").textContent=state.plans.next||"尚未录入下一步计划。";$("#dashboardNext").textContent=state.plans.next?state.plans.next.split("\n")[0]:"尚未填写下一步计划。";
  const recent=[...state.journals].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,3);$("#recentJournal").innerHTML=recent.length?recent.map(j=>`<div class="timeline-item"><strong>${esc(j.date)} · ${esc(j.status)} · ${Number(j.hours||0).toFixed(2)}h</strong><p>${esc(j.outputs||j.done||"已记录当天学习")}</p></div>`).join(""):'<div class="empty-state">暂无记录。点击“记录今天”开始第一篇学习日记。</div>';
  renderCalendar();
}
function download(name,text,type="text/markdown"){const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([text],{type}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),500)}
function exportAllData(){download(`学习助手全部数据_${localDate()}.json`,JSON.stringify({format:"study-task-helper",version:1,exportedAt:new Date().toISOString(),state},null,2),"application/json")}
async function importAllData(file){
  if(!file)return;let data;try{data=JSON.parse(await file.text())}catch(e){return alert("这个文件不是有效的 JSON 数据，请重新选择。")}
  const incoming=data?.format==="study-task-helper"?data.state:data;
  if(!incoming||typeof incoming!=="object"||(!("journals" in incoming)&&!("plans" in incoming)&&!("source" in incoming)))return alert("没有识别到学习助手数据，请选择由本软件导出的备份文件。");
  if(!confirm("导入会替换这台设备上现有的学习记录。确定继续吗？")){$("#importDeviceData").value="";return}
  state={...state,...incoming};localStorage.setItem(KEY,JSON.stringify(state));alert("数据导入成功，页面将重新载入。");location.reload();
}
function setupPortableApp(){
  const standalone=window.matchMedia("(display-mode: standalone)").matches||window.navigator.standalone==true;
  $("#appMode").textContent=standalone?"已安装":"本机保存";
  const isiPad=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==="MacIntel"&&navigator.maxTouchPoints>1);
  if(isiPad&&!standalone)$("#iosInstallHint").classList.remove("hidden");
  window.addEventListener("beforeinstallprompt",event=>{event.preventDefault();installPrompt=event;$("#installApp").classList.remove("hidden")});
  window.addEventListener("appinstalled",()=>{$("#installApp").classList.add("hidden");$("#appMode").textContent="已安装"});
  if("serviceWorker" in navigator&&location.protocol.startsWith("http"))navigator.serviceWorker.register("./sw.js").catch(()=>{});
}
$("#formatHelp").textContent=FORMAT;
$("#loadSample").onclick=()=>{$("#taskInput").value=SAMPLE};
$("#taskFileInput").onchange=async e=>{const file=e.target.files[0];if(!file)return;if(!file.name.toLowerCase().endsWith(".md")){$("#taskFileInput").value="";return alert("请选择 .md 格式的助手文档")};if(file.size>2*1024*1024){$("#taskFileInput").value="";return alert("Markdown 文件超过 2MB，请检查是否选错文件")};try{$("#taskInput").value=await file.text();$("#taskInput").focus();$("#taskFileInput").closest("label").childNodes[0].textContent="已导入 ✓";setTimeout(()=>$("#taskFileInput").closest("label").childNodes[0].textContent="导入 Markdown",1400)}catch(error){alert("文件读取失败，请重新选择")}};
$("#parseTask").onclick=()=>{state.source=$("#taskInput").value.trim();state.date=$("#studyDate").value;state.lesson=sections(state.source);state.answers={};state.done={};state.cardDone={};state.cardNotes={};state.cardImportant={};renderLesson()};
$("#editSource").onclick=()=>{$("#lessonPanel").classList.add("hidden");$("#inputPanel").classList.remove("hidden")};
$("#jumpIncomplete").onclick=jumpToFirstIncomplete;
$("#backToLessonTop").onclick=()=>$("#lessonPanel").scrollIntoView({behavior:"smooth",block:"start"});
function goView(name){$$(".nav").forEach(x=>x.classList.toggle("active",x.dataset.view===name));$$(".view").forEach(v=>v.classList.remove("active"));$("#"+name+"View").classList.add("active");if(name==="homework")$("#homeworkPreview").value=homework();if(name==="dashboard")renderDashboard();if(name==="journal")renderJournalList();if(name==="plans")fillPlans()}
$$(".nav").forEach(b=>b.onclick=()=>goView(b.dataset.view));
$("#documentEditor").oninput=e=>{state.notes=e.target.value;save()};
$$("[data-insert]").forEach(b=>b.onclick=()=>{const e=$("#documentEditor"),s=e.selectionStart;e.value=e.value.slice(0,s)+b.dataset.insert+e.value.slice(e.selectionEnd);e.focus();e.selectionStart=e.selectionEnd=s+b.dataset.insert.length;state.notes=e.value;save()});
$("#insertLesson").onclick=()=>{if(!state.lesson)return alert("请先载入当天任务");$("#documentEditor").value+=(state.notes?"\n\n":"")+`# ${state.lesson.title}\n\n## 当前任务\n${state.lesson.task}\n\n## 任务讲解\n${state.lesson.explanation}\n\n## 知识点\n`+state.lesson.knowledge.map(k=>`### ${k.title}\n${k.body}`).join("\n\n");state.notes=$("#documentEditor").value;save()};
$("#copyHomework").onclick=async()=>{await navigator.clipboard.writeText(homework());$("#copyHomework").textContent="已复制";setTimeout(()=>$("#copyHomework").textContent="复制全文",1200)};
$("#exportMd").onclick=()=>download(`${state.date}_${state.lesson?.title||"当天作业"}.md`,homework());
$("#exportArchive").onclick=()=>download(`完整学习档案_${new Date().toISOString().slice(0,10)}.md`,archiveMarkdown());
$("#exportJson").onclick=()=>download(`${state.date}_学习数据.json`,JSON.stringify(state,null,2),"application/json");
$("#exportDeviceData").onclick=exportAllData;
$("#importDeviceData").onchange=e=>importAllData(e.target.files[0]);
$("#installApp").onclick=async()=>{if(!installPrompt)return;installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;$("#installApp").classList.add("hidden")};
$("#clockIn").onclick=()=>startTimer("manual");
$("#clockOut").onclick=clockOut;
$("#calendarPrev").onclick=()=>{calendarCursor=new Date(calendarCursor.getFullYear(),calendarCursor.getMonth()-1,1);renderCalendar()};
$("#calendarNext").onclick=()=>{calendarCursor=new Date(calendarCursor.getFullYear(),calendarCursor.getMonth()+1,1);renderCalendar()};
$("#parseJournalPaste").onclick=parseJournalPaste;
$("#parsePlansPaste").onclick=parsePlansPaste;
$("#savePlans").onclick=()=>{state.plans={total:$("#totalPlan").value,quarter:$("#quarterPlan").value,month:$("#monthPlan").value,current:$("#currentPlan").value,next:$("#nextPlan").value,progress:Number($("#manualProgress").value)||0};state.weeklyReview=$("#weeklyReview").value;save();renderDashboard();$("#savePlans").textContent="已保存";setTimeout(()=>$("#savePlans").textContent="保存全部计划",1200)};
$("#manualProgress").oninput=e=>$("#manualProgressLabel").textContent=`${e.target.value}%`;
$("#saveJournal").onclick=()=>{const date=$("#journalDate").value;if(!date)return alert("请先选择日期");const id=$("#journalId").value||`j-${Date.now()}`;const entry={id,date,hours:Number($("#journalHours").value)||0,status:$("#journalStatus").value,plan:$("#journalPlan").value.trim(),done:$("#journalDone").value.trim(),outputs:$("#journalOutputs").value.trim(),problems:$("#journalProblems").value.trim(),next:$("#journalNext").value.trim()};const index=state.journals.findIndex(j=>j.id===id);if(index>=0)state.journals[index]=entry;else state.journals.push(entry);save();resetJournalForm();renderJournalList();renderDashboard();$("#saveJournal").textContent="已保存 ✓";setTimeout(()=>$("#saveJournal").textContent="保存日记",1200)};
$("#newJournalEntry").onclick=resetJournalForm;
$("#quickJournal").onclick=()=>{goView("journal");resetJournalForm()};
$$(".jump-plan").forEach(b=>b.onclick=()=>goView("plans"));
$("#exportJournal").onclick=()=>download(`学习日记汇总_${new Date().toISOString().slice(0,10)}.md`,journalMarkdown());
$("#copyWeeklyReview").onclick=async()=>{const text=$("#weeklyReview").value||"本周完成：\n关键产出：\n遇到的问题：\n下周重点：\n需要老师指导：";try{await navigator.clipboard.writeText(text);$("#copyWeeklyReview").textContent="已复制"}catch(e){$("#weeklyReview").value=text;$("#weeklyReview").select();document.execCommand("copy")}setTimeout(()=>$("#copyWeeklyReview").textContent="复制模板",1200)};
$("#newDay").onclick=()=>{if(confirm("确定清空当前学习任务、回答和学习文档，开始新一天吗？计划中心和学习日记会保留。")){state.source="";state.lesson=null;state.answers={};state.done={};state.notes="";state.cardDone={};state.cardNotes={};state.cardImportant={};state.date=new Date().toISOString().slice(0,10);save();location.reload()}};
load();
setupPortableApp();
setupActivityTracking();
