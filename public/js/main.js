// Main Application Entrypoint & Orchestration Module
import { state, loadSettings, saveSettings, resetSettings, subscribe } from './state.js';
import { LANGS, T, translateDOM } from './i18n.js';
import { $, $$, el, toast } from './ui.js';
import { stopSpeak } from './speech.js';
import { checkAiHealth } from './ai.js';

import { initAskTab } from './tabs/ask.js';
import { initDocTab } from './tabs/document.js';
import { initPhotoTab } from './tabs/photo.js';
import { initCaptionsTab } from './tabs/captions.js';
import { initWebcheckTab } from './tabs/webcheck.js';

const TABS = ['ask', 'doc', 'photo', 'cap', 'web'];

function showTab(tabName, focus = false) {
  TABS.forEach((t) => {
    const isSelected = t === tabName;
    const tabBtn = $(`#tab-${t}`);
    const panel = $(`#p-${t}`);

    if (tabBtn) {
      tabBtn.setAttribute('aria-selected', isSelected.toString());
      tabBtn.tabIndex = isSelected ? 0 : -1;
    }
    if (panel) {
      panel.hidden = !isSelected;
    }
  });

  if (focus) {
    const activeBtn = $(`#tab-${tabName}`);
    if (activeBtn) activeBtn.focus();
  }

  stopSpeak();
}

function initTabs() {
  TABS.forEach((tabId, idx) => {
    const btnEl = $(`#tab-${tabId}`);
    if (!btnEl) return;

    btnEl.addEventListener('click', () => showTab(tabId));

    btnEl.addEventListener('keydown', (e) => {
      let targetIdx = null;
      if (e.key === 'ArrowRight') {
        targetIdx = (idx + 1) % TABS.length;
      } else if (e.key === 'ArrowLeft') {
        targetIdx = (idx + TABS.length - 1) % TABS.length;
      } else if (e.key === 'Home') {
        targetIdx = 0;
      } else if (e.key === 'End') {
        targetIdx = TABS.length - 1;
      }

      if (targetIdx !== null) {
        e.preventDefault();
        showTab(TABS[targetIdx], true);
      }
    });
  });

  // Global Alt+1 to Alt+5 shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.altKey && e.key >= '1' && e.key <= '5') {
      e.preventDefault();
      const tabIdx = parseInt(e.key, 10) - 1;
      if (tabIdx >= 0 && tabIdx < TABS.length) {
        showTab(TABS[tabIdx], true);
      }
    }
  });
}

function initSettingsControls() {
  const selLang = $('#selLang');
  if (selLang) {
    selLang.innerHTML = '';
    Object.keys(LANGS).forEach((k) => {
      const opt = el('option', '', LANGS[k].native + (k === 'en' ? '' : ` (${LANGS[k].n})`));
      opt.value = k;
      selLang.appendChild(opt);
    });
    selLang.addEventListener('change', () => {
      saveSettings({ lang: selLang.value });
    });
  }

  // Quick switch buttons in header
  $$('[data-lang]').forEach((btnEl) => {
    btnEl.addEventListener('click', () => {
      saveSettings({ lang: btnEl.dataset.lang });
    });
  });

  // Reading Level segmented buttons
  $$('#lvSeg button').forEach((btnEl) => {
    btnEl.addEventListener('click', () => {
      saveSettings({ lv: parseInt(btnEl.dataset.v, 10) });
    });
  });

  // Voice Speed segmented buttons
  $$('#spSeg button').forEach((btnEl) => {
    btnEl.addEventListener('click', () => {
      saveSettings({ sp: parseInt(btnEl.dataset.v, 10) });
    });
  });

  // Theme segmented buttons
  $$('#thSeg button').forEach((btnEl) => {
    btnEl.addEventListener('click', () => {
      saveSettings({ th: btnEl.dataset.v });
    });
  });

  // Colour vision selector
  const selCb = $('#selCb');
  if (selCb) {
    selCb.addEventListener('change', (e) => {
      saveSettings({ cb: e.target.value });
    });
  }

  // Text size slider
  const fszInput = $('#fsz');
  const fszoOutput = $('#fszo');
  if (fszInput) {
    fszInput.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      if (fszoOutput) fszoOutput.textContent = `${val}%`;
      saveSettings({ fs: val });
    });
  }

  // Switches
  const autoSwitch = $('#auto');
  if (autoSwitch) {
    autoSwitch.addEventListener('change', (e) => {
      saveSettings({ auto: e.target.checked });
    });
  }

  const dysSwitch = $('#dys');
  if (dysSwitch) {
    dysSwitch.addEventListener('change', (e) => {
      saveSettings({ dys: e.target.checked });
    });
  }

  const motSwitch = $('#mot');
  if (motSwitch) {
    motSwitch.addEventListener('change', (e) => {
      saveSettings({ mot: e.target.checked });
    });
  }

  // Reset button
  const rstBtn = $('#rst');
  if (rstBtn) {
    rstBtn.addEventListener('click', () => {
      resetSettings();
      toast('All settings reset to default');
    });
  }

  // Collapse settings on mobile by default
  if (window.matchMedia && matchMedia('(max-width: 940px)').matches) {
    const setBox = $('#setBox');
    if (setBox) setBox.removeAttribute('open');
  }
}

function updateUiFromState(currState) {
  // Update form inputs to reflect state
  const selLang = $('#selLang');
  if (selLang) selLang.value = currState.lang;

  $$('[data-lang]').forEach((b) => {
    b.setAttribute('aria-pressed', (b.dataset.lang === currState.lang).toString());
  });

  $$('#lvSeg button').forEach((b) => {
    b.setAttribute('aria-pressed', (parseInt(b.dataset.v, 10) === currState.lv).toString());
  });

  $$('#spSeg button').forEach((b) => {
    b.setAttribute('aria-pressed', (parseInt(b.dataset.v, 10) === currState.sp).toString());
  });

  $$('#thSeg button').forEach((b) => {
    b.setAttribute('aria-pressed', (b.dataset.v === currState.th).toString());
  });

  const selCb = $('#selCb');
  if (selCb) selCb.value = currState.cb;

  const fszInput = $('#fsz');
  const fszoOutput = $('#fszo');
  if (fszInput) fszInput.value = currState.fs;
  if (fszoOutput) fszoOutput.textContent = `${currState.fs}%`;

  const autoSwitch = $('#auto');
  if (autoSwitch) autoSwitch.checked = currState.auto;

  const dysSwitch = $('#dys');
  if (dysSwitch) dysSwitch.checked = currState.dys;

  const motSwitch = $('#mot');
  if (motSwitch) motSwitch.checked = currState.mot;

  translateDOM(currState.lang);
}

function initWhySection() {
  const EX_LETTER = `To: The Account Holder\nSubject: Notice under Section 14(2) regarding arrears\n\nThis is to inform you that, pursuant to the provisions of the Electricity Supply Code, an amount of Rs. 1,284/- remains outstanding against Consumer No. 4471 0293 for the billing cycle ending 30 September.`;
  const EX_HTML = `<html><head><meta name="viewport" content="user-scalable=no"></head><body><h1>City</h1><img src="pic.jpg"><button></button></body></html>`;

  function scrollToWorkbench() {
    const trySection = document.getElementById('try');
    if (trySection) {
      trySection.scrollIntoView({ behavior: state.mot ? 'auto' : 'smooth' });
    }
    if (window.matchMedia && matchMedia('(max-width: 940px)').matches) {
      const setBox = $('#setBox');
      if (setBox) setBox.removeAttribute('open');
    }
  }

  const WHY_ITEMS = [
    [
      '“The letter from the bank is in hard English.”',
      'Paste it, get what it says and what to do.',
      () => {
        saveSettings({ lv: 1 });
        showTab('doc');
        const docIn = $('#docIn');
        if (docIn) docIn.value = EX_LETTER;
        scrollToWorkbench();
      }
    ],
    [
      '“Someone sent me a photo and I cannot see it.”',
      'Get a clear description and any text in the picture.',
      () => {
        showTab('photo');
        scrollToWorkbench();
      }
    ],
    [
      '“I cannot hear the lecture or the call.”',
      'Live captions in large type.',
      () => {
        showTab('cap');
        scrollToWorkbench();
      }
    ],
    [
      '“Typing is hard for me. I would rather talk.”',
      'Speak your question and listen to the answer.',
      () => {
        saveSettings({ auto: true });
        showTab('ask');
        scrollToWorkbench();
      }
    ],
    [
      '“English is not my first language.”',
      'Ask and listen in Hindi, Marathi and five more.',
      () => {
        saveSettings({ lang: 'hi' });
        showTab('ask');
        scrollToWorkbench();
      }
    ],
    [
      '“Long answers wear me out.”',
      'Choose Very simple and get one idea per sentence.',
      () => {
        saveSettings({ lv: 2, fs: 130 });
        showTab('ask');
        scrollToWorkbench();
      }
    ],
    [
      '“I build websites. I want them to work for everyone.”',
      'Paste your HTML and get a score and a fixed version.',
      () => {
        showTab('web');
        const webIn = $('#webIn');
        if (webIn) webIn.value = EX_HTML;
        scrollToWorkbench();
      }
    ]
  ];

  const whyListEl = $('#whyList');
  if (whyListEl) {
    whyListEl.innerHTML = '';
    WHY_ITEMS.forEach(([quote, desc, handler]) => {
      const li = el('li');
      const textDiv = el('div');
      textDiv.appendChild(el('q', '', quote));
      textDiv.appendChild(el('span', '', desc));
      li.appendChild(textDiv);

      const tryBtn = el('button', 'btn sm', 'Try it');
      tryBtn.type = 'button';
      tryBtn.setAttribute('aria-label', `Try it: ${quote.replace(/[“”]/g, '')}`);
      tryBtn.addEventListener('click', handler);
      li.appendChild(tryBtn);

      whyListEl.appendChild(li);
    });
  }
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.warn('[SW] Registration failed:', err);
      });
    });
  }
}

// App Initialization
document.addEventListener('DOMContentLoaded', () => {
  subscribe(updateUiFromState);
  loadSettings();

  initTabs();
  initSettingsControls();
  initWhySection();

  // Initialize tool tabs
  initAskTab();
  initDocTab();
  initPhotoTab();
  initCaptionsTab();
  initWebcheckTab();

  // Check backend Gemini connection
  checkAiHealth();

  // Register service worker
  registerServiceWorker();
});
