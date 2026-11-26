'use strict';

(() => {
  const root = document.getElementById('exploreBali');
  if (!root) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char =>
    ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[char]));
  const portrait = {
    coast: ['assets/coast-card.webp', 'assets/coast.webp', 'Побережье · иллюстрация ИИ'],
    rice: ['assets/rice-card.webp', 'assets/rice.webp', 'Террасы и холмы · иллюстрация ИИ'],
    penida: ['assets/penida-card.webp', 'assets/penida.webp', 'Пенида · иллюстрация ИИ'],
  };
  const ids = (...values) => item => values.includes(item.id);
  const categories = [
    {id:'highlights', label:'Главное', art:'rice', note:'Начните с островов, террас или Ловины.', filter:p => p.roles.includes('visit')},
    {id:'beaches', label:'Пляжи', art:'coast', note:'Бухты восточного побережья и песок Букита.', filter:p => /пляж/i.test(p.type) || p.id==='v29'},
    {id:'water', label:'Водопады', art:'rice', note:'Водопады в глубине острова.', filter:p => /waterfall|водопад/i.test(p.name)},
    {id:'temples', label:'Храмы', art:'rice', note:'Храмы от Бесакиха до озёр Бедугула.', filter:p => /храм/i.test(p.type)},
    {id:'terraces', label:'Террасы', art:'rice', note:'Рисовые поля Джатилувиха.', filter:ids('v19')},
    {id:'heights', label:'Возвышенности', art:'rice', note:'Маршрут к Бесакиху и виды Джаран-Хилл.', filter:ids('v10','v24')},
    {id:'islands', label:'Пенида', art:'penida', note:'Один день на соседнем острове.', filter:ids('v04','v05','v06','v07','r01')},
    {id:'taste', label:'Гастрономия', art:'rice', note:'Все точки питания из сохранённого списка.', filter:p => p.roles.includes('meal')},
    {id:'sunset', label:'Закаты', art:'coast', note:'Точки маршрута с морским горизонтом.', filter:ids('v24','r15','r01')},
    {id:'lookouts', label:'Смотровые', art:'penida', note:'Обрывы, бухты и площадки над океаном.', filter:ids('v05','v06','v07','v24','v28','r15')},
  ];

  root.classList.add('bx-atlas');
  root.setAttribute('aria-labelledby','bxAtlasTitle');
  root.innerHTML = `
    <header class="bx-atlas-intro">
      <div><span class="bx-atlas-kicker">БАЛИ ОТ SK / АТЛАС ОСТРОВА</span>
        <h2 id="bxAtlasTitle">География<br><em>путешествия.</em></h2></div>
      <p>Выберите тему или день, найдите точку на острове и откройте её в расписании.</p>
    </header>
    <div class="bx-atlas-tabs" role="group" aria-label="Категории мест"></div>
    <div class="bx-atlas-exhibit">
      <div class="bx-atlas-model">
        <div class="bx-atlas-model-head">
          <label>День поездки <select class="bx-atlas-day" disabled><option value="">Вся поездка</option></select></label>
          <div class="bx-atlas-model-links"><button type="button" data-atlas-day-open hidden>Расписание дня ↗</button><a href="#trip-map">Дорожная карта ↗</a></div>
        </div>
        <div class="bx-atlas-viewport" role="group" aria-label="Декоративный атлас Бали">
          <div class="bx-atlas-plane">
            <img src="assets/beyond-atlas-land.svg" alt="" width="800" height="490" loading="lazy" decoding="async">
            <svg class="bx-atlas-roads" viewBox="0 0 800 490" aria-hidden="true"></svg>
            <div class="bx-atlas-pins"></div>
          </div>
        </div>
        <div class="bx-atlas-model-foot">
          <p>Рельеф условный. Контур Natural Earth, дороги OSRM.</p>
          <div class="bx-atlas-controls" role="group" aria-label="Поворот и масштаб острова">
            <button type="button" data-camera="left" aria-label="Повернуть остров влево" title="Повернуть влево">↶</button>
            <button type="button" data-camera="right" aria-label="Повернуть остров вправо" title="Повернуть вправо">↷</button>
            <button type="button" data-camera="out" aria-label="Отдалить остров">−</button>
            <button type="button" data-camera="in" aria-label="Приблизить остров">+</button>
            <button type="button" data-camera="reset" aria-label="Сбросить поворот и масштаб">⌖</button>
          </div>
        </div>
      </div>
      <div class="bx-atlas-feature">
        <img src="assets/rice-card.webp" alt="" width="650" height="433" loading="lazy" decoding="async">
        <div><span class="bx-atlas-art-label">Террасы и холмы · иллюстрация ИИ</span>
        <h3>Главное</h3><p></p><strong class="bx-atlas-count" role="status">Загружаем места…</strong></div>
      </div>
    </div>
    <div class="bx-atlas-results" role="group" aria-label="Места по выбранной теме"></div>
    <button type="button" class="bx-atlas-more" hidden></button>
    <dialog class="bx-atlas-dialog" aria-labelledby="bxAtlasDialogTitle"></dialog>`;

  const tabs = root.querySelector('.bx-atlas-tabs');
  const days = root.querySelector('.bx-atlas-day');
  const viewport = root.querySelector('.bx-atlas-viewport');
  const plane = root.querySelector('.bx-atlas-plane');
  const roads = root.querySelector('.bx-atlas-roads');
  const pins = root.querySelector('.bx-atlas-pins');
  const feature = root.querySelector('.bx-atlas-feature');
  const results = root.querySelector('.bx-atlas-results');
  const count = root.querySelector('.bx-atlas-count');
  const dayOpen = root.querySelector('[data-atlas-day-open]');
  const more = root.querySelector('.bx-atlas-more');
  const dialog = root.querySelector('.bx-atlas-dialog');
  const pageSize = 6;
  let category = categories[0], places, trip, displayed = pageSize, dayByPlace = new Map();
  let bearing = 0, tilt = 24, scale = 1, offsetX = 0, offsetY = 0, pointer;
  let activeRecord, lastOpener, paintedDays;

  function findCurrentDays() {
    const activeDays = trip?.days || [];
    if (activeDays === paintedDays) return;
    paintedDays = activeDays;
    dayByPlace = new Map(activeDays.flatMap(day => (day.route_stops || day.stops).map(place => [place.id, day])));
    renderRoads();
    render();
  }
  function xy(lon, lat) {
    return [52 + (lon - 114.40) * 510, 44 + (-8.04 - lat) * 473];
  }
  function dateFor(p) {
    return dayByPlace.get(p.id)?.date || p.assigned_date;
  }
  function dayNumber(p) {
    return dayByPlace.get(p.id)?.number || (dateFor(p) ? Number(dateFor(p).slice(-2)) - 10 : 0);
  }
  function scheduleUrl(p) {
    return dayNumber(p) ? `index.html#day-${dayNumber(p)}-stop-${encodeURIComponent(p.id)}` : '#days';
  }
  function renderRoads() {
    const active = Number(days.value);
    const daysToDraw = active ? trip.days.filter(day => day.number === active) : trip.days;
    roads.classList.toggle('is-day', Boolean(active));
    roads.replaceChildren(...daysToDraw.flatMap(day => day.legs.filter(leg => leg.geometry).map(leg => {
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      const coordinates = leg.geometry.coordinates;
      const stride = Math.max(1, Math.ceil(coordinates.length / (active ? 150 : 45)));
      const line = coordinates.filter((point, index) => index % stride === 0 || index === coordinates.length - 1)
        .map(point => xy(...point).map(value => value.toFixed(1)).join(',')).join(' ');
      path.setAttribute('d', 'M' + line);
      path.setAttribute('pathLength', '1');
      path.setAttribute('vector-effect', 'non-scaling-stroke');
      if (leg.returning) path.classList.add('is-return');
      return path;
    })));
  }
  function applyCamera() {
    plane.style.setProperty('--bx-turn', bearing + 'deg');
    plane.style.setProperty('--bx-tilt', tilt + 'deg');
    plane.style.setProperty('--bx-zoom', scale);
    plane.style.setProperty('--bx-x', offsetX + '%');
    plane.style.setProperty('--bx-y', offsetY + '%');
  }
  function targetPlace(place) {
    if (!Number.isFinite(place.coordinates?.lon) || !Number.isFinite(place.coordinates?.lat)) return;
    const [x, y] = xy(place.coordinates.lon, place.coordinates.lat);
    bearing = 0; tilt = 18; scale = 1.55;
    offsetX = Math.max(-36, Math.min(36, (400 - x) / 11));
    offsetY = Math.max(-30, Math.min(30, (245 - y) / 7));
    applyCamera();
  }
  function labelPlace(place) {
    const date = dateFor(place);
    return [place.id==='r15' ? 'Смотровая · еда не подтверждена' : place.type, date && `${Number(date.slice(-2))} октября`].filter(Boolean).join(' · ');
  }
  function titleImage(place) {
    return portrait[place.roles.includes('meal') ? category.art :
      (categories.find(item => item.id==='islands').filter(place) ? 'penida' :
        (/пляж/i.test(place.type) || ['v24','v28','v30'].includes(place.id) ? 'coast' : 'rice'))] || portrait[category.art];
  }
  function isFavorite(id) {
    return window.BaliPassport?.has?.('favorite',id) ?? false;
  }
  function refreshDialogFavorite() {
    const button = dialog.querySelector('[data-atlas-favorite]');
    if (!button || !activeRecord) return;
    button.hidden = typeof window.BaliPassport?.toggle !== 'function';
    const saved = isFavorite(activeRecord.id);
    button.setAttribute('aria-pressed', String(saved));
    button.textContent = saved ? '★ В избранном' : '☆ В избранное';
  }
  function openDetail(place, opener) {
    if (!place) return;
    activeRecord = place;
    lastOpener = opener;
    targetPlace(place);
    for (const pin of pins.querySelectorAll('button')) {
      pin.classList.toggle('active', pin.dataset.atlasPlace === place.id);
    }
    const [, src, alt] = titleImage(place);
    const routeDay = dayByPlace.get(place.id);
    const row = routeDay?.timeline.find(item => (item.place_id===place.id || item.restaurant_id===place.id) && item.meal_mode!=='packed');
    const conditions = [
      ['Адрес', place.address?.value],
      ['Время по плану', row && `${row.start}–${row.end}`],
      ['Опубликованные часы', ['official_current','official'].includes(place.hours?.status) && place.hours?.value],
      ['Бронирование', place.booking_requirement],
      ['Ограничения', place.access_restrictions],
      ['Что уточнить', place.unverified?.join(' · ')],
    ].filter(([, value]) => value && value!=='TBD' && typeof value==='string');
    dialog.innerHTML = `<div class="bx-atlas-dialog-top"><button type="button" data-atlas-close aria-label="Закрыть" autofocus>×</button></div>
      <figure class="bx-atlas-photo"><button type="button" data-atlas-photo aria-label="Увеличить иллюстрацию">
        <img src="${src}" alt="${escape(alt)}"></button><figcaption>${escape(alt)}</figcaption></figure>
      <div class="bx-atlas-detail"><span>${escape(labelPlace(place))}</span><h3 id="bxAtlasDialogTitle">${escape(place.name)}</h3>
        <p>${escape(place.area?.value)}</p>
        <dl>${conditions.map(([key,value])=>`<div><dt>${key}</dt><dd>${escape(value)}</dd></div>`).join('')}</dl>
        <div class="bx-atlas-detail-actions">
          <a href="${scheduleUrl(place)}" data-atlas-schedule>В расписание ↗</a>
          ${place.place_url ? `<a href="${escape(place.place_url)}" target="_blank" rel="noopener">Открыть на карте ↗</a>` : ''}
          <button type="button" data-atlas-favorite hidden></button>
        </div>
      </div>`;
    refreshDialogFavorite();
    if (!dialog.open) dialog.showModal();
    dialog.querySelector('[data-atlas-close]').focus();
  }
  dialog.addEventListener('click', event => {
    const target = event.target;
    if (target===dialog || target.closest('[data-atlas-close]')) dialog.close();
    if (target.closest('[data-atlas-photo]')) {
      const zoomed = dialog.classList.toggle('bx-atlas-photo-mode');
      target.closest('[data-atlas-photo]').setAttribute('aria-label', zoomed ? 'Вернуться к сведениям' : 'Увеличить иллюстрацию');
    }
    if (target.closest('[data-atlas-favorite]') && activeRecord) {
      window.BaliPassport?.toggle?.('favorite',activeRecord.id);
      refreshDialogFavorite();
    }
    if (target.closest('[data-atlas-schedule]') && activeRecord && window.__guide) {
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      const {id} = activeRecord;
      const day = dayNumber(activeRecord);
      dialog.close();
      if (!day) { document.getElementById('days')?.scrollIntoView(); return; }
      window.__guide.selectDay(day,true);
      history.replaceState(null,'',`#day-${day}-stop-${id}`);
      requestAnimationFrame(() => {
        if (typeof focusStop === 'function') focusStop(id,true);
      });
    }
  });
  dialog.addEventListener('close', () => {
    dialog.classList.remove('bx-atlas-photo-mode');
    if (lastOpener?.isConnected) lastOpener.focus({preventScroll:true});
  });
  document.addEventListener('bali-passport-changed', refreshDialogFavorite);

  function updateFeature() {
    root.dataset.atlasTheme = category.id;
    const [thumbnail,,alt] = portrait[category.art];
    const image = feature.querySelector('img');
    if (!image.src.endsWith(thumbnail)) image.src = thumbnail;
    feature.querySelector('.bx-atlas-art-label').textContent = alt;
    feature.querySelector('h3').textContent = category.label;
    feature.querySelector('p').textContent = category.note;
    if (!reduced.matches && window.BaliPassport?.motion?.() !== 'reduced') {
      image.getAnimations?.().forEach(animation => animation.cancel());
      image.animate?.([{clipPath:'inset(0 7% 0 0)', transform:'scale(1.045)'}, {clipPath:'inset(0)', transform:'scale(1)'}],
        {duration:420,easing:'cubic-bezier(.2,.7,.3,1)'});
    }
  }
  function render() {
    if (!places) return;
    const activeDay = Number(days.value);
    const chosen = places.filter(place => category.filter(place) && (!activeDay || dayNumber(place)===activeDay));
    count.textContent = `${chosen.length} из ${places.length} мест`;
    if (chosen.length) {
      results.innerHTML = chosen.slice(0,displayed).map((place,index) => {
        const [src,,art] = titleImage(place);
        return `<button type="button" class="bx-atlas-place" data-atlas-place="${escape(place.id)}">
          <div class="bx-atlas-thumb"><img src="${src}" alt="" width="650" height="433" loading="lazy" decoding="async"><small>${escape(art)}</small></div>
          <div class="bx-atlas-place-rank"><span>${String(index+1).padStart(2,'0')}</span><span>${escape(labelPlace(place))}</span></div>
          <strong>${escape(place.name)}</strong><div class="bx-atlas-place-meta">${escape(place.area?.value)} <span aria-hidden="true">↗</span></div>
        </button>`;
      }).join('');
    } else {
      results.innerHTML = '<p class="bx-atlas-empty">На этот день в выбранной категории мест нет. Переключите день или тему.</p>';
    }
    pins.replaceChildren(...chosen.flatMap(place => {
      if (!Number.isFinite(place.coordinates?.lon) || !Number.isFinite(place.coordinates?.lat)) return [];
      const [x,y] = xy(place.coordinates.lon, place.coordinates.lat);
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'bx-atlas-pin';
      button.dataset.atlasPlace = place.id;
      button.style.left = `${x / 8}%`;
      button.style.top = `${y / 4.9}%`;
      button.title = place.name;
      button.setAttribute('aria-label', place.name);
      button.tabIndex = -1;
      if (place.id===activeRecord?.id) button.classList.add('active');
      return [button];
    }));
    more.hidden = displayed>=chosen.length;
    more.textContent = `Показать ещё ${Math.min(pageSize,chosen.length-displayed)} ↓`;
    for (const button of tabs.children) button.setAttribute('aria-pressed', String(button.dataset.category===category.id));
  }
  function switchCategory(id) {
    category = categories.find(item => item.id===id) || category;
    displayed = pageSize;
    activeRecord = null;
    updateFeature();
    render();
  }
  tabs.innerHTML = categories.map(item => `<button type="button" data-category="${item.id}" aria-pressed="${item===category}" disabled>${item.label}</button>`).join('');
  tabs.addEventListener('click', event => {
    const tab = event.target.closest('button[data-category]');
    if (tab) switchCategory(tab.dataset.category);
  });
  days.addEventListener('change', () => {
    displayed = pageSize;
    const selectedDay = trip.days.find(day => day.number===Number(days.value));
    dayOpen.hidden = !selectedDay;
    if (selectedDay) {
      const first = selectedDay.stops?.[0] || selectedDay.route_stops?.[0];
      if (first) targetPlace({coordinates:first});
    } else {
      bearing = offsetX = offsetY = 0; scale = 1; tilt = 24; applyCamera();
    }
    renderRoads();
    render();
  });
  more.addEventListener('click', () => {
    const previous = displayed;
    displayed += pageSize;
    render();
    results.querySelectorAll('button')[previous]?.focus({preventScroll:true});
  });
  dayOpen.addEventListener('click', () => {
    const selectedDay = Number(days.value);
    if (selectedDay) window.__guide?.selectDay(selectedDay,true);
  });
  root.addEventListener('click', event => {
    const choice = event.target.closest('[data-atlas-place]');
    if (choice) openDetail(places?.find(place => place.id===choice.dataset.atlasPlace),choice);
    const control = event.target.closest('[data-camera]');
    if (!control) return;
    if (control.dataset.camera === 'left') bearing -= 18;
    if (control.dataset.camera === 'right') bearing += 18;
    if (control.dataset.camera === 'in') scale = Math.min(2.4, scale + .22);
    if (control.dataset.camera === 'out') scale = Math.max(.72, scale - .22);
    if (control.dataset.camera === 'reset') { bearing=offsetX=offsetY=0; tilt=24; scale=1; }
    applyCamera();
  });
  viewport.addEventListener('pointerdown', event => {
    if (event.pointerType !== 'mouse' || event.button!==0 || event.target.closest('button')) return;
    pointer = {id:event.pointerId,x:event.clientX,y:event.clientY,bearing,tilt};
    viewport.classList.add('is-dragging');
    viewport.setPointerCapture(event.pointerId);
  });
  viewport.addEventListener('pointermove', event => {
    if (pointer?.id!==event.pointerId) return;
    bearing = pointer.bearing + (event.clientX-pointer.x)*.29;
    tilt = Math.max(0,Math.min(48,pointer.tilt - (event.clientY-pointer.y)*.17));
    applyCamera();
  });
  viewport.addEventListener('lostpointercapture', () => {
    pointer = null;
    viewport.classList.remove('is-dragging');
  });
  applyCamera();
  updateFeature();

  async function start() {
    try {
      const registryResponse = await fetch('registry.json');
      if (!registryResponse.ok) throw Error('registry');
      const registry = await registryResponse.json();
      if (!window.__guide?.data) {
        await new Promise((resolve,reject) => {
          let ticks = 0;
          const timer = setInterval(() => {
            if (window.__guide?.data || ++ticks>100) {
              clearInterval(timer);
              if (window.__guide?.data) resolve();
              else reject(Error('itinerary'));
            }
          },100);
        });
      }
      trip = window.__guide.data;
      places = registry.places;
      for (const day of trip.days) days.add(new Option(day.date.slice(-2)+' октября · '+day.title,day.number));
      days.disabled = false;
      for (const tab of tabs.children) tab.disabled = false;
      findCurrentDays();
      document.addEventListener('bali-day-changed',findCurrentDays);
    } catch {
      count.textContent = 'Не удалось загрузить точки. Дорожная карта и расписание доступны ниже.';
    }
  }
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(records => {
      if (!records.some(item => item.isIntersecting)) return;
      observer.disconnect();
      start();
    },{rootMargin:'320px'});
    observer.observe(root);
  } else start();
})();
