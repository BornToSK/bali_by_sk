'use strict';

(() => {
  const storageKey = 'bali-passport-v1';
  const places = new Map();
  const roles = ['favorite', 'visited', 'saved'];
  const moods = ['full', 'balanced', 'reduced'];
  const systemReduced = matchMedia('(prefers-reduced-motion: reduce)');
  const mount = document.getElementById('myBali');
  let storageAvailable = true;
  let lastDetectedDay = 0;
  let recordsRequest;
  let sound;
  let summary;
  let motionSelect, ambientButton;

  const canonicalKind = kind => kind === 'visit' ? 'visited' : kind;
  const validId = id => typeof id === 'string' && /^(?:r(?:0[1-9]|[1-6][0-9]|7[0-2])|v(?:0[1-79]|[12][0-9]|30))$/.test(id);
  function read() {
    let raw;
    try { raw = JSON.parse(localStorage.getItem(storageKey) || '{}'); }
    catch { raw = {}; }
    const state = {};
    for (const kind of roles) state[kind] = new Set(Array.isArray(raw?.[kind]) ? raw[kind].filter(validId) : []);
    state.lastDay = Number.isInteger(raw?.lastDay) && raw.lastDay >= 1 && raw.lastDay <= 12 ? raw.lastDay : null;
    state.motion = moods.includes(raw?.motion) ? raw.motion : 'balanced';
    return state;
  }
  let state = read();

  function snapshot() {
    return {
      favorite: [...state.favorite], visited: [...state.visited], saved: [...state.saved],
      lastDay: state.lastDay, motion: state.motion,
    };
  }
  function save() {
    try { localStorage.setItem(storageKey, JSON.stringify(snapshot())); }
    catch { storageAvailable = false; }
  }
  function effectiveMotion() { return systemReduced.matches ? 'reduced' : state.motion; }
  function applyMotion() {
    document.documentElement.dataset.baliMotion = effectiveMotion();
    document.dispatchEvent(new CustomEvent('bali-motion-changed', {detail: effectiveMotion()}));
  }
  function update() {
    for (const button of document.querySelectorAll('[data-passport-kind]')) {
      button.setAttribute('aria-pressed', String(has(button.dataset.passportKind, button.dataset.passportId)));
    }
    renderPassport();
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
    return {
      name: record?.name || stop?.name || id,
      date: day?.date || record?.assigned_date,
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
      const day = guide?.data.days.find(value => value.route_stops.some(stop => stop.id === id));
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
      renderPassport();
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
    if (!state[kind].size) return element('p', 'passport-empty', empty);
    const list = element('ul', 'passport-collection');
    for (const id of [...state[kind]].reverse()) {
      const row = element('li');
      row.append(placeLink(id));
      list.append(row);
    }
    return list;
  }
  function renderPassport() {
    if (!summary) return;
    const count = state.visited.size;
    const total = (window.__guide?.data.coverage.length || 29) + (window.__guide?.data.restaurant_coverage.length || 72);
    const percentage = Math.round(count / total * 100);
    summary.visited.textContent = count + ' / ' + total;
    summary.favorite.textContent = state.favorite.size;
    summary.saved.textContent = state.saved.size;
    summary.progress.value = count;
    summary.progress.max = total;
    summary.percentage.textContent = percentage + '%';
    summary.last.href = state.lastDay ? 'index.html#day-' + state.lastDay : '#overviewHeading';
    summary.last.textContent = state.lastDay ? 'Вернуться к дню ' + state.lastDay + ' ↗' : 'Выбрать первый день ↗';
    summary.favorites.replaceChildren(renderCollection('favorite', 'Добавьте первое место в избранное.'));
    summary.restaurants.replaceChildren(renderCollection('saved', 'Сохраните ресторан из каталога или расписания.'));
    summary.storage.textContent = storageAvailable
      ? 'Отметки и настройки хранятся в этом браузере.'
      : 'Хранилище недоступно. Отметки сохранятся до закрытия страницы.';
    summary.stamps.replaceChildren();
    const recent = [...state.visited].reverse().slice(0, 9);
    for (const id of recent) {
      const stamp = placeLink(id, 'passport-stamp');
      stamp.dataset.stamp = id;
      summary.stamps.append(stamp);
    }
    if (!recent.length) summary.stamps.append(element('p', 'passport-empty', 'Отметьте посещение в расписании, чтобы получить первый штамп.'));
    summary.archive.hidden = count <= recent.length;
    if (count > recent.length) summary.archiveList.replaceChildren(renderCollection('visited', ''));
    if (motionSelect && document.activeElement !== motionSelect) motionSelect.value = state.motion;
    if (recordsRequest == null && !window.__guide?.data && summary.visible) loadRecords();
  }

  function initializePassport() {
    if (!mount) return;
    mount.classList.add('passport-section');
    mount.setAttribute('aria-labelledby', 'passportTitle');
    mount.innerHTML = `
      <div class="passport-cover">
        <div class="passport-emblem" aria-hidden="true">SK</div>
        <p class="passport-kicker">ЛИЧНЫЙ АРХИВ</p>
        <h2 id="passportTitle">Мой Бали</h2>
        <p>Паспорт путешествия</p>
        <a class="passport-resume" data-passport="last"></a>
      </div>
      <div class="passport-pages">
        <div class="passport-score">
          <div><strong data-passport="visited"></strong><span>посещено</span></div>
          <div><strong data-passport="favorite"></strong><span>в избранном</span></div>
          <div><strong data-passport="saved"></strong><span>ресторанов сохранено</span></div>
        </div>
        <div class="passport-progress">
          <progress data-passport="progress" aria-label="Посещённые места"></progress><strong data-passport="percentage"></strong>
        </div>
        <h3>Штампы поездки</h3>
        <div data-passport="stamps" class="passport-stamps"></div>
        <details data-passport="archive" hidden><summary>Все отметки о посещении</summary><div data-passport="archiveList"></div></details>
        <details id="passportFavorites"><summary>Избранные места</summary><div data-passport="favorites"></div></details>
        <details><summary>Сохранённые рестораны</summary><div data-passport="restaurants"></div></details>
        <div class="passport-settings">
          <label>Эффекты <select data-passport-motion>
            <option value="full">Полный режим</option><option value="balanced">Сбалансированный</option><option value="reduced">Минимум движения</option>
          </select></label>
          <button type="button" class="passport-tool passport-ambient" aria-pressed="false">Звук океана</button>
        </div>
        <p data-passport="storage" class="passport-storage"></p>
      </div>`;
    summary = Object.fromEntries([...mount.querySelectorAll('[data-passport]')].map(node => [node.dataset.passport, node]));
    motionSelect = mount.querySelector('[data-passport-motion]');
    ambientButton = mount.querySelector('.passport-ambient');
    motionSelect.addEventListener('change', () => {
      if (!moods.includes(motionSelect.value)) return;
      state.motion = motionSelect.value;
      save();
      applyMotion();
      update();
    });
    ambientButton.addEventListener('click', toggleOcean);
    summary.last.addEventListener('click', event => {
      if (!state.lastDay || !window.__guide?.selectDay) return;
      event.preventDefault();
      window.__guide.selectDay(state.lastDay, true);
    });
    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver(entries => {
        if (!entries.some(entry => entry.isIntersecting)) return;
        summary.visible = true;
        loadRecords();
        observer.disconnect();
      }, {rootMargin:'150px'});
      observer.observe(mount);
    } else summary.visible = true;
    renderPassport();
  }
  initializePassport();

  function recordDay() {
    const day = window.__guide?.currentDay;
    if (!Number.isInteger(day) || day < 1 || day > 12) return;
    const explicit = /^#day-\d+/.test(location.hash);
    if (!lastDetectedDay && !explicit && state.lastDay) {
      lastDetectedDay = day;
      return;
    }
    lastDetectedDay = day;
    if (state.lastDay === day) return;
    state.lastDay = day;
    save();
    renderPassport();
  }
  document.addEventListener('bali-day-changed', recordDay);
  if (window.__guide) recordDay();
  function openFavorites() {
    if (location.hash === '#passportFavorites') {
      const details = document.getElementById('passportFavorites');
      if (details) {
        details.open = true;
        requestAnimationFrame(() => details.scrollIntoView({block:'start'}));
      }
    }
  }
  openFavorites();
  addEventListener('hashchange', openFavorites);
  addEventListener('storage', event => {
    if (event.key !== storageKey) return;
    state = read();
    applyMotion();
    update();
  });
  systemReduced.addEventListener?.('change', applyMotion);

  async function toggleOcean() {
    if (sound) {
      const previous = sound;
      sound = null;
      ambientButton.setAttribute('aria-pressed', 'false');
      await previous.close().catch(() => {});
      return;
    }
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) {
      ambientButton.textContent = 'Звук недоступен';
      ambientButton.disabled = true;
      return;
    }
    let context;
    try {
      context = new Context();
      sound = context;
      const length = Math.floor(context.sampleRate * 8);
      const buffer = context.createBuffer(1, length, context.sampleRate);
      const samples = buffer.getChannelData(0);
      let colored = 0;
      for (let i = 0; i < length; i++) {
        colored = colored * .975 + (Math.random() * 2 - 1) * .025;
        const swell = Math.sin(Math.PI * i / length) ** 2;
        samples[i] = colored * swell;
      }
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      const filter = context.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 600;
      const gain = context.createGain();
      gain.gain.value = .42;
      source.connect(filter).connect(gain).connect(context.destination);
      source.start();
      await context.resume();
      if (sound === context) ambientButton.setAttribute('aria-pressed', 'true');
    } catch {
      if (sound === context) sound = null;
      context?.close().catch(() => {});
      ambientButton.textContent = 'Звук недоступен';
      ambientButton.setAttribute('aria-pressed', 'false');
    }
  }
  addEventListener('pagehide', () => {
    const previous = sound;
    sound = null;
    ambientButton?.setAttribute('aria-pressed', 'false');
    previous?.close().catch(() => {});
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && sound) {
      const previous = sound;
      sound = null;
      ambientButton?.setAttribute('aria-pressed', 'false');
      previous.close().catch(() => {});
    }
  });
})();
