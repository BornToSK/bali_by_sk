'use strict';

function initBeyondFilm() {
  const guide = window.__guide;
  const film = document.getElementById('journeyFilm');
  const player = document.getElementById('routePlayer');
  if (!guide?.data || !film || !player || film.dataset.ready) return;
  film.dataset.ready = 'true';
  const instant = () => matchMedia('(prefers-reduced-motion: reduce)').matches ||
    document.documentElement.dataset.baliMotion === 'reduced';
  const tiny = day => `assets/${day.image}-card.webp`;
  const dates = new Intl.DateTimeFormat('ru', {day:'numeric',month:'long',timeZone:'Asia/Makassar'});
  const date = day => dates.format(new Date(day.date+'T12:00:00+08:00'));
  const pad = n => String(n).padStart(2,'0');
  const crops = ['56% 38%','25% 63%','76% 55%','22% 69%','66% 31%','82% 52%','55% 40%','15% 61%','32% 70%','77% 32%','38% 82%','26% 74%'];
  const journalArt = new Set([2,6,9,12]);
  const picture = day => {
    if(journalArt.has(day.number)) return `<picture>
      <source type="image/avif" media="(max-width:620px)" srcset="assets/bukit-journal-mobile.avif">
      <source type="image/avif" srcset="assets/bukit-journal.avif">
      <img src="assets/bukit-journal.webp" alt="" loading="lazy" decoding="async" draggable="false"></picture>`;
    return `<img src="${tiny(day)}" srcset="${tiny(day)} 650w, assets/${day.image}.webp 1560w"
      sizes="(max-width:620px) 75vw, (max-width:1100px) 68vw, 780px" alt="" loading="lazy" decoding="async" draggable="false">`;
  };
  const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g,c=>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
  const dayAt = () => guide.data.days[guide.currentDay-1];

  film.innerHTML = `
    <div class="film-toolbar">
      <p><strong id="filmIndex">01</strong> <span>/ ${pad(guide.data.days.length)}</span></p>
      <p id="filmPreview" class="film-preview"></p>
      <div class="film-arrows" role="group" aria-label="Управление галереей дней">
        <button type="button" aria-label="Предыдущий день галереи" data-rail-step="-1">←</button>
        <button type="button" aria-label="Следующий день галереи" data-rail-step="1">→</button>
      </div>
    </div>
    <div class="film-rail" tabindex="0" role="region" aria-label="Галерея 12 дней. Используйте стрелки или прокрутку.">
      ${guide.data.days.map(day=>`<button type="button" class="film-card" data-film-day="${day.number}" style="--film-crop:${crops[day.number-1]}">
        ${picture(day)}
        <span class="film-card-head"><span>ГЛАВА ${pad(day.number)}</span><time datetime="${escapeHTML(day.date)}">${date(day)}</time></span>
        <span class="film-num" aria-hidden="true">${pad(day.number)}</span>
        <span class="film-card-foot">
          <strong>${escapeHTML(day.title)}</strong>
          <span class="film-key-stops">${escapeHTML(day.stops.slice(0,3).map(p=>p.name).join(' · ')||day.subtitle)}</span>
          <span class="film-card-metadata">${escapeHTML(day.depart)}–${escapeHTML(day.return_time)} · ${escapeHTML(day.distance_km_known)} км по дорогам</span>
          <span class="film-cta">Расписание и карта <span aria-hidden="true">↗</span></span>
        </span>
      </button>`).join('')}
    </div>
    <p class="film-credit">Пейзажи глав · AI-иллюстрации</p>`;
  const rail = film.querySelector('.film-rail');
  const cards = [...rail.querySelectorAll('.film-card')];
  const indexLabel = film.querySelector('#filmIndex');
  const preview = film.querySelector('#filmPreview');
  const arrows = [...film.querySelectorAll('[data-rail-step]')];
  let current = 0, railFrame = 0, gesture = null, suppressClickUntil = 0;
  const targetFor = card => card.offsetLeft - rail.offsetLeft - (rail.clientWidth-card.offsetWidth)/2;
  function paintRail(index) {
    current = index;
    indexLabel.textContent = pad(index+1);
    const next = guide.data.days[index+1];
    preview.textContent = next ? `Далее · ${next.title}` : 'Последний день путешествия';
    arrows[0].disabled = index===0;
    arrows[1].disabled = index===cards.length-1;
    cards.forEach((card,i)=>card.classList.toggle('is-current',i===index));
  }
  // Each viewport can show a portion of the next chapter, while the selected
  // card's focused state stays independent from the currently open schedule.
  function nearest() {
    return cards.reduce((found,card,index)=>
      Math.abs(targetFor(card)-rail.scrollLeft)<Math.abs(targetFor(cards[found])-rail.scrollLeft)?index:found,0);
  }
  function moveRail(index, mode = instant()?'instant':'smooth') {
    const bounded = Math.max(0,Math.min(cards.length-1,index));
    paintRail(bounded);
    rail.scrollTo({left:targetFor(cards[bounded]),behavior:mode});
  }
  rail.addEventListener('scroll',()=>{
    if (railFrame) return;
    railFrame=requestAnimationFrame(()=>{railFrame=0;paintRail(nearest());});
  },{passive:true});
  arrows.forEach(button=>button.addEventListener('click',()=>moveRail(current+Number(button.dataset.railStep))));
  rail.addEventListener('keydown',event=>{
    const index = {ArrowLeft:current-1,ArrowRight:current+1,Home:0,End:cards.length-1}[event.key];
    if (index===undefined) return;
    event.preventDefault();
    moveRail(index);
    if (event.target!==rail) cards[current].focus({preventScroll:true});
  });
  rail.addEventListener('click',event=>{
    const card=event.target.closest('.film-card');
    if (!card) return;
    if (event.detail>0 && performance.now()<suppressClickUntil) {event.preventDefault();return;}
    guide.selectDay(Number(card.dataset.filmDay),true);
    const header=document.querySelector('#dayHeader h2');
    if(header){
      header.tabIndex=-1;
      header.focus({preventScroll:true});
      if(!instant()) header.animate([{opacity:.4,transform:'translateY(14px)'},{opacity:1,transform:'none'}],
        {duration:420,easing:'cubic-bezier(.22,.7,.22,1)'});
    }
  });
  rail.addEventListener('pointerdown',event=>{
    suppressClickUntil=0;
    if(event.pointerType!=='mouse' || event.button!==0) return;
    gesture={id:event.pointerId,start:event.clientX,x:event.clientX,left:rail.scrollLeft,time:performance.now(),speed:0,dragged:false};
  });
  rail.addEventListener('pointermove',event=>{
    if(!gesture || gesture.id!==event.pointerId) return;
    const now=performance.now(), offset=event.clientX-gesture.start;
    if(!gesture.dragged && Math.abs(offset)<7) return;
    if(!gesture.dragged){
      gesture.dragged=true;
      rail.classList.add('is-dragging');
      rail.setPointerCapture(event.pointerId);
    }
    gesture.speed=(gesture.x-event.clientX)/Math.max(1,now-gesture.time);
    gesture.time=now;
    gesture.x=event.clientX;
    rail.scrollLeft=gesture.left-offset;
  });
  function release(event){
    if(!gesture || gesture.id!==event.pointerId) return;
    if(gesture.dragged){
      suppressClickUntil=performance.now()+300;
      const inertia=instant() || performance.now()-gesture.time>80?0:Math.max(-1,Math.min(1,Math.round(gesture.speed*.7)));
      const next=nearest()+inertia;
      rail.classList.remove('is-dragging');
      moveRail(next);
    }
    gesture=null;
  }
  rail.addEventListener('pointerup',release);
  rail.addEventListener('pointercancel',release);
  rail.addEventListener('pointerleave',()=>{if(!gesture?.dragged) gesture=null;});
  rail.addEventListener('dragstart',event=>event.preventDefault());

  const mapPanel = document.getElementById('map-section');
  const mapWrapper = mapPanel?.querySelector('.map-wrapper');
  if(mapWrapper) mapWrapper.before(player);
  player.innerHTML = `
    <div class="film-player-bar">
      <button type="button" class="film-play-main" id="filmPlay">▶ Воспроизвести маршрут</button>
      <div class="film-player-controls" id="filmControls" hidden>
        <button type="button" id="filmBack" aria-label="Предыдущий этап маршрута">←</button>
        <button type="button" id="filmForward" aria-label="Следующий этап маршрута">→</button>
        <button type="button" id="filmStop">Завершить</button>
      </div>
    </div>
    <div class="film-stage" id="filmStage" hidden>
      <img class="film-stage-image" alt="AI-иллюстрация главы" width="70" height="70">
      <div class="film-stage-copy">
        <div class="film-stage-live" aria-live="polite">
          <span id="filmStageMeta"></span>
          <strong id="filmStageName"></strong>
        </div>
        <p id="filmStageNote"></p>
        <progress id="filmProgress" aria-label="Прогресс воспроизведения маршрута" max="1" value="0"></progress>
      </div>
    </div>`;
  const button = id => document.getElementById(id);
  const play = button('filmPlay'), stop = button('filmStop'), back = button('filmBack'), forward = button('filmForward');
  const controls = button('filmControls'), scene = button('filmStage'), progress = button('filmProgress');
  const slideImage = scene.querySelector('img');
  const roadSource = 'beyond-route-playback', roadLayer = 'beyond-route-playback-line';
  const empty = {type:'FeatureCollection',features:[]};
  let day, steps=[], points=new Map(), stepIndex=0, playing=false, opened=false, complete=false;
  let last=0, elapsed=0, frame=0, routeWasReady=false, traceFrame=0, selectedPin, originPin, selectedRow;
  let routeVertices, measurements, length;
  function routeMap(){
    const map=guide.map;
    return guide.mapLoaded && map?.getSource('route') && guide.currentMapDay===day?.number ? map : null;
  }
  function compile(d) {
    points = new Map([guide.data.hotel,...guide.data.logistics_points,...d.route_stops].map(p=>[p.id,p]));
    const visitRows=new Map(d.timeline.filter(row=>row.kind==='visit' || row.kind==='meal'&&row.meal_mode==='onsite')
      .map(row=>[row.place_id || row.restaurant_id,row]));
    return d.timeline.filter(row=>['road','boat','visit','meal','logistics'].includes(row.kind) && row.meal_mode!=='packed')
      .map(row=>{
        const leg=row.kind==='road'?d.legs[row.leg_index]:null;
        const point=points.get(leg?.destination||row.place_id||row.restaurant_id);
        const transferDestination=row.kind==='boat' ? (row.title.includes('→ Пенида')?'penida-port':'sanur') : null;
        return {row,leg,point:point||points.get(transferDestination),
          nextVisit:leg ? visitRows.get(leg.destination) : null};
      });
  }
  function clearPaint(){
    selectedPin?.classList.remove('film-route-marker');
    originPin?.classList.remove('film-route-origin');
    selectedRow?.classList.remove('film-route-current');
    selectedRow?.removeAttribute('aria-current');
    selectedPin=originPin=selectedRow=null;
    if(guide.mapLoaded) guide.map?.getSource(roadSource)?.setData(empty);
  }
  function showControls(){
    controls.hidden=!opened;
    scene.hidden=!opened;
    back.disabled=stepIndex===0;
    forward.disabled=stepIndex>=steps.length-1;
    play.textContent=playing?'Ⅱ Пауза':complete?'↻ Воспроизвести снова':opened?'▶ Продолжить':'▶ Воспроизвести маршрут';
  }
  function startDay(){
    finish();
    day=dayAt();
    steps=compile(day);
    stepIndex=0;
    play.disabled=!steps.length;
    for(const card of cards){
      if(Number(card.dataset.filmDay)===day.number) card.setAttribute('aria-current','date');
      else card.removeAttribute('aria-current');
    }
    // Keep the user's gallery position during playback and restaurant rerenders.
    moveRail(day.number-1,'instant');
    showControls();
  }
  function measure(vertices){
    routeVertices=vertices||null;
    measurements=[0];length=0;
    for(let i=1;vertices&&i<vertices.length;i++){
      const a=vertices[i-1],b=vertices[i];
      length+=Math.hypot((b[0]-a[0])*Math.cos(a[1]*Math.PI/180),b[1]-a[1]);
      measurements.push(length);
    }
  }
  function drawTrace(fraction,map){
    if(!routeVertices || routeVertices.length<2 || !map) return;
    if(!map.getSource(roadSource)){
      map.addSource(roadSource,{type:'geojson',data:empty});
      map.addLayer({id:roadLayer,type:'line',source:roadSource,layout:{'line-cap':'round','line-join':'round'},
        paint:{'line-color':'#bb6217','line-width':6,'line-opacity':.96}},
        map.getLayer('route-directions')?'route-directions':undefined);
    }
    const limit=length*fraction;
    let i=1;
    while(i<measurements.length-1 && measurements[i]<=limit) i++;
    const a=routeVertices[i-1],b=routeVertices[i];
    const portion=Math.min(1,Math.max(0,(limit-measurements[i-1])/Math.max(.000000001,measurements[i]-measurements[i-1])));
    const coords=routeVertices.slice(0,i).concat([[a[0]+(b[0]-a[0])*portion,a[1]+(b[1]-a[1])*portion]]);
    map.getSource(roadSource).setData({type:'Feature',properties:{},geometry:{type:'LineString',coordinates:coords}});
  }
  function moveCamera(step,map){
    if(!map) return;
    if(step.leg?.geometry?.coordinates?.length>1){
      const coordinates=step.leg.geometry.coordinates;
      const bounds=new maplibregl.LngLatBounds(coordinates[0],coordinates[0]);
      coordinates.forEach(pt=>bounds.extend(pt));
      map.fitBounds(bounds,{padding:map.getContainer().clientWidth<500?38:64,maxZoom:15,duration:instant()?0:700});
    }else if(step.point){
      map.easeTo({center:[step.point.lon,step.point.lat],zoom:Math.max(12,Math.min(14,map.getZoom())),duration:instant()?0:580});
    }
  }
  function highlightEndpoints({leg,point}){
    const pins=[...mapPanel.querySelectorAll('.map-pin')];
    selectedPin=pins.find(pin=>pin.dataset.placeId===point?.id);
    selectedPin?.classList.add('film-route-marker');
    originPin=pins.find(pin=>pin.dataset.placeId===leg?.origin && pin!==selectedPin);
    originPin?.classList.add('film-route-origin');
  }
  const categories={road:'Дорога',boat:'Катер',visit:'Достопримечательность',meal:'Ресторан',logistics:'Логистика'};
  function showStep(index){
    clearPaint();
    stepIndex=index;
    elapsed=0;
    last=0;
    traceFrame=0;
    const step=steps[index], {row,leg,point,nextVisit}=step;
    const rowId=row.place_id||row.restaurant_id;
    selectedRow = leg ? document.querySelector(`#timeline [data-leg="${leg.index}"]`) :
      rowId ? document.getElementById('stop-'+rowId) : null;
    selectedRow?.classList.add('film-route-current');
    selectedRow?.setAttribute('aria-current','step');
    const map = routeMap();
    highlightEndpoints(step);
    const time = row.start && (row.end && row.start!==row.end?`${row.start}–${row.end}`:row.start);
    const stopNo = row.number ? ` · остановка ${row.number}` : '';
    button('filmStageMeta').textContent = [`${pad(index+1)} / ${pad(steps.length)}`, categories[row.kind]+stopNo, time].filter(Boolean).join(' · ');
    button('filmStageName').textContent=row.title;
    button('filmStageNote').textContent=row.kind==='boat'?'Морской этап указан в расписании. Дорожная линия продолжится после прибытия.':
      row.kind==='road' && nextVisit ? `Далее · ${nextVisit.start} · ${point.name}`:
        row.note ? row.note : '';
    slideImage.src=tiny(day);
    measure(leg?.geometry?.coordinates);
    routeWasReady=Boolean(map);
    moveCamera(step,map);
    drawTrace(instant()?1:.01,map);
    progress.value=index/steps.length;
    showControls();
  }
  function tick(now){
    if(!playing) return;
    const step=steps[stepIndex];
    if(last) elapsed+=Math.min(120,now-last);
    last=now;
    const duration=step.leg?2600:step.row.kind==='boat'?3400:4100;
    const map=routeMap();
    if(map&&!routeWasReady){
      routeWasReady=true;
      highlightEndpoints(step);
      moveCamera(step,map);
    }
    if(now-traceFrame>=48){
      drawTrace(instant()?1:Math.min(1,elapsed/(duration*.83)),map);
      progress.value=(stepIndex+Math.min(1,elapsed/duration))/steps.length;
      traceFrame=now;
    }
    if(elapsed>=duration){
      if(stepIndex<steps.length-1) showStep(stepIndex+1);
      else {complete=true;playing=false;progress.value=1;showControls();return;}
    }
    frame=requestAnimationFrame(tick);
  }
  function resume(){
    if(!guide.mapLoaded && typeof initMap==='function') initMap();
    if(!opened || complete){
      complete=false;
      opened=true;
      showStep(0);
    }
    last=0;
    playing=true;
    cancelAnimationFrame(frame);
    showControls();
    frame=requestAnimationFrame(tick);
  }
  function pause(){
    playing=false;
    last=0;
    cancelAnimationFrame(frame);
    showControls();
  }
  function finish(reset=false){
    clearPaint();
    opened=playing=complete=false;
    cancelAnimationFrame(frame);
    if(reset && routeMap()) guide.fitDay(day);
    showControls();
  }
  play.addEventListener('click',()=>playing?pause():resume());
  back.addEventListener('click',()=>{complete=false;showStep(Math.max(0,stepIndex-1));});
  forward.addEventListener('click',()=>{complete=false;showStep(Math.min(steps.length-1,stepIndex+1));});
  stop.addEventListener('click',()=>{finish(true);play.focus();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&playing) pause();});
  document.getElementById('timeline').addEventListener('click',event=>{
    if(opened && event.target.closest('[data-leg],[data-stop]')) finish();
  });
  if('IntersectionObserver' in window){
    new IntersectionObserver(entries=>{if(playing && !entries[0].isIntersecting) pause();}).observe(player);
  }
  document.addEventListener('bali-day-changed',startDay);
  startDay();
}
