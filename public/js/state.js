// Settings state and persistence module

const STORAGE_KEY = 'samavesh_settings';

export const DEFAULT_SETTINGS = {
  lang: 'en',
  lv: 0,        // 0: Normal, 1: Simple, 2: Very simple
  auto: false,  // Read aloud automatically
  sp: 1,        // 0: Slow, 1: Normal, 2: Fast
  fs: 100,      // Text size 100% to 200%
  th: 'auto',   // auto, light, dark, yellow
  cb: 'none',   // none, pro, deu, tri, grey
  dys: false,   // Dyslexia-friendly font & spacing
  mot: false    // Reduce motion
};

export const state = { ...DEFAULT_SETTINGS };

const listeners = new Set();

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notify() {
  for (const fn of listeners) {
    try {
      fn(state);
    } catch (err) {
      console.error('[State] Listener error:', err);
    }
  }
}

export function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      for (const k of Object.keys(DEFAULT_SETTINGS)) {
        if (k in parsed) {
          state[k] = parsed[k];
        }
      }
    }
  } catch (err) {
    console.warn('[State] Failed to read localStorage:', err);
  }
  applySettings();
  notify();
}

export function saveSettings(updates = {}) {
  Object.assign(state, updates);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.warn('[State] Failed to write localStorage:', err);
  }
  applySettings();
  notify();
}

export function resetSettings() {
  Object.assign(state, DEFAULT_SETTINGS);
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (err) {}
  applySettings();
  notify();
}

export function applySettings() {
  const root = document.documentElement;
  const body = document.body;
  const page = document.getElementById('page');

  // Language attribute
  root.lang = state.lang;

  // Font size scale
  root.style.setProperty('--fs', (state.fs / 100).toString());

  // Theme attribute
  if (state.th === 'auto') {
    root.removeAttribute('data-theme');
  } else {
    root.setAttribute('data-theme', state.th);
  }

  // Color vision SVG filter
  if (page) {
    if (state.cb === 'none') {
      page.style.filter = '';
    } else if (state.cb === 'grey') {
      page.style.filter = 'grayscale(1)';
    } else {
      page.style.filter = `url(#f-${state.cb})`;
    }
  }

  // Dyslexia & motion classes on body
  body.classList.toggle('dys', !!state.dys);
  body.classList.toggle('still', !!state.mot);
}
