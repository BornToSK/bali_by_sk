'use strict';

(() => {
  const storageKey = 'bali-passport-v1';
  const places = new Map();
  const roles = ['favorite', 'visited', 'saved'];
  const systemReduced = matchMedia('(prefers-reduced-motion: reduce)');
  const mount = document.getElementById('myBali');
  const progress = document.getElementById('tripProgress');
  let lastDetectedDay = 0;
  let recordsRequest;

  const canonicalKind = kind => kind === 'visit' ? 'visited' : kind;
  const validId = id => typeof id === 'string' && /^(?:r(?:0[1-9]|[1-6][0-9]|7[0-2])|v(?:0[1-79]|[12][0-9]|30))$/.test(id);
  function read() {
    let raw;
    try { raw = JSON.parse(localStorage.getItem(storageKey) || '{}'); }
    catch { raw = {}; }
    const state = {};
    for (const kind of roles) state[kind] = new Set(Array.isArray(raw?.[kind]) ? raw[kind].filter(validId) : []);
    state.lastDay = Number.isInteger(raw?.lastDay) && raw.lastDay >= 1 && raw.lastDay <= 12 ? raw.lastDay : null;
    return state;
  }
  let state = read();

  function snapshot() {
    return {
      favorite: [...state.favorite], visited: [...state.visited], saved: [...state.saved],
      lastDay: state.lastDay, motion: 'full',
    };
  }
  function save() {
    try { localStorage.setItem(storageKey, JSON.stringify(snapshot())); }
    catch { /* Keep changes for the current page. */ }
  }
  function effectiveMotion() { return systemReduced.matches ? 'reduced' : 'full'; }
  function applyMotion() {
    document.documentElement.dataset.baliMotion = effectiveMotion();
    document.dispatchEvent(new CustomEvent('bali-motion-changed', {detail: effectiveMotion()}));
  }
  function update() {
    for (const button of document.querySelectorAll('[data-passport-kind]')) {
      button.setAttribute('aria-pressed', String(has(button.dataset.passportKind, button.dataset.passportId)));
    }
    renderProgress();
    renderCollections();
    document.dispatchEvent(new CustomEvent('bali-passport-changed', {detail: snapshot()}));
  }
  function has(kind, id) {
    return state[canonicalKind(kind)] instanceof Set && state[canonicalKind(kind)].has(id);
  }
  function toggle(kind, id) {
    kind = canonicalKind(kind);
    if (!roles.includes(kind) || !validId(id) || kind === 'saved' && !id.startsWith('r')) return false;
    const active = !state[kind].has(id);
    if (active) state[kind].add(id);
    else state[kind].delete(id);
    save();
    update();
    if (active && kind === 'visited') {
      const stamp = mount?.querySelector('[data-stamp="' + id + '"]');
      if (stamp && effectiveMotion() !== 'reduced') stamp.classList.add('passport-stamp-new');
    }
    return active;
  }
  window.BaliPassport = Object.freeze({toggle, has, snapshot, motion: effectiveMotion});
  applyMotion();

  function element(tag, className, value) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (value != null) node.textContent = value;
    return node;
  }
  function link(text, href, className) {
    const node = element('a', className, text);
    node.href = href;
    return node;
  }
  function getPlace(id) {
    const trip = window.__guide?.data;
    const record = places.get(id);
    const day = trip?.days.find(value => value.route_stops.some(stop => stop.id === id));
    const stop = day?.route_stops.find(value => value.id === id);
    const covered = (id.startsWith('r') ? trip?.restaurant_coverage : trip?.coverage)?.find(value => value.id === id);
    return {
      name: record?.name || stop?.name || covered?.name,
      date: day?.date || covered?.planned_date || covered?.date || record?.assigned_date,
      area: record?.area?.value?.replace(/EAST BALI|NORTH BALI|SOUTH|NORTH/g, region => ({'EAST BALI':'Восток Бали', 'NORTH BALI':'Север Бали', SOUTH:'Юг Бали', NORTH:'Север Бали'})[region]),
    };
  }
  function stopLink(id) {
    const place = getPlace(id);
    const day = Number(place.date?.slice(-2)) - 10;
    return Number.isInteger(day) && day >= 1 && day <= 12 ? 'index.html#day-' + day + '-stop-' + id : 'restaurants.html';
  }
  function placeLink(id, className) {
    const node = link(getPlace(id).name, stopLink(id), className);
    node.addEventListener('click', event => {
      if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
      const guide = window.__guide;
      const day = guide?.data?.days.find(value => value.route_stops.some(stop => stop.id === id));
      if (!day || typeof window.focusStop !== 'function') return;
      event.preventDefault();
      guide.selectDay(day.number);
      window.focusStop(id, true);
      history.replaceState(null, '', '#day-' + day.number + '-stop-' + id);
    });
    return node;
  }
  function loadRecords() {
    if (recordsRequest) return recordsRequest;
    if (!roles.some(kind => state[kind].size)) return Promise.resolve();
    recordsRequest = fetch('registry.json').then(async response => {
      if (!response.ok) throw new Error('Registry unavailable');
      const registry = await response.json();
      for (const place of registry.places) places.set(place.id, place);
      renderCollections();
    }).catch(() => { recordsRequest = undefined; });
    return recordsRequest;
  }
  function toolButton(kind, id) {
    const label = {favorite:'В избранное', visited:'Посещено', saved:'Сохранить ресторан'}[kind];
    const glyph = {favorite:'♡', visited:'✓', saved:'＋'}[kind];
    const btn = element('button', 'passport-tool');
    btn.type = 'button';
    btn.dataset.passportKind = kind;
    btn.dataset.passportId = id;
    btn.setAttribute('aria-pressed', String(has(kind, id)));
    const icon = element('span', 'passport-tool-icon', glyph);
    icon.setAttribute('aria-hidden', 'true');
    btn.append(icon, element('span', '', label));
    btn.addEventListener('click', () => toggle(kind, id));
    return btn;
  }
  function toolsFor(id) {
    const row = element('div', 'passport-tools');
    row.append(toolButton('favorite', id), toolButton('visited', id));
    if (id.startsWith('r')) row.append(toolButton('saved', id));
    return row;
  }
  function enhanceTimeline() {
    for (const row of document.querySelectorAll('#timeline [id^="stop-"]')) {
      const id = row.id.slice(5);
      if (!validId(id) || row.querySelector('.passport-tools')) continue;
      (row.querySelector('.stop-info') || row.lastElementChild)?.append(toolsFor(id));
    }
  }
  function enhanceCatalog() {
    for (const card of document.querySelectorAll('#cards .card')) {
      const id = card.querySelector('.route-stop-link')?.hash.match(/-stop-([vr]\d+)$/)?.[1];
      if (!validId(id) || card.querySelector('.passport-tools')) continue;
      card.append(toolsFor(id));
    }
  }
  function observeList(id, enhance) {
    const list = document.getElementById(id);
    if (!list) return;
    new MutationObserver(enhance).observe(list, {childList: true});
    enhance();
  }
  observeList('timeline', enhanceTimeline);
  observeList('cards', enhanceCatalog);

  function renderCollection(kind, empty) {
    if (!state[kind].size) return element('p', 'trip-saved-empty', empty);
    const list = element('ul', 'trip-saved-list');
    for (const id of [...state[kind]].reverse()) {
      const place = getPlace(id);
      if (!place.name) continue;
      const row = element('li');
      const item = placeLink(id);
      const date = place.date && Number(place.date.slice(-2)) + ' октября';
      const detail = [place.area, date].filter(Boolean).join(' · ');
      if (detail) item.append(element('small', '', detail));
      row.append(item);
      list.append(row);
    }
    if (!list.childElementCount) return element('p', 'trip-saved-empty', 'Загружаем сохранённые точки…');
    return list;
  }

  function renderCollections() {
    if (!mount) return;
    const empty = {
      favorite: 'Добавьте места из атласа или расписания сердечком.',
      saved: 'Нажмите «Сохранить ресторан» в каталоге или расписании.',
    };
    for (const kind of ['favorite', 'saved']) {
      mount.querySelector('[data-collection-count="' + kind + '"]').textContent = state[kind].size;
      mount.querySelector('[data-collection-items="' + kind + '"]').replaceChildren(renderCollection(kind, empty[kind]));
    }
    if (state.favorite.size || state.saved.size) loadRecords();
  }

  function openDay(event) {
    const day = Number(event.currentTarget.dataset.progressDay);
    if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey || !day || !window.__guide?.selectDay) return;
    event.preventDefault();
    window.__guide.selectDay(day, true);
  }

  function renderProgress() {
    if (!progress) return;
    const trip = window.__guide?.data;
    const resume = progress.querySelector('.trip-resume');
    resume.hidden = !state.lastDay;
    if (state.lastDay) {
      resume.href = '#day-' + state.lastDay;
      resume.dataset.progressDay = state.lastDay;
      resume.textContent = 'Продолжить с дня ' + state.lastDay + ' ↗';
    }
    const dates = progress.querySelector('.trip-progress-days');
    const caption = progress.querySelector('.trip-progress-count');
    if (!trip) {
      caption.textContent = state.visited.size + ' из 101';
      return;
    }
    const records = [...trip.coverage, ...trip.restaurant_coverage];
    const visited = records.filter(place => state.visited.has(place.id)).length;
    caption.textContent = visited + ' из ' + records.length;
    if (!dates.childElementCount) {
      for (const day of trip.days) {
        const anchor = link(String(Number(day.date.slice(-2))), '#day-' + day.number, 'trip-date');
        anchor.dataset.progressDay = day.number;
        anchor.append(element('span', 'trip-date-track'));
        anchor.addEventListener('click', openDay);
        dates.append(anchor);
      }
    }
    for (const [index, day] of trip.days.entries()) {
      const points = records.filter(place => (place.planned_date || place.date) === day.date);
      const marked = points.filter(place => state.visited.has(place.id)).length;
      const anchor = dates.children[index];
      const label = Number(day.date.slice(-2)) + ' октября · ' + day.title + ' · отмечено ' + marked + ' из ' + points.length;
      anchor.style.setProperty('--day-fill', (points.length ? marked / points.length : 0) * 100 + '%');
      anchor.setAttribute('aria-label', label);
      anchor.title = label;
      anchor.classList.toggle('is-complete', marked > 0 && marked === points.length);
    }
  }

  progress?.querySelector('.trip-resume').addEventListener('click', openDay);
  renderProgress();
  renderCollections();

  function recordDay() {
    const day = window.__guide?.currentDay;
    if (!Number.isInteger(day) || day < 1 || day > 12) return;
    const initial = !lastDetectedDay && !/^#day-\d+/.test(location.hash);
    lastDetectedDay = day;
    if ((!initial || !state.lastDay) && state.lastDay !== day) {
      state.lastDay = day;
      save();
    }
    renderProgress();
    renderCollections();
  }
  document.addEventListener('bali-day-changed', recordDay);
  if (window.__guide) recordDay();

  addEventListener('storage', event => {
    if (event.key !== storageKey) return;
    state = read();
    applyMotion();
    update();
  });
  systemReduced.addEventListener?.('change', applyMotion);
})();
