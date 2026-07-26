const categories = ['Procurement','Admin & Finance','Communication & Follow-Up','Scheduling & Coordination','Project Work','Problems to Solve','Research / Figure Out','General Task'];
const domains = ['Business','Personal','Home','Health','Family','Learning'];
const requesters = ['Self','Dan','Customer','Team','Vendor','System','Other'];
const flags = ['Urgent','Time-Sensitive','Waiting On','Quick Task','Deep Work'];
const statuses = ['Inbox','Open','Waiting','Done','Archived'];
let items = [];

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

function render(){
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
    await api(`/api/items/${encodeURIComponent(item.id)}`,{method:'PATCH',body:JSON.stringify({title:form.elements.title.value,primary_category:categoryValue||null,domain:form.elements.domain.value||null,requested_by:form.elements.requested_by.value||null,project:form.elements.project.value||null,due_at:form.elements.due_at.value?new Date(form.elements.due_at.value).toISOString():null,status,flags:[...form.querySelectorAll('.flag-check input:checked')].map(input=>input.value)})});await load();
  }catch(error){setStatus(error.message,true);button.disabled=false;}});
}
async function quickUpdate(item,change,button){button.disabled=true;try{await api(`/api/items/${encodeURIComponent(item.id)}`,{method:'PATCH',body:JSON.stringify(change)});await load();}catch(error){setStatus(error.message,true);button.disabled=false;}}
async function removeItem(item){if(!confirm(`Permanently delete “${item.title}”? This also deletes its raw capture and cannot be undone from the dashboard.`))return;try{await api(`/api/items/${encodeURIComponent(item.id)}`,{method:'DELETE'});await load();}catch(error){setStatus(error.message,true);}}
async function load(){setStatus('Refreshing…');try{items=await api('/api/items');render();setStatus(`Up to date · ${items.filter(item=>item.status==='Inbox').length} inbox · ${items.filter(item=>['Open','Waiting'].includes(item.status)).length} active`);}catch(error){setStatus(error.message,true);}}

document.getElementById('capture-form').addEventListener('submit',async event=>{event.preventDefault();const button=event.submitter;button.disabled=true;try{await api('/api/items',{method:'POST',body:JSON.stringify({raw_text:document.getElementById('raw_text').value})});event.currentTarget.reset();await load();}catch(error){setStatus(error.message,true);}finally{button.disabled=false;}});
fillSelect('filter-category',categories);fillSelect('filter-domain',domains);fillSelect('filter-requester',requesters);
['filter-status','filter-category','filter-domain','filter-requester'].forEach(id=>document.getElementById(id).addEventListener('change',render));document.getElementById('refresh').addEventListener('click',load);load();
