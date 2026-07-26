const categories = ['Procurement','Admin & Finance','Communication & Follow-Up','Scheduling & Coordination','Project Work','Problems to Solve','Research / Figure Out','General Task'];
const domains = ['Business','Personal','Home','Health','Family','Learning'];
const requesters = ['Self','Dan','Customer','Team','Vendor','System','Other'];
const flags = ['Urgent','Time-Sensitive','Waiting On','Quick Task','Deep Work'];
const statuses = ['Inbox','Open','Waiting','Done','Archived'];
const reviewStorageKey = 'alixsbrain.activeSundayReviewId';
let items = [];
let currentView = 'tasks';
let reviewGuide = [];
let reviewSession = null;
let viewedStep = 1;
let questionIndex = 0;
let answerWasPasted = false;

async function api(path, options={}) {
  const response = await fetch(path,{...options,headers:{'content-type':'application/json',...(options.headers||{})}});
  if(!response.ok){const detail=await response.json().catch(()=>({}));throw new Error(detail.error||`Request failed (${response.status})`);}
  return response.status===204?null:response.json();
}
function setStatus(message,error=false){const el=document.getElementById('status');el.textContent=message;el.classList.toggle('error',error);}
function formatDate(value){return new Intl.DateTimeFormat(undefined,{dateStyle:'medium',timeStyle:'short'}).format(new Date(value));}
function option(select,value,label=value){const el=document.createElement('option');el.value=value;el.textContent=label;select.appendChild(el);}
function fillSelect(id,values){const select=document.getElementById(id);values.forEach(value=>option(select,value));}
function localDate(value){if(!value)return '';const date=new Date(value);const offset=date.getTimezoneOffset()*60000;return new Date(date-offset).toISOString().slice(0,16);}
function storedReviewId(){try{return localStorage.getItem(reviewStorageKey);}catch{return null;}}
function rememberReview(id){try{if(id)localStorage.setItem(reviewStorageKey,id);else localStorage.removeItem(reviewStorageKey);}catch{/* D1 remains authoritative */}}

function matches(item){
  const status=document.getElementById('filter-status').value;
  const category=document.getElementById('filter-category').value;
  const domain=document.getElementById('filter-domain').value;
  const requester=document.getElementById('filter-requester').value;
  return (status==='all'||(status==='active'?['Inbox','Open','Waiting'].includes(item.status):item.status===status)) &&
    (category==='all'||item.primary_category===category) && (domain==='all'||item.domain===domain) &&
    (requester==='all'||item.requested_by===requester);
}
function badge(container,text,className=''){if(!text)return;const el=document.createElement('span');el.className=`badge ${className}`;el.textContent=text;container.appendChild(el);}

function renderTasks(){
  const list=document.getElementById('items');const visible=items.filter(matches);list.replaceChildren();
  document.getElementById('visible-count').textContent=visible.length;document.getElementById('empty').hidden=visible.length!==0;
  for(const item of visible){
    const card=document.getElementById('item-template').content.firstElementChild.cloneNode(true);
    card.dataset.status=item.status;card.querySelector('h3').textContent=item.title;
    const badges=card.querySelector('.badges');badge(badges,item.status,`status-${item.status.toLowerCase()}`);badge(badges,item.primary_category);badge(badges,item.domain);badge(badges,item.requested_by?`By ${item.requested_by}`:'');(item.flags||[]).forEach(flag=>badge(badges,flag,'flag'));
    const raw=card.querySelector('.raw-text');raw.textContent=item.raw_text;raw.hidden=item.raw_text===item.title;
    card.querySelector('.meta').textContent=`${item.source} · ${formatDate(item.created_at)}${item.project?` · ${item.project}`:''}${item.due_at?` · Due ${formatDate(item.due_at)}`:''}`;
    const done=card.querySelector('.done');done.textContent=item.status==='Done'?'Reopen':'Done';done.disabled=!item.primary_category;done.title=done.disabled?'Choose a category first':'';
    done.addEventListener('click',()=>quickUpdate(item,{status:item.status==='Done'?'Open':'Done'},done));
    const archive=card.querySelector('.archive');archive.textContent=item.status==='Archived'?'Restore':'Archive';archive.addEventListener('click',event=>quickUpdate(item,{status:item.status==='Archived'?(item.primary_category?'Open':'Inbox'):'Archived'},event.currentTarget));
    card.querySelector('.delete').addEventListener('click',()=>removeItem(item));
    const editor=card.querySelector('.editor');card.querySelector('.edit').addEventListener('click',()=>{editor.hidden=!editor.hidden;});card.querySelector('.cancel').addEventListener('click',()=>{editor.hidden=true;});
    setupEditor(editor,item);list.appendChild(card);
  }
}

function setupEditor(form,item){
  form.elements.title.value=item.title;
  const category=form.elements.primary_category;categories.forEach(value=>option(category,value));category.value=item.primary_category||'';
  const domain=form.elements.domain;domains.forEach(value=>option(domain,value));domain.value=item.domain||'';
  const requester=form.elements.requested_by;requesters.forEach(value=>option(requester,value));requester.value=item.requested_by||'';
  form.elements.project.value=item.project||'';form.elements.due_at.value=localDate(item.due_at);
  statuses.forEach(value=>option(form.elements.status,value));form.elements.status.value=item.status;
  const flagBox=form.querySelector('.flag-options');for(const value of flags){const label=document.createElement('label');label.className='flag-check';label.innerHTML=`<input type="checkbox" value="${value}"> ${value}`;label.querySelector('input').checked=(item.flags||[]).includes(value);flagBox.appendChild(label);}
  form.addEventListener('submit',async event=>{event.preventDefault();const button=event.submitter;button.disabled=true;try{
    const categoryValue=form.elements.primary_category.value;let status=form.elements.status.value;if(categoryValue&&status==='Inbox')status='Open';
    await api(`/api/items/${encodeURIComponent(item.id)}`,{method:'PATCH',body:JSON.stringify({title:form.elements.title.value,primary_category:categoryValue||null,domain:form.elements.domain.value||null,requested_by:form.elements.requested_by.value||null,project:form.elements.project.value||null,due_at:form.elements.due_at.value?new Date(form.elements.due_at.value).toISOString():null,status,flags:[...form.querySelectorAll('.flag-check input:checked')].map(input=>input.value)})});await loadTasks();
  }catch(error){setStatus(error.message,true);button.disabled=false;}});
}
async function quickUpdate(item,change,button){button.disabled=true;try{await api(`/api/items/${encodeURIComponent(item.id)}`,{method:'PATCH',body:JSON.stringify(change)});await loadTasks();}catch(error){setStatus(error.message,true);button.disabled=false;}}
async function removeItem(item){if(!confirm(`Permanently delete “${item.title}”? This also deletes its raw capture and cannot be undone from the dashboard.`))return;try{await api(`/api/items/${encodeURIComponent(item.id)}`,{method:'DELETE'});await loadTasks();}catch(error){setStatus(error.message,true);}}
async function loadTasks(){setStatus('Refreshing tasks…');try{items=await api('/api/items');renderTasks();setStatus(`Up to date · ${items.filter(item=>item.status==='Inbox').length} inbox · ${items.filter(item=>['Open','Waiting'].includes(item.status)).length} active`);}catch(error){setStatus(error.message,true);}}

function switchView(view){
  currentView=view;
  document.getElementById('tasks-view').hidden=view!=='tasks';
  document.getElementById('review-view').hidden=view!=='review';
  document.getElementById('health-view').hidden=view!=='health';
  document.querySelectorAll('.tab').forEach(tab=>{const active=tab.dataset.view===view;tab.classList.toggle('active',active);tab.setAttribute('aria-selected',String(active));});
  if(view==='review') initializeReview();
  if(view==='health') initializeHealth();
}

function isoLocalDate(date){const offset=date.getTimezoneOffset()*60000;return new Date(date-offset).toISOString().slice(0,10);}
function mondayFor(date){const result=new Date(date);result.setDate(result.getDate()-((result.getDay()+6)%7));return isoLocalDate(result);}
function healthNumber(value,digits=0){return value===null||value===undefined?'Missing':Number(value).toLocaleString(undefined,{maximumFractionDigits:digits});}
function healthCell(value,suffix=''){return value===null||value===undefined?'—':`${healthNumber(value,1)}${suffix}`;}
function metricCard(container,label,value,detail){const card=document.createElement('article');card.className='metric-card';const name=document.createElement('p');name.className='metric-label';name.textContent=label;const number=document.createElement('strong');number.textContent=value;const note=document.createElement('p');note.className='meta';note.textContent=detail;card.append(name,number,note);container.appendChild(card);}
function compactRow(container,name,value){const row=document.createElement('div');row.className='compact-row';const label=document.createElement('span');label.textContent=name;const detail=document.createElement('strong');detail.textContent=value;row.append(label,detail);container.appendChild(row);}

async function initializeHealth(){
  const timezone=document.getElementById('health-timezone');
  if(!timezone.value)timezone.value=Intl.DateTimeFormat().resolvedOptions().timeZone||'America/Chicago';
  const start=document.getElementById('health-week-start');
  if(!start.value)start.value=mondayFor(new Date());
  await loadHealthWeek();
}

async function loadHealthWeek(){
  const start=document.getElementById('health-week-start').value;
  const timezone=document.getElementById('health-timezone').value;
  if(!start||!timezone){setStatus('Choose a health week and timezone.',true);return;}
  setStatus('Loading stored health week…');
  try{
    const summary=await api(`/api/health/weekly?${new URLSearchParams({week_start:start,timezone})}`);
    renderHealthWeek(summary);
    setStatus(`Health week loaded · ${summary.coverage.stored_days}/7 stored days`);
  }catch(error){document.getElementById('health-results').hidden=true;setStatus(error.message,true);}
}

function renderHealthWeek(summary){
  document.getElementById('health-results').hidden=false;
  document.getElementById('health-week-label').textContent=`${summary.week_start} through ${summary.week_end}`;
  document.getElementById('health-coverage').textContent=`${summary.coverage.stored_days}/7 stored days · ${summary.timezone} · retrieved ${formatDate(summary.retrieved_at)}`;
  const warningList=document.getElementById('health-warnings');warningList.replaceChildren();warningList.hidden=summary.warnings.length===0;
  summary.warnings.forEach(text=>{const item=document.createElement('li');item.textContent=text;warningList.appendChild(item);});

  const metrics=document.getElementById('health-metrics');metrics.replaceChildren();const m=summary.metrics;
  metricCard(metrics,'Steps',healthNumber(m.steps.total),`${m.steps.coverage_days}/7 days · ${healthNumber(m.steps.average_recorded_day)} average recorded day`);
  metricCard(metrics,'Sleep',m.sleep_minutes.average_recorded_day===null?'Missing':`${healthNumber(m.sleep_minutes.average_recorded_day/60,1)} hr/day`,`${m.sleep_minutes.coverage_days}/7 days · ${healthNumber(m.sleep_minutes.total/60,1)} total hours`);
  metricCard(metrics,'Food energy',m.food_energy_kilocalories.total===null?'Missing':`${healthNumber(m.food_energy_kilocalories.total)} kcal`,`${m.food_energy_kilocalories.coverage_days}/7 logged days`);
  metricCard(metrics,'Energy burned',m.energy_burned_kilocalories.total===null?'Missing':`${healthNumber(m.energy_burned_kilocalories.total)} kcal`,`${m.energy_burned_kilocalories.coverage_days}/7 days · basal + active`);
  metricCard(metrics,'Energy balance',m.energy_balance_kilocalories===null?'Not calculated':`${m.energy_balance_kilocalories>0?'+':''}${healthNumber(m.energy_balance_kilocalories)} kcal`,m.energy_balance_kilocalories===null?'Requires complete food and burn coverage':'Logged food minus total burned');
  metricCard(metrics,'Water',m.water_milliliters.total===null?'Missing':`${healthNumber(m.water_milliliters.total/1000,1)} L`,`${m.water_milliliters.coverage_days}/7 logged days`);
  metricCard(metrics,'Weight',m.weight_kilograms.average===null?'Missing':`${healthNumber(m.weight_kilograms.average,1)} kg`,`${m.weight_kilograms.coverage_days}/7 measured days`);
  metricCard(metrics,'Resting heart rate',m.resting_heart_rate_bpm.average===null?'Missing':`${healthNumber(m.resting_heart_rate_bpm.average)} bpm`,`${m.resting_heart_rate_bpm.coverage_days}/7 measured days`);

  const exercise=document.getElementById('health-exercises');exercise.replaceChildren();const exerciseEntries=Object.entries(summary.exercises);
  if(!exerciseEntries.length)compactRow(exercise,'No exercise records','Missing');
  exerciseEntries.sort((a,b)=>b[1].minutes-a[1].minutes).forEach(([name,value])=>compactRow(exercise,name,`${value.sessions} session${value.sessions===1?'':'s'} · ${healthNumber(value.minutes)} min`));
  const nutrients=document.getElementById('health-nutrients');nutrients.replaceChildren();const nutrientEntries=Object.entries(summary.nutrients);
  if(!nutrientEntries.length)compactRow(nutrients,'No nutrients logged','Missing');
  nutrientEntries.sort((a,b)=>a[0].localeCompare(b[0])).forEach(([name,value])=>compactRow(nutrients,name,`${value.coverage_days}/7 days`));
  const sources=document.getElementById('health-sources');sources.replaceChildren();
  if(!summary.source_packages.length)compactRow(sources,'No source packages','Missing');
  summary.source_packages.forEach(source=>compactRow(sources,source,'Observed'));

  const body=document.getElementById('health-days');body.replaceChildren();
  summary.days.forEach(day=>{const row=document.createElement('tr');[
    day.local_date,healthCell(day.steps),healthCell(day.sleep_minutes,' min'),healthCell(day.food_energy_kilocalories,' kcal'),
    healthCell(day.energy_burned_kilocalories,' kcal'),healthCell(day.water_milliliters,' mL'),healthCell(day.average_weight_kilograms,' kg')
  ].forEach(value=>{const cell=document.createElement('td');cell.textContent=value;row.appendChild(cell);});body.appendChild(row);});
}

async function initializeReview(){
  if(!reviewGuide.length){try{reviewGuide=await api('/api/reviews/guide');}catch(error){setStatus(error.message,true);return;}}
  const timezone=document.getElementById('review-timezone');
  if(!timezone.value)timezone.value=Intl.DateTimeFormat().resolvedOptions().timeZone||'America/Chicago';
  const saved=storedReviewId();document.getElementById('resume-saved').hidden=!saved;
  if(reviewSession){renderReview();setStatus('Sunday Review loaded.');return;}
  if(saved){try{await loadReview(saved);return;}catch{rememberReview(null);document.getElementById('resume-saved').hidden=true;}}
  showReviewStart();setStatus('Choose a week to start or resume your Sunday Review.');
}

function showReviewStart(){
  reviewSession=null;
  document.getElementById('review-start').hidden=false;
  document.getElementById('review-session').hidden=true;
}

async function loadReview(id){
  setStatus('Loading Sunday Review…');
  reviewSession=await api(`/api/reviews/${encodeURIComponent(id)}`);
  rememberReview(reviewSession.id);
  viewedStep=Math.min(reviewSession.current_step,13);
  questionIndex=firstUnansweredQuestionIndex(viewedStep);
  renderReview();
  setStatus(`Review restored · last saved ${formatDate(reviewSession.updated_at)}`);
}

function stepState(step){return reviewSession.steps.find(value=>value.step===step)?.state||null;}
function currentDefinition(){return reviewGuide.find(value=>value.step===viewedStep);}
function currentQuestion(){return currentDefinition()?.questions[questionIndex];}
function answerFor(step,fieldKey){return reviewSession.answers.find(answer=>answer.step===step&&answer.field_key===fieldKey);}
function firstUnansweredQuestionIndex(stepNumber){
  const step=reviewGuide.find(value=>value.step===stepNumber);if(!step?.questions.length)return 0;
  const index=step.questions.findIndex(question=>!answerFor(stepNumber,question.field_key));
  return index<0?step.questions.length-1:index;
}

function renderReview(){
  document.getElementById('review-start').hidden=true;
  document.getElementById('review-session').hidden=false;
  document.getElementById('review-week-label').textContent=`${reviewSession.week_start} through ${reviewSession.week_end}`;
  document.getElementById('review-session-meta').textContent=`${reviewSession.timezone} · ${reviewSession.task_references.length} task references · Tasks retrieved ${formatDate(reviewSession.task_retrieved_at)} · ${reviewSession.status.replaceAll('_',' ')}`;
  renderReviewProgress();

  const terminal=['completed','abandoned','archived'].includes(reviewSession.status);
  document.getElementById('review-restart').hidden=terminal;
  document.getElementById('review-abandon').hidden=terminal;
  document.getElementById('review-archive').hidden=reviewSession.status==='archived';
  const ready=document.getElementById('review-ready');
  ready.hidden=reviewSession.status!=='ready_for_packet'&&!terminal;
  if(terminal){ready.querySelector('h3').textContent=`Review ${reviewSession.status}`;ready.querySelector('p:last-child').textContent='This saved review is read-only. Start a new week or return to Tasks.';}
  else{ready.querySelector('h3').textContent='Ready for the planning packet';ready.querySelector('p:last-child').textContent='Your answers and task references are saved. Packet generation is the next milestone and is not active yet.';}
  document.getElementById('review-question-card').hidden=terminal;
  if(!terminal)renderReviewQuestion();
}

function renderReviewProgress(){
  const progress=document.getElementById('review-progress');progress.replaceChildren();
  for(const step of reviewGuide){
    const state=stepState(step.step);const li=document.createElement('li');const button=document.createElement('button');button.type='button';
    button.className=[step.step===viewedStep?'current':'',state||'',step.automatic?'automatic':''].filter(Boolean).join(' ');
    button.title=`Step ${step.step}: ${step.title}${state?` (${state})`:''}`;
    const number=document.createElement('span');number.className='number';number.textContent=String(step.step);
    const title=document.createElement('span');title.className='short-title';title.textContent=step.title;
    button.append(number,title);button.addEventListener('click',()=>{viewedStep=step.step;questionIndex=0;renderReview();});li.appendChild(button);progress.appendChild(li);
  }
}

function renderReviewQuestion(){
  const step=currentDefinition();if(!step)return;
  document.getElementById('review-step-count').textContent=`Step ${step.step} of 13${stepState(step.step)?` · ${stepState(step.step)}`:''}`;
  document.getElementById('review-step-title').textContent=step.title;
  document.getElementById('review-step-purpose').textContent=step.purpose;
  const form=document.getElementById('review-answer-form');
  form.hidden=step.automatic;
  document.getElementById('review-skip-section').hidden=!step.skippable;
  document.getElementById('review-previous').disabled=step.step===1;
  document.getElementById('review-next').disabled=step.step===13;
  document.getElementById('review-save-state').textContent=step.automatic?'Completed automatically from canonical tasks.':'';
  const taskContext=document.getElementById('review-task-context');taskContext.hidden=!step.automatic;taskContext.replaceChildren();
  if(step.automatic){
    const note=document.createElement('p');note.className='review-task-note';note.textContent='Current canonical values for the task IDs referenced when this review began. Later task edits may differ from the original retrieval time.';taskContext.appendChild(note);
    const referenced=new Set(reviewSession.task_references);const reviewItems=items.filter(item=>referenced.has(item.id));
    if(!reviewItems.length){const empty=document.createElement('p');empty.className='empty';empty.textContent='No currently readable canonical tasks match this review’s saved references.';taskContext.appendChild(empty);}
    for(const item of reviewItems){const row=document.createElement('div');row.className='review-task-row';const title=document.createElement('strong');title.textContent=item.raw_text;const meta=document.createElement('span');meta.textContent=[item.status,item.domain,item.project,item.due_at?`Due ${formatDate(item.due_at)}`:null].filter(Boolean).join(' · ');row.append(title,meta);taskContext.appendChild(row);}
    return;
  }

  questionIndex=Math.min(questionIndex,Math.max(0,step.questions.length-1));
  const question=currentQuestion();const answer=answerFor(step.step,question.field_key);
  document.getElementById('review-question-label').textContent=question.prompt;
  document.getElementById('review-question-help').textContent=question.help;
  const textarea=document.getElementById('review-answer');textarea.value=answer?.raw_input||'';
  answerWasPasted=answer?.input_kind==='pasted';
  document.querySelectorAll('.answer-choices .choice').forEach(button=>button.classList.toggle('selected',button.dataset.kind===answer?.response_kind));
  const submit=form.querySelector('button[type="submit"]');
  submit.textContent=questionIndex===step.questions.length-1?'Save and finish section':'Save and continue';
  document.getElementById('review-save-state').textContent=answer?`Saved ${formatDate(answer.updated_at)}`:'';
}

async function saveReviewResponse(responseKind,rawInput=null){
  const step=currentDefinition();const question=currentQuestion();if(!question)return;
  setReviewBusy(true);setStatus('Saving review answer…');
  try{
    reviewSession=await api(`/api/reviews/${encodeURIComponent(reviewSession.id)}/answers/${step.step}/${encodeURIComponent(question.field_key)}`,{
      method:'PUT',body:JSON.stringify({response_kind:responseKind,input_kind:responseKind==='answered'&&answerWasPasted?'pasted':'typed',raw_input:rawInput})
    });
    if(questionIndex<step.questions.length-1){questionIndex+=1;renderReview();}
    else{
      reviewSession=await api(`/api/reviews/${encodeURIComponent(reviewSession.id)}/steps/${step.step}`,{method:'PUT',body:JSON.stringify({state:'completed'})});
      viewedStep=Math.min(reviewSession.current_step,13);questionIndex=0;renderReview();
    }
    setStatus(`Answer saved · ${formatDate(reviewSession.updated_at)}`);
  }catch(error){setStatus(error.message,true);}finally{setReviewBusy(false);}
}

function setReviewBusy(busy){
  if(busy)document.querySelectorAll('#review-session button,#review-session textarea').forEach(control=>control.disabled=true);
  else if(reviewSession){
    document.querySelectorAll('#review-session button,#review-session textarea').forEach(control=>control.disabled=false);
    renderReview();
  }
}
async function skipReviewSection(){
  const step=currentDefinition();if(!step?.skippable)return;
  setReviewBusy(true);try{
    reviewSession=await api(`/api/reviews/${encodeURIComponent(reviewSession.id)}/steps/${step.step}`,{method:'PUT',body:JSON.stringify({state:'skipped'})});
    viewedStep=Math.min(reviewSession.current_step,13);questionIndex=0;renderReview();setStatus(`${step.title} skipped. You can return and revise it later.`);
  }catch(error){setStatus(error.message,true);}finally{setReviewBusy(false);}
}

async function reviewAction(action){
  const labels={restart:'restart this review from the beginning',abandon:'abandon this review',archive:'archive this review'};
  if(!confirm(`Are you sure you want to ${labels[action]}? Saved history will not be overwritten.`))return;
  setReviewBusy(true);try{
    reviewSession=await api(`/api/reviews/${encodeURIComponent(reviewSession.id)}/actions`,{method:'POST',body:JSON.stringify({action})});
    if(action==='restart'){rememberReview(reviewSession.id);viewedStep=1;questionIndex=0;renderReview();setStatus('A new review was started. The prior answers remain preserved in the abandoned session.');}
    else{rememberReview(null);reviewSession=null;showReviewStart();document.getElementById('resume-saved').hidden=true;setStatus(`Review ${action==='archive'?'archived':'abandoned'}. You can choose another week when ready.`);}
  }catch(error){setStatus(error.message,true);}finally{setReviewBusy(false);}
}

document.getElementById('capture-form').addEventListener('submit',async event=>{event.preventDefault();const button=event.submitter;button.disabled=true;try{await api('/api/items',{method:'POST',body:JSON.stringify({raw_text:document.getElementById('raw_text').value})});event.currentTarget.reset();await loadTasks();}catch(error){setStatus(error.message,true);}finally{button.disabled=false;}});
document.getElementById('review-start-form').addEventListener('submit',async event=>{event.preventDefault();const button=event.submitter;button.disabled=true;const data=new FormData(event.currentTarget);const input={week_start:data.get('week_start'),week_end:data.get('week_end'),timezone:data.get('timezone')};try{
  const query=new URLSearchParams(input);let session=await api(`/api/reviews/active?${query}`);if(!session)session=await api('/api/reviews',{method:'POST',body:JSON.stringify(input)});reviewSession=session;rememberReview(session.id);viewedStep=Math.min(session.current_step,13);questionIndex=firstUnansweredQuestionIndex(viewedStep);renderReview();setStatus('Sunday Review ready. Your answers will save as you go.');
}catch(error){setStatus(error.message,true);}finally{button.disabled=false;}});
document.getElementById('resume-saved').addEventListener('click',()=>{const id=storedReviewId();if(id)loadReview(id).catch(error=>setStatus(error.message,true));});
document.getElementById('review-answer-form').addEventListener('submit',event=>{event.preventDefault();const raw=document.getElementById('review-answer').value;if(raw.length===0){setStatus('Enter an answer or choose None, Unknown, Not applicable, or Defer.',true);return;}saveReviewResponse('answered',raw);});
document.getElementById('review-answer').addEventListener('paste',()=>{answerWasPasted=true;});
document.querySelectorAll('.answer-choices .choice').forEach(button=>button.addEventListener('click',()=>saveReviewResponse(button.dataset.kind,null)));
document.getElementById('review-skip-section').addEventListener('click',skipReviewSection);
document.getElementById('review-previous').addEventListener('click',()=>{if(viewedStep>1){viewedStep-=1;questionIndex=0;renderReview();}});
document.getElementById('review-next').addEventListener('click',()=>{if(viewedStep<13){viewedStep+=1;questionIndex=0;renderReview();}});
document.getElementById('review-restart').addEventListener('click',()=>reviewAction('restart'));
document.getElementById('review-abandon').addEventListener('click',()=>reviewAction('abandon'));
document.getElementById('review-archive').addEventListener('click',()=>reviewAction('archive'));
document.getElementById('health-week-form').addEventListener('submit',event=>{event.preventDefault();loadHealthWeek();});
document.querySelectorAll('.tab').forEach(tab=>tab.addEventListener('click',()=>switchView(tab.dataset.view)));

fillSelect('filter-category',categories);fillSelect('filter-domain',domains);fillSelect('filter-requester',requesters);
['filter-status','filter-category','filter-domain','filter-requester'].forEach(id=>document.getElementById(id).addEventListener('change',renderTasks));
document.getElementById('refresh').addEventListener('click',()=>currentView==='tasks'?loadTasks():currentView==='health'?loadHealthWeek():(reviewSession?loadReview(reviewSession.id):initializeReview()));
loadTasks();
