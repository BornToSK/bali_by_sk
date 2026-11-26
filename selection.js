'use strict';
const requestedDay=Number(new URLSearchParams(location.search).get('day'));
const dayContext=requestedDay>=1&&requestedDay<=12?requestedDay:null;
const KEY='bali-personal-guide-selection-v1'+(dayContext?'-day-'+dayContext:'');
let registry,role='meal',chosen=new Set();
const el=id=>document.getElementById(id);
let storageWorks=true;
try{chosen=new Set(JSON.parse(localStorage.getItem(KEY)||'[]'));}catch{storageWorks=false;}
function save(){try{localStorage.setItem(KEY,JSON.stringify([...chosen]));}catch{storageWorks=false;}}
function payload(){return {schema_version:1,day_context:dayContext,list_snapshot_date:'2026-10-06',user_updates:registry.user_updates||[],lists_unchanged_confirmed:el('unchanged').checked,selected_restaurants:registry.places.filter(p=>chosen.has(p.id)).map(p=>({id:p.id,name:p.name,place_url:p.place_url})),note:'Личный выбор; совместимость с расписанием ещё не проверена'};}
function selectionText(){const p=payload();return `${dayContext?"Замены ресторанов для дня "+dayContext+" ("+(10+dayContext)+" октября).\n":""}Списки после 6 октября: ${p.lists_unchanged_confirmed?'не менялись, подтверждаю':'актуальность пока не подтверждена'}.\nВыбрано ресторанов: ${p.selected_restaurants.length}.\n${p.selected_restaurants.map((r,i)=>`${i+1}. ${r.name}`).join('\n')}`;}
function updateSummary(){el('selectedCount').textContent=`Выбрано ${chosen.size} / 72`;el('selectionHint').textContent=!storageWorks?'Сохраните JSON: локальное хранение недоступно':chosen.size>72?'В списке всего 72 заведения':chosen.size?'Все 72 уже назначены; здесь ваш список для уточнений':'Добавьте рестораны для вашего маршрута';el('selectionText').value=selectionText();}
function sortedValues(records, getter) {
  return [...new Set(records.map(getter).filter(Boolean))].sort((a,b) => a.localeCompare(b,'ru'));
}

function catalogueArt(p) {
  if (role === 'meal') {
    if (/кофейн|пекарн|завтрак|бранч|кафе/i.test(p.type)) return 'dining-coffee.webp';
    if (/бар|кальян/i.test(p.type)) return 'dining-sunset.webp';
    return 'dining-table.webp';
  }
  const area = p.area?.value || '';
  if (/пенида|penida/i.test(area)) return 'penida-card.webp';
  if (/пляж|лодочная/i.test(p.type)) return 'coast-card.webp';
  return 'rice-card.webp';
}

function cataloguePicture(p) {
  const figure=document.createElement('figure');
  figure.className='dining-card-art';
  const img=document.createElement('img');
  img.src='assets/'+catalogueArt(p);
  img.alt='';
  img.width=490;
  img.height=286;
  img.loading='lazy';
  img.decoding='async';
  const credit=document.createElement('figcaption');
  credit.textContent='Иллюстрация ИИ';
  figure.append(img,credit);
  return figure;
}



function renderPlace(p) {
  const card=document.createElement('article');
  card.className='card'+(chosen.has(p.id)?' chosen':'');
  const label=document.createElement(role==='meal'?'label':'h2');
  label.className='label';
  if (role==='meal') {
    const checkbox=document.createElement('input');
    checkbox.type='checkbox';
    checkbox.checked=chosen.has(p.id);
    checkbox.setAttribute('aria-label','Выбрать '+p.name);
    checkbox.addEventListener('change',()=>{
      if(checkbox.checked) chosen.add(p.id);
      else chosen.delete(p.id);
      save();
      updateSummary();
      if(el('onlySelected').checked) draw();
      else card.classList.toggle('chosen',checkbox.checked);
    });
    label.append(checkbox);
  }
  const name=document.createElement('span');
  name.textContent=p.name;
  label.append(name);
  const meta=document.createElement('div');
  meta.className='area';
  meta.textContent=[p.area.value,p.type,p.assigned_date && p.assigned_date.slice(-2)+' окт.'].filter(Boolean).join(' · ');
  const address=document.createElement('p');
  address.textContent=!p.address.value || p.address.value==='TBD' ? 'Адрес требует проверки' : p.address.value;
  card.append(cataloguePicture(p),label,meta,address);
  const hours=document.createElement('p');
  hours.className='catalog-status';
  const published=['official_current','official'].includes(p.hours?.status);
  hours.textContent=published && p.hours.value ? 'Опубликованные часы · '+p.hours.value : 'Часы и условия посещения уточнить';
  card.append(hours);
  const place=document.createElement('a');
  place.href=p.place_url;
  place.target='_blank';
  place.rel='noopener';
  place.textContent='Открыть место в Google Maps ↗';
  card.append(place);
  if (p.assigned_date) {
    const stop=document.createElement('a');
    stop.className='route-stop-link';
    stop.href='index.html#day-'+(Number(p.assigned_date.slice(-2))-10)+'-stop-'+p.id;
    stop.textContent='Открыть остановку в расписании →';
    card.append(stop);
  }
  return card;
}

function draw() {
  const query=el('search').value.trim().toLocaleLowerCase('ru');
  const area=el('area').value, day=el('filterDay').value, type=el('filterType').value;
  const group=registry.places.filter(p=>p.roles.includes(role));
  const places=group.filter(p=>
    (!area || p.area.value===area) &&
    (!day || p.assigned_date===day) &&
    (!type || p.type===type) &&
    (!el('onlySelected').checked || chosen.has(p.id)) &&
    (p.name+' '+(p.address.value||'')).toLocaleLowerCase('ru').includes(query));
  el('resultCount').textContent='Показано '+places.length+' из '+group.length+' · районы предварительные';
  const container=el('cards');
  container.replaceChildren(...places.map(renderPlace));
  if (!places.length) {
    const empty=document.createElement('div');
    empty.className='empty';
    const title=document.createElement('p');
    title.textContent='Ничего не найдено. Попробуйте другой запрос или сбросьте фильтры.';
    const reset=document.createElement('button');
    reset.type='button';
    reset.textContent='Сбросить фильтры';
    reset.onclick=()=>{
      for(const id of ['search','area','filterDay','filterType']) el(id).value='';
      el('onlySelected').checked=false;
      draw();
      el('search').focus();
    };
    empty.append(title,reset);
    container.append(empty);
  }
}
function setRole(value) {
  role=value;
  el('onlySelected').checked=false;
  el('onlySelected').disabled=role==='visit';
  const group=registry.places.filter(p=>p.roles.includes(role));
  el('area').replaceChildren(new Option('Все районы',''),...sortedValues(group,p=>p.area.value).map(v=>new Option(v,v)));
  el('filterType').replaceChildren(new Option('Все категории',''),...sortedValues(group,p=>p.type).map(v=>new Option(v,v)));
  for(const button of document.querySelectorAll('.tab')){
    const active=button.dataset.role===role;
    button.classList.toggle('active',active);
    button.setAttribute('aria-pressed',String(active));
  }
  draw();
}
async function start() {
  try {
    const response=await fetch('registry.json');
    if(!response.ok) throw new Error('HTTP '+response.status);
    registry=await response.json();
    if(registry.places.length!==101) throw new Error('Неполный реестр');
    for(const date of sortedValues(registry.places,p=>p.assigned_date)) {
      el('filterDay').append(new Option(Number(date.slice(-2))+' октября',date));
      if(dayContext===Number(date.slice(-2))-10) el('filterDay').value=date;
    }
    const valid=new Set(registry.places.filter(p=>p.roles.includes('meal')).map(p=>p.id));
    chosen=new Set([...chosen].filter(id=>valid.has(id)));
    setRole(role);
    updateSummary();
    document.querySelectorAll('.tab').forEach(button=>button.addEventListener('click',()=>setRole(button.dataset.role)));
    el('search').addEventListener('input',draw);
    for(const id of ['area','filterDay','filterType','onlySelected']) el(id).addEventListener('change',draw);
    el('unchanged').addEventListener('change',updateSummary);
    el('copy').addEventListener('click',async()=>{
      try {
        await navigator.clipboard.writeText(selectionText());
        el('message').textContent='Выбор скопирован. Вставьте его в чат.';
      } catch {
        document.querySelector('.handoff details').open=true;
        el('selectionText').focus();
        el('selectionText').select();
        el('message').textContent='Копирование недоступно. Выделенный текст можно скопировать вручную.';
      }
    });
    el('download').addEventListener('click',()=>{
      const url=URL.createObjectURL(new Blob([JSON.stringify(payload(),null,2)],{type:'application/json;charset=utf-8'}));
      const link=document.createElement('a');
      link.href=url;
      link.download='bali-restaurants-selection.json';
      link.click();
      setTimeout(()=>URL.revokeObjectURL(url),1000);
    });
  } catch(error) {
    el('error').hidden=false;
    el('error').textContent='Реестр не загрузился. Подробности: '+error.message;
    el('resultCount').textContent='Не удалось загрузить список';
    el('copy').disabled=true;
    el('download').disabled=true;
  }
}
start();
