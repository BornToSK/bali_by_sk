'use strict';

let mapLibraryPromise;
const mealSwapStorageKey = 'bali-all-cafes-swaps-v1';
function mealPlanSignature(days) {
  return JSON.stringify(days.map(day=>day.meals.map(meal=>[meal.restaurant_id,meal.start])));
}
function refreshTripMeals(trip) {
  for (const entry of trip.restaurant_coverage) {
    entry.visits=trip.days.flatMap(day=>day.meals.filter(meal=>meal.restaurant_id===entry.id)
      .map(meal=>({date:day.date,meal_type:meal.meal_type,start:meal.start,end:meal.end,mode:meal.meal_mode})));
    entry.date=entry.visits.find(visit=>visit.mode==='onsite')?.date;
  }
  trip.personalized=trip.days.some(day=>day.customized);
}
function restoreMealPlan(trip) {
  try {
    const saved=JSON.parse(localStorage.getItem(mealSwapStorageKey)||'null');
    if (saved?.signature!==mealPlanSignature(trip.days) || !Array.isArray(saved.days)) return;
    const restored=trip.days.map(day=>saved.days.find(entry=>entry?.number===day.number &&
      entry.date===day.date && entry.customized && Array.isArray(entry.meals) &&
      Array.isArray(entry.timeline) && Array.isArray(entry.legs) && Array.isArray(entry.route_stops))||day);
    const onsite=restored.flatMap(day=>day.meals.filter(meal=>meal.meal_mode==='onsite').map(meal=>meal.restaurant_id));
    const expected=new Set(trip.restaurant_coverage.map(entry=>entry.id));
    if (onsite.length!==expected.size || new Set(onsite).size!==expected.size || onsite.some(id=>!expected.has(id))) return;
    if (restored.some((day,index)=>day!==trip.days[index])) {
      trip.days=restored;
      refreshTripMeals(trip);
    }
  } catch {
    // A corrupt or obsolete local plan must not interrupt the trip.
  }
}
async function afterCoverPaint() {
  if (location.hash && location.hash !== '#top') return;
  const hero = document.querySelector('.exp-hero-art img');
  if (!hero?.decode) return;
  await Promise.race([hero.decode().catch(() => {}), new Promise(resolve=>setTimeout(resolve, 900))]);
  await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
}
function waitForRouteInterest() {
  if (location.hash && location.hash!=='#top' || !('IntersectionObserver' in window)) return Promise.resolve();
  return new Promise(resolve=>{
    const observer=new IntersectionObserver(entries=>{
      if(entries.some(entry=>entry.isIntersecting)) start();
    },{rootMargin:'260px'});
    function start() {
      observer.disconnect();
      removeEventListener('hashchange',onHash);
      document.removeEventListener('click',onLink);
      resolve();
    }
    function onHash() {
      if(location.hash && location.hash!=='#top') start();
    }
    function onLink(event) {
      const link=event.target.closest?.('a[href^="#"]');
      if(link && link.hash!=='#top' && link.hash!=='#mainContent') start();
    }
    for(const section of ['exploreBali','overviewPanel','journeyFilm','days']) observer.observe(document.getElementById(section));
    addEventListener('hashchange',onHash);
    document.addEventListener('click',onLink);
  });
}
async function loadItinerary() {
  await waitForRouteInterest();
  await afterCoverPaint();
  if ('DecompressionStream' in window) {
    try {
      const compressed = await fetch('itinerary.json.gz', {priority:'low'});
      if (compressed.ok && compressed.body) {
        return await new Response(compressed.body.pipeThrough(new DecompressionStream('gzip'))).json();
      }
    } catch {
      // If the published compressed file is absent, use the canonical JSON.
    }
  }
  const response = await fetch('itinerary.json');
  if (!response.ok) throw new Error('Не удалось загрузить данные маршрута');
  return response.json();
}

function initLazyMealEditor() {
  function load() {
    const script = document.createElement('script');
    script.src = 'meal-editor-all.js?v=audit2';
    document.head.append(script);
  }
  if (!('IntersectionObserver' in window)) { load(); return; }
  const observer = new IntersectionObserver(entries => {
    if (!entries.some(entry => entry.isIntersecting)) return;
    observer.disconnect();
    load();
  }, {rootMargin:'240px'});
  observer.observe(document.getElementById('schedulePanel'));
  observer.observe(document.getElementById('restaurantAlternatives'));
}

function loadMapLibrary() {
  if (mapLibraryPromise) return mapLibraryPromise;
  if (window.maplibregl) return Promise.resolve();
  if (!mapLibraryPromise) {
    const styleReady = new Promise((resolve, reject) => {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'vendor/maplibre-gl.css';
      link.addEventListener('load', resolve, {once:true});
      link.addEventListener('error', () => reject(new Error('Стили карты не загрузились')), {once:true});
      document.head.append(link);
    });
    const scriptReady = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'vendor/maplibre-gl.js';
      script.addEventListener('load', resolve, {once: true});
      script.addEventListener('error', () => reject(new Error('MapLibre не загрузился')), {once: true});
      document.head.append(script);
    });
    mapLibraryPromise = Promise.all([styleReady,scriptReady]);
  }
  return mapLibraryPromise;
}

function loadEditorialImages(root=document) {
  const images = root.querySelectorAll('img[data-lazy-src]');
  function load(image) {
    if (!image.dataset.lazySrc) return;
    image.src = image.dataset.lazySrc;
    delete image.dataset.lazySrc;
  }
  if (!('IntersectionObserver' in window)) { images.forEach(load); return; }
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      observer.unobserve(entry.target);
      load(entry.target);
    }
  }, {rootMargin:'260px'});
  images.forEach(image => observer.observe(image));
}

function initSceneNavigation() {
  const links = [...document.querySelectorAll('[data-scene-link]')];
  const sections = links.map(link => [link, document.querySelector(link.hash)]);
  const detail = document.getElementById('days');
  const root = document.documentElement;
  let queued = false;
  function paint() {
    queued = false;
    const threshold = Math.min(innerHeight * .35, 190);
    let active = links[0];
    let closestTop = -Infinity;
    for (const [link, section] of sections) {
      const top = section?.getBoundingClientRect().top;
      if (top <= threshold && top > closestTop) {
        active = link;
        closestTop = top;
      }
    }
    const detailRect = detail.getBoundingClientRect();
    if (detailRect.top <= threshold && detailRect.bottom > threshold) {
      active = links.find(link => link.hash === '#overviewHeading');
    }
    const practical = document.getElementById('practical');
    if (practical.getBoundingClientRect().top <= threshold) active = null;
    for (const link of links) {
      if (link === active) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    }
    const extent = root.scrollHeight - innerHeight;
    root.style.setProperty('--page-progress', extent > 0 ? Math.min(1, Math.max(0, scrollY / extent)) : 0);
  }
  function update() {
    if (!queued) {
      queued = true;
      requestAnimationFrame(paint);
    }
  }
  addEventListener('scroll', update, {passive:true});
  addEventListener('resize', update);
  document.addEventListener('bali-day-changed', update);
  paint();
}
initSceneNavigation();
