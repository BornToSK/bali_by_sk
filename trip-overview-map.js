'use strict';

function initTripOverview(itinerary, openDay) {
  const panel = document.getElementById('overviewPanel');
  const viewport = document.getElementById('overviewViewport');
  const mapElement = document.getElementById('overviewMap');
  const image = document.getElementById('overviewFallback');
  const status = document.getElementById('overviewStatus');
  const dayPicker = document.getElementById('overviewDay');
  const dayLink = document.getElementById('overviewDayLink');
  const expand = document.getElementById('overviewExpand');
  const modeButtons = [...panel.querySelectorAll('[data-overview-mode]')];
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let map, ready = false, started = false, mode = 'roads', expanded = false;
  let scale = 1, x = 0, y = 0, drag;

  let features, allBounds, routeDays;
  const boundsByDay = new Map();
  function extend(bounds, [lon, lat]) {
    bounds[0] = Math.min(bounds[0], lon);
    bounds[1] = Math.min(bounds[1], lat);
    bounds[2] = Math.max(bounds[2], lon);
    bounds[3] = Math.max(bounds[3], lat);
  }
  function refreshRoads() {
    if (routeDays === itinerary.days) return;
    routeDays = itinerary.days;
    features = routeDays.flatMap(day => day.legs.filter(leg => leg.geometry).map(leg => ({
      type: 'Feature', geometry: leg.geometry,
      properties: { day: day.number, returning: Boolean(leg.returning) },
    })));
    allBounds = [itinerary.hotel.lon, itinerary.hotel.lat, itinerary.hotel.lon, itinerary.hotel.lat];
    boundsByDay.clear();
    for (const {geometry, properties} of features) {
      const bounds = boundsByDay.get(properties.day) || [Infinity, Infinity, -Infinity, -Infinity];
      for (const point of geometry.coordinates) {
        extend(bounds, point);
        extend(allBounds, point);
      }
      boundsByDay.set(properties.day, bounds);
    }
    if (ready) map.getSource('overview-routes').setData({type:'FeatureCollection',features});
  }
  refreshRoads();
  document.addEventListener('bali-day-changed', refreshRoads);
  for (const day of itinerary.days) {
    const option = document.createElement('option');
    option.value = day.number;
    option.textContent = `${day.date.slice(-2)} окт. · ${day.title}`;
    dayPicker.append(option);
  }

  function tell(message) {
    status.textContent = message;
    status.hidden = !message;
  }
  function drawSaved() {
    const limitX = viewport.clientWidth * (scale - 1) / 2;
    const limitY = viewport.clientHeight * (scale - 1) / 2;
    x = Math.max(-limitX, Math.min(limitX, x));
    y = Math.max(-limitY, Math.min(limitY, y));
    image.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
  }
  function zoomSaved(factor, clientX, clientY) {
    const bounds = viewport.getBoundingClientRect();
    const next = Math.max(1, Math.min(8, factor * scale));
    const anchorX = clientX == null ? 0 : clientX - bounds.left - bounds.width / 2;
    const anchorY = clientY == null ? 0 : clientY - bounds.top - bounds.height / 2;
    x = anchorX + (x - anchorX) * next / scale;
    y = anchorY + (y - anchorY) * next / scale;
    scale = next;
    drawSaved();
  }
  function zoom(step) {
    if (ready) map.zoomTo(map.getZoom() + step, {duration: reducedMotion.matches ? 0 : 180});
    else zoomSaved(1.45 ** step);
  }
  function fit() {
    if (!ready) {
      scale = 1;
      x = y = 0;
      drawSaved();
      return;
    }
    const bounds = boundsByDay.get(Number(dayPicker.value)) || allBounds;
    const padding = viewport.clientWidth < 600 ? 35 : 55;
    map.fitBounds([[bounds[0], bounds[1]], [bounds[2], bounds[3]]], {
      padding, maxZoom: 13, duration: reducedMotion.matches ? 0 : 450,
    });
  }
  function selectDay() {
    const day = Number(dayPicker.value);
    dayLink.hidden = !day;
    if (!ready) return;
    for (const layer of ['overview-route-halo', 'overview-route-out', 'overview-route-back']) {
      const filter = layer.endsWith('out') ? ['==', ['get', 'returning'], false]
        : layer.endsWith('back') ? ['==', ['get', 'returning'], true] : null;
      const dayFilter = day ? ['==', ['get', 'day'], day] : null;
      map.setFilter(layer, filter && dayFilter ? ['all', filter, dayFilter] : filter || dayFilter);
    }
    fit();
  }
  function setMode(next) {
    if (!ready || next === mode) return;
    if (next === 'satellite' && !map.getSource('overview-satellite')) {
      map.addSource('overview-satellite', {
        type: 'raster', tileSize: 256, maxzoom: 14,
        tiles: ['https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2024_3857/default/g/{z}/{y}/{x}.jpg'],
        attribution: '<a href="https://maps.eox.at/" target="_blank" rel="noopener">Sentinel-2 cloudless · EOX IT Services GmbH</a> (Contains modified Copernicus Sentinel data 2024)',
      });
      map.addLayer({id: 'overview-satellite', type: 'raster', source: 'overview-satellite',
        paint: {'raster-fade-duration': reducedMotion.matches ? 0 : 250}}, 'overview-route-halo');
    }
    mode = next;
    panel.dataset.mode = mode;
    if (map.getLayer('overview-satellite')) {
      map.setLayoutProperty('overview-satellite', 'visibility', next === 'satellite' ? 'visible' : 'none');
    }
    const satellite = next === 'satellite';
    map.setPaintProperty('overview-route-halo', 'line-color', satellite ? '#143327' : '#fffaf0');
    map.setPaintProperty('overview-route-out', 'line-color', satellite ? '#e6f5ac' : '#165d50');
    map.setPaintProperty('overview-route-back', 'line-color', satellite ? '#ffbf7f' : '#ae522d');
    for (const button of modeButtons) button.setAttribute('aria-pressed', String(button.dataset.overviewMode === next));
    tell('');
  }
  function toggleExpanded(next) {
    expanded = next;
    panel.classList.toggle('overview-expanded', expanded);
    document.body.classList.toggle('overview-open', expanded);
    expand.setAttribute('aria-expanded', String(expanded));
    expand.setAttribute('aria-label', expanded ? 'Закрыть полноэкранную карту' : 'Развернуть общую карту');
    expand.textContent = expanded ? '×' : '⤢';
    requestAnimationFrame(() => { map?.resize(); drawSaved(); });
    expand.focus({preventScroll: true});
  }

  dayPicker.addEventListener('change', selectDay);
  dayLink.addEventListener('click', () => {
    if (expanded) toggleExpanded(false);
    openDay(Number(dayPicker.value), true);
  });
  for (const button of modeButtons) button.addEventListener('click', () => setMode(button.dataset.overviewMode));
  document.getElementById('overviewZoomIn').onclick = () => zoom(1);
  document.getElementById('overviewZoomOut').onclick = () => zoom(-1);
  document.getElementById('overviewFit').onclick = fit;
  expand.onclick = () => toggleExpanded(!expanded);
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && expanded) toggleExpanded(false);
  });
  viewport.addEventListener('wheel', event => {
    if (ready || !event.deltaY || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
    event.preventDefault();
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? viewport.clientHeight : 1;
    zoomSaved(Math.exp(-Math.max(-180, Math.min(180, event.deltaY * unit)) * 0.003), event.clientX, event.clientY);
  }, {passive: false});
  image.addEventListener('pointerdown', event => {
    if (scale <= 1 || drag) return;
    image.setPointerCapture(event.pointerId);
    drag = {id: event.pointerId, x: event.clientX - x, y: event.clientY - y};
  });
  image.addEventListener('pointermove', event => {
    if (event.pointerId !== drag?.id) return;
    x = event.clientX - drag.x;
    y = event.clientY - drag.y;
    drawSaved();
  });
  image.addEventListener('lostpointercapture', () => { drag = null; });
  new ResizeObserver(() => { map?.resize(); drawSaved(); }).observe(viewport);

  async function start() {
    if (started) return;
    started = true;
    tell('Загружаем интерактивную карту…');
    try {
      await loadMapLibrary();
      map = new maplibregl.Map({
        container: mapElement, style: 'https://tiles.openfreemap.org/styles/liberty',
        center: [115.18, -8.48], zoom: 9, minZoom: 5, maxZoom: 18,
        scrollZoom: true, cooperativeGestures: false, renderWorldCopies: false,
        dragRotate: false, pitchWithRotate: false, attributionControl: false,
      });
      map.addControl(new maplibregl.ScaleControl({unit: 'metric'}), 'bottom-left');
      map.addControl(new maplibregl.AttributionControl({compact: true}), 'bottom-right');
      map.on('error', event => {
        if (mode === 'satellite' && (event.sourceId === 'overview-satellite' ||
            String(event.error?.message).includes('tiles.maps.eox.at'))) {
          tell('Часть спутниковых снимков недоступна. Можно переключиться на дорожную карту.');
        }
      });
      map.once('load', () => {
        for (const [layer, color] of [['water','#a7cfd0'], ['park','#cadcb8'], ['landcover_wood','#8cae83']]) {
          if (map.getLayer(layer)?.type === 'fill') map.setPaintProperty(layer,'fill-color',color);
        }
        map.addSource('overview-routes', {type: 'geojson', data: {type: 'FeatureCollection', features}});
        const routeLayer = {
          type: 'line', source: 'overview-routes', layout: {'line-join': 'round', 'line-cap': 'round'},
        };
        map.addLayer({...routeLayer, id: 'overview-route-halo', paint: {'line-color': '#fffaf0', 'line-width': 6}});
        map.addLayer({...routeLayer, id: 'overview-route-out', paint: {'line-color': '#165d50', 'line-width': 3}});
        map.addLayer({...routeLayer, id: 'overview-route-back', paint: {
          'line-color': '#ae522d', 'line-width': 3, 'line-dasharray': [2, 1.5],
        }});
        const marker = document.createElement('button');
        marker.className = 'map-pin home';
        marker.textContent = '⌂';
        marker.setAttribute('aria-label', itinerary.hotel.name);
        new maplibregl.Marker({element: marker}).setLngLat([itinerary.hotel.lon, itinerary.hotel.lat])
          .setPopup(new maplibregl.Popup({offset: 17}).setText(itinerary.hotel.name)).addTo(map);
        ready = true;
        image.hidden = true;
        mapElement.classList.add('overview-live');
        for (const button of modeButtons) button.disabled = false;
        dayPicker.disabled = false;
        tell('');
        selectDay();
      });
      setTimeout(() => {
        if (!ready) tell('Дорожная подложка пока недоступна. Сохранённую карту можно приблизить.');
      }, 11000);
    } catch {
      tell('В этом браузере доступна сохранённая карта. Её можно приближать и перетаскивать.');
    }
  }
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return;
      observer.disconnect();
      start();
    }, {rootMargin: '250px'});
    observer.observe(panel);
  } else start();
}
