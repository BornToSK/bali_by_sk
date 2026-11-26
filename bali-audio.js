'use strict';

(() => {
  const button = document.querySelector('[data-ocean-sound]');
  if (!button) return;

  const preferenceKey = 'bali-ocean-muted';
  let muted = false;
  try { muted = localStorage.getItem(preferenceKey) === 'true'; }
  catch { /* Audio remains usable without storage. */ }

  const ocean = new Audio();
  ocean.preload = muted ? 'none' : 'auto';
  ocean.src = new URL('assets/ocean-waves.mp3', location.href);
  ocean.loop = true;
  let needsGesture = false;
  let playing = false;
  let pagePresent = true;

  const canPlay = () => pagePresent && !muted && !document.hidden && document.hasFocus();

  function render() {
    const active = playing && canPlay() && !ocean.paused && !ocean.error;
    button.hidden = Boolean(ocean.error);
    button.setAttribute('aria-pressed', String(active));
    button.toggleAttribute('data-needs-gesture', needsGesture && !muted && !active);
    button.title = active ? 'Выключить звук океана' : 'Включить звук океана';
  }

  function start() {
    if (!canPlay() || !ocean.paused || ocean.error) return;
    ocean.play().catch(error => {
      if (error.name === 'NotAllowedError') needsGesture = true;
      render();
    });
  }

  button.addEventListener('click', () => {
    muted = !muted && !ocean.paused;
    try { localStorage.setItem(preferenceKey, String(muted)); }
    catch { /* Keep the preference for this page. */ }
    if (muted) ocean.pause();
    else start();
    render();
  });

  ocean.addEventListener('playing', () => {
    if (!canPlay()) {
      pause();
      return;
    }
    playing = true;
    needsGesture = false;
    render();
  });
  ocean.addEventListener('pause', () => {
    playing = false;
    render();
  });
  ocean.addEventListener('error', render);

  function activate(event) {
    if (!event.isTrusted || event.target.closest?.('[data-ocean-sound]')) return;
    start();
  }
  document.addEventListener('click', activate, {capture:true});
  document.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') activate(event);
  }, {capture:true});
  function pause() {
    ocean.pause();
    playing = false;
    render();
  }

  function syncActivity() {
    if (canPlay()) start();
    else pause();
  }

  addEventListener('blur', pause);
  addEventListener('focus', syncActivity);
  document.addEventListener('visibilitychange', syncActivity);
  addEventListener('storage', event => {
    if (event.key !== preferenceKey) return;
    muted = event.newValue === 'true';
    syncActivity();
  });
  addEventListener('pagehide', () => {
    pagePresent = false;
    pause();
  });
  addEventListener('pageshow', () => {
    pagePresent = true;
    syncActivity();
  });

  needsGesture = navigator.getAutoplayPolicy?.('mediaelement') === 'disallowed';
  render();
  if (!needsGesture) start();
})();
