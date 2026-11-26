'use strict';

(() => {
  const cards = document.getElementById('cards');
  const count = document.getElementById('resultCount');
  if (!cards || !count) return;

  const controls = document.createElement('div');
  controls.className = 'catalog-view-toggle';
  controls.setAttribute('role', 'group');
  controls.setAttribute('aria-label', 'Вид результатов');
  controls.innerHTML = `
    <button type="button" aria-controls="cards" aria-pressed="true">Список</button>
    <button type="button" aria-controls="catalogMapPanel" aria-pressed="false">Карта</button>`;
  count.before(controls);
  const [listButton, mapButton] = controls.querySelectorAll('button');

  const panel = document.createElement('section');
  panel.id = 'catalogMapPanel';
  panel.className = 'catalog-map-panel';
  panel.hidden = true;
  panel.setAttribute('aria-labelledby', 'catalogMapTitle');
  panel.innerHTML = `
    <div class="catalog-map-heading">
      <div><span>КАТАЛОГ МАСТШТАБОМ ОСТРОВА</span><h2 id="catalogMapTitle">Места на карте</h2></div>
      <button type="button" class="catalog-map-fit">Показать все точки</button>
    </div>
    <div class="catalog-map-layout">
      <div class="catalog-map-viewport">
        <div class="catalog-live-map" role="group" aria-label="Интерактивная географическая карта отфильтрованных мест" hidden></div>
        <div class="catalog-map-scheme">
          <img alt="" width="800" height="490" decoding="async">
          <div class="catalog-scheme-pins"></div>
        </div>
      </div>
      <div class="catalog-map-info">
        <label>Выбрать место
          <select aria-label="Выбрать место на карте"></select>
        </label>
        <div class="catalog-map-place"></div>
      </div>
    </div>
    <p class="catalog-map-status" role="status"></p>
    <p class="catalog-map-attribution">Дорожная подложка: <a href="https://openfreemap.org/" target="_blank" rel="noopener">OpenFreeMap</a> /
      <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap contributors</a>.
      Схема: <a href="https://www.naturalearthdata.com/" target="_blank" rel="noopener">Natural Earth</a>.</p>`;
  cards.before(panel);

  const viewport = panel.querySelector('.catalog-live-map');
  const scheme = panel.querySelector('.catalog-map-scheme');
  const pins = panel.querySelector('.catalog-scheme-pins');
  const placeBox = panel.querySelector('.catalog-map-place');
  const pick = panel.querySelector('select');
  const status = panel.querySelector('.catalog-map-status');
  const fitButton = panel.querySelector('.catalog-map-fit');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let sourcePromise, libraryPromise, records;
  let visible = [], selected = '', currentSignature;
  let map, ready = false, mapView = false, attempted = false, queued = false;
  let tileError = false;

  function addText(tag, text, className) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    element.textContent = text;
    return element;
  }
  function routeUrl(place) {
    return place.assigned_date
      ? 'index.html#day-' + (Number(place.assigned_date.slice(-2)) - 10) + '-stop-' + place.id
      : 'index.html#overviewHeading';
  }
  function link(label, href, external = false) {
    const element = addText('a', label);
    element.href = href;
    if (external) { element.target = '_blank'; element.rel = 'noopener'; }
    return element;
  }
  function loadRecords() {
    if (!sourcePromise) {
      sourcePromise = fetch('registry.json').then(async response => {
        if (!response.ok) throw new Error('Реестр недоступен');
        const data = await response.json();
        records = new Map(data.places.map(place => [place.id, place]));
      });
    }
    return sourcePromise;
  }
  function resource(tag, path) {
    return new Promise((resolve, reject) => {
      const element = document.createElement(tag);
      if (tag === 'link') { element.rel = 'stylesheet'; element.href = path; }
      else { element.src = path; }
      element.addEventListener('load', resolve, {once:true});
      element.addEventListener('error', reject, {once:true});
      document.head.append(element);
    });
  }
  function loadMap() {
    if (window.loadMapLibrary) return window.loadMapLibrary();
    if (window.maplibregl) return Promise.resolve();
    libraryPromise ||= Promise.all([
      resource('link', 'vendor/maplibre-gl.css'),
      resource('script', 'vendor/maplibre-gl.js'),
    ]);
    return libraryPromise;
  }
  function coordinates(place) {
    return [place.coordinates.lon, place.coordinates.lat];
  }
  function mapData(places = visible) {
    return {
      type:'FeatureCollection',
      features:places.map(place => ({
        type:'Feature', geometry:{type:'Point',coordinates:coordinates(place)},
        properties:{id:place.id, meal:place.roles.includes('meal')},
      })),
    };
  }
  function ease(center, zoom) {
    map.easeTo({center, zoom, duration: reduced.matches || window.BaliPassport?.motion() === 'reduced' ? 0 : 420});
  }
  function fit() {
    if (!ready) return;
    if (!visible.length) {
      map.jumpTo({center:[115.13,-8.46],zoom:8.1});
      return;
    }
    if (visible.length === 1) {
      ease(coordinates(visible[0]), 13);
      return;
    }
    const bounds = new maplibregl.LngLatBounds();
    for (const place of visible) bounds.extend(coordinates(place));
    map.fitBounds(bounds, {padding:40,maxZoom:13,duration:0});
  }
  function detail() {
    placeBox.replaceChildren();
    if (!selected) {
      placeBox.append(addText('p', visible.length
        ? 'Нажмите точку на карте или выберите название из списка.'
        : 'С такими фильтрами мест нет. Сбросить фильтры можно в списке.'));
      return;
    }
    const place = records.get(selected);
    placeBox.append(
      addText('span', [place.area?.value, place.type].filter(Boolean).join(' · '), 'catalog-map-place-meta'),
      addText('h3', place.name),
    );
    if (place.assigned_date) placeBox.append(addText('p', Number(place.assigned_date.slice(-2)) + ' октября · по путеводителю'));
    const hours = ['official_current','official'].includes(place.hours?.status) && place.hours?.value;
    placeBox.append(
      addText('p', hours ? 'Опубликованные часы · ' + hours : 'Часы и условия посещения уточнить'),
      link('Открыть остановку →', routeUrl(place)),
      link('Google Maps ↗', place.place_url, true),
    );
    const passport = window.BaliPassport;
    if (passport) {
      const tools = addText('div', '', 'passport-tools');
      const actions = [['favorite','♡ В избранное']];
      if (place.roles.includes('meal')) actions.push(['saved','＋ Сохранить ресторан']);
      for (const [kind, label] of actions) {
        const btn = addText('button', label, 'passport-tool');
        btn.type = 'button';
        btn.dataset.passportKind = kind;
        btn.dataset.passportId = place.id;
        btn.setAttribute('aria-pressed', String(passport.has(kind, place.id)));
        btn.addEventListener('click', () => passport.toggle(kind, place.id));
        tools.append(btn);
      }
      placeBox.append(tools);
    }
  }
  function setSelected(id, move = false) {
    selected = visible.some(place => place.id === id) ? id : '';
    pick.value = selected;
    detail();
    for (const pin of pins.children) pin.classList.toggle('is-chosen', pin.dataset.place === selected);
    if (ready) {
      const place = selected && records.get(selected);
      map.getSource('catalog-selected').setData(mapData(place ? [place] : []));
      if (place && move) ease(coordinates(place), Math.max(13, map.getZoom()));
    }
  }
  function renderScheme() {
    pins.replaceChildren(...visible.map(place => {
      const [lon, lat] = coordinates(place);
      const x = 52 + (lon - 114.40) * 510;
      const y = 44 + (-8.04 - lat) * 473;
      const pin = addText('button', '', 'catalog-scheme-pin');
      pin.type = 'button';
      pin.tabIndex = -1;
      pin.style.left = (x / 8) + '%';
      pin.style.top = (y / 4.9) + '%';
      pin.dataset.place = place.id;
      pin.setAttribute('aria-label', place.name);
      pin.addEventListener('click', () => setSelected(place.id));
      return pin;
    }));
  }
  function setStatus() {
    const mapped = visible.length + ' точек на карте.';
    status.textContent = ready ? mapped
      : (tileError ? 'Географическая подложка недоступна. Показана схема. ' : 'Загружается географическая подложка. ') + mapped;
    fitButton.disabled = !ready || !visible.length;
  }
  function update() {
    if (!records || !mapView) return;
    const ids = [...cards.querySelectorAll('.route-stop-link[href*="-stop-"]')]
      .map(anchor => anchor.hash.match(/-stop-([rv]\d+)$/)?.[1]);
    const signature = ids.join(',');
    if (signature === currentSignature) return;
    currentSignature = signature;
    visible = ids.map(id => records.get(id)).filter(place =>
      Number.isFinite(place?.coordinates?.lon) && Number.isFinite(place?.coordinates?.lat));
    pick.replaceChildren(new Option('Выберите точку', ''), ...visible.map(place => new Option(place.name, place.id)));
    pick.disabled = !visible.length;
    if (!ready) renderScheme();
    else map.getSource('catalog-places').setData(mapData());
    setSelected(selected);
    setStatus();
    fit();
  }

  function addLayers() {
    map.addSource('catalog-places', {type:'geojson', data:mapData(), cluster:true, clusterRadius:29, clusterMaxZoom:12});
    map.addLayer({
      id:'catalog-clusters', type:'circle', source:'catalog-places', filter:['has','point_count'],
      paint:{'circle-color':'#203a2d','circle-stroke-color':'#f5f2e9','circle-stroke-width':2,'circle-radius':17},
    });
    map.addLayer({
      id:'catalog-cluster-count', type:'symbol',source:'catalog-places',filter:['has','point_count'],
      layout:{'text-field':['get','point_count_abbreviated'],'text-font':['Noto Sans Regular'],'text-size':12},
      paint:{'text-color':'#f5f2e9'},
    });
    map.addLayer({
      id:'catalog-pins', type:'circle', source:'catalog-places',filter:['!', ['has','point_count']],
      paint:{'circle-color':['case',['get','meal'],'#884d33','#203a2d'],'circle-stroke-color':'#f5f2e9','circle-stroke-width':2,'circle-radius':7},
    });
    map.addSource('catalog-selected', {type:'geojson', data:mapData([])});
    map.addLayer({
      id:'catalog-picked', type:'circle', source:'catalog-selected',
      paint:{'circle-color':'#884d33','circle-stroke-color':'#fff2ca','circle-stroke-width':3,'circle-radius':9},
    });
    map.on('click','catalog-clusters', event => {
      const feature = event.features?.[0];
      if (feature) ease(feature.geometry.coordinates, Math.min(15, map.getZoom() + 2));
    });
    map.on('click','catalog-pins', event => {
      const id = event.features?.[0]?.properties.id;
      if (id) setSelected(id, true);
    });
    for (const layer of ['catalog-clusters','catalog-pins']) {
      map.on('mouseenter',layer,()=>{map.getCanvas().style.cursor='pointer';});
      map.on('mouseleave',layer,()=>{map.getCanvas().style.cursor='';});
    }
  }
  async function activateMap() {
    if (attempted) return;
    attempted = true;
    try {
      await loadMap();
      viewport.hidden = false;
      map = new maplibregl.Map({
        container:viewport,style:'https://tiles.openfreemap.org/styles/liberty',
        center:[115.13,-8.46],zoom:8.1,minZoom:5,maxZoom:18,
        cooperativeGestures:true,dragRotate:false,renderWorldCopies:false,
        pixelRatio:Math.min(2,devicePixelRatio),
        locale:{'NavigationControl.ZoomIn':'Приблизить','NavigationControl.ZoomOut':'Отдалить'},
      });
      map.addControl(new maplibregl.NavigationControl({showCompass:false}), 'top-right');
      map.once('load', () => {
        clearTimeout(delay);
        addLayers();
        ready = true;
        scheme.hidden = true;
        setSelected(selected);
        setStatus();
        if (mapView) { map.resize(); fit(); }
      });
      const delay = setTimeout(() => {
        if (!ready) {
          tileError = true;
          setStatus();
        }
      }, 9000);
    } catch {
      viewport.hidden = true;
      tileError = true;
      setStatus();
    }
  }
  async function setView(useMap) {
    mapView = useMap;
    cards.hidden = useMap;
    panel.hidden = !useMap;
    mapButton.setAttribute('aria-pressed', String(useMap));
    listButton.setAttribute('aria-pressed', String(!useMap));
    if (!useMap) return;
    const schemeImage = scheme.querySelector('img');
    if (!schemeImage.hasAttribute('src')) schemeImage.src = 'assets/beyond-atlas-land.svg';
    try {
      await loadRecords();
    } catch {
      status.textContent = 'Не удалось открыть реестр. Вернитесь к списку результатов.';
      return;
    }
    if (!mapView) return;
    update();
    activateMap();
    if (ready) requestAnimationFrame(() => {map.resize(); fit();});
  }

  new MutationObserver(() => {
    if (!mapView || queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; update(); });
  }).observe(cards,{childList:true});
  listButton.addEventListener('click', () => setView(false));
  mapButton.addEventListener('click', () => setView(true));
  pick.addEventListener('change', () => setSelected(pick.value, true));
  fitButton.addEventListener('click', fit);
})();
