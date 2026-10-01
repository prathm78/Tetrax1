// Understand a Letter or Form Tab Controller
import { state } from '../state.js';
import { LANGS } from '../i18n.js';
import { $, el, btn, copyText, toast } from '../ui.js';
import { speak } from '../speech.js';
import { buildSystemPrompt, callAiJson, getAiErrorMessage, setStat } from '../ai.js';

const EX_LETTER = `To: The Account Holder
Subject: Notice under Section 14(2) regarding arrears

This is to inform you that, pursuant to the provisions of the Electricity Supply Code, an amount of Rs. 1,284/- remains outstanding against Consumer No. 4471 0293 for the billing cycle ending 30 September. Failing remittance of the aforementioned sum on or before 5 October, a delayed payment surcharge of Rs. 50/- shall be levied, and the Company reserves the right to initiate disconnection proceedings after a further period of fifteen (15) days. Consumers who have already remitted the amount are requested to disregard this notice and furnish the transaction reference at the nearest office.`;

let docBlob = null;
let docAbortController = null;

export function initDocTab() {
  $('#docEx').addEventListener('click', () => {
    $('#docIn').value = EX_LETTER;
    clearDocFile();
    toast('Example letter added');
  });

  const fileInput = $('#docFile');
  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      toast('File is too large. Please select an image under 15MB.');
      fileInput.value = '';
      return;
    }

    docBlob = file;
    $('#docFn').textContent = file.name;
    toast(`Loaded ${file.name}`);
  });

  $('#docGo').addEventListener('click', handleDocSubmit);
}

function clearDocFile() {
  docBlob = null;
  const fileInput = $('#docFile');
  if (fileInput) fileInput.value = '';
  const fnLabel = $('#docFn');
  if (fnLabel) fnLabel.textContent = '';
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function docDemoResult() {
  return {
    summary: 'You owe Rs 1,284 for electricity. You must pay by 5 October. If you pay late, you will pay Rs 50 extra.',
    says: [
      'You have an unpaid electricity bill of Rs 1,284.',
      'There is a late fee of Rs 50 if you pay after 5 October.',
      'If you still do not pay, the company can cut your connection after 15 more days.',
      'If you already paid, you can ignore this letter.'
    ],
    todo: [
      'Pay Rs 1,284 on or before 5 October.',
      'Keep the payment receipt safely.',
      'If you already paid, take the receipt number to the nearest office.'
    ],
    deadlines: [
      '5 October: last day to pay without the Rs 50 late fee',
      '15 days after that: power connection may be disconnected'
    ],
    words: [
      { word: 'Arrears', meaning: 'Money you still owe from past bills.' },
      { word: 'Surcharge', meaning: 'An extra fee added to your bill for late payment.' },
      { word: 'Remittance', meaning: 'Paying the money you owe.' }
    ],
    caution: 'This is a sample result. Check the exact dates and amounts on your own notice.'
  };
}

function renderDocCard(title, contentNode, className = '') {
  const card = el('div', `rc ${className}`);
  card.appendChild(el('h3', '', title));
  card.appendChild(contentNode);
  return card;
}

function renderDocResult(data, isDemo = false) {
  const out = $('#docOut');
  out.innerHTML = '';

  if (isDemo) {
    const demoCard = el('div', 'rc warn');
    demoCard.appendChild(el('p', '', 'Demo mode: this is a sample breakdown for the electricity notice. Add your GEMINI_API_KEY in .env and restart to analyze real documents.'));
    out.appendChild(demoCard);
  }

  // Summary
  if (data.summary) {
    out.appendChild(renderDocCard('In short', el('p', '', data.summary), 'big'));
  }

  // What it says
  if (Array.isArray(data.says) && data.says.length > 0) {
    const ul = el('ul');
    data.says.forEach((item) => ul.appendChild(el('li', '', String(item))));
    out.appendChild(renderDocCard('What it says', ul));
  }

  // Actions
  if (Array.isArray(data.todo) && data.todo.length > 0) {
    const ol = el('ol');
    data.todo.forEach((item) => ol.appendChild(el('li', '', String(item))));
    out.appendChild(renderDocCard('What you need to do', ol));
  }

  // Deadlines
  if (Array.isArray(data.deadlines) && data.deadlines.length > 0) {
    const ul = el('ul');
    data.deadlines.forEach((item) => ul.appendChild(el('li', '', String(item))));
    out.appendChild(renderDocCard('Dates to remember', ul));
  }

  // Hard words
  if (Array.isArray(data.words) && data.words.length > 0) {
    const dl = el('dl');
    data.words.forEach((w) => {
      dl.appendChild(el('dt', '', String(w.word || '')));
      dl.appendChild(el('dd', '', String(w.meaning || '')));
    });
    out.appendChild(renderDocCard('Hard words explained', dl));
  }

  // Caution
  if (data.caution && String(data.caution).trim()) {
    out.appendChild(renderDocCard('Be careful', el('p', '', data.caution), 'warn'));
  }

  // Read aloud & copy toolbar
  const fullTextToRead = [
    data.summary || '',
    'What you need to do:',
    ...(data.todo || []),
    'Dates to remember:',
    ...(data.deadlines || [])
  ].filter(Boolean).join('. ');

  const tb = el('div', 'rtb');
  const readBtn = btn('Read aloud', 'i-vol');
  readBtn.addEventListener('click', () => speak(fullTextToRead, readBtn));
  const copyBtn = btn('Copy all', 'i-copy');
  copyBtn.addEventListener('click', () => copyText(fullTextToRead));

  tb.appendChild(readBtn);
  tb.appendChild(copyBtn);
  out.appendChild(tb);

  if (state.auto) {
    speak(fullTextToRead, readBtn);
  }
}

async function handleDocSubmit() {
  const text = $('#docIn').value.trim();
  if (!text && !docBlob) {
    toast('Paste document text or add a photo first');
    return;
  }

  const out = $('#docOut');
  out.innerHTML = '';

  if (docAbortController) docAbortController.abort();
  docAbortController = new AbortController();
  const signal = docAbortController.signal;

  // Show thinking indicator
  const thinkCard = el('div', 'rc');
  const th = el('span', 'think');
  th.appendChild(el('span', 'spin'));
  th.appendChild(el('span', '', 'Reading and analyzing document…'));
  thinkCard.appendChild(th);
  const stopBtn = btn('Stop', 'i-stop');
  stopBtn.style.marginLeft = '14px';
  stopBtn.addEventListener('click', () => docAbortController.abort());
  thinkCard.appendChild(stopBtn);
  out.appendChild(thinkCard);

  const langConfig = LANGS[state.lang] || LANGS.en;
  const prompt = `${buildSystemPrompt()}

Task: Explain this document to the person. Reply with ONLY a JSON object with these keys, all text in ${langConfig.n} at the reading level above:
{
  "summary": "2 sentences max, the most important point",
  "says": ["3-5 short points about what the document says"],
  "todo": ["clear actions the person should take, in order"],
  "deadlines": ["each date or time limit with what happens"],
  "words": [{"word":"hard word from the document","meaning":"simple meaning"}],
  "caution": "one short line if there is a risk, a scam sign or a need to check with a professional, else empty string"
}

Document content:
${text ? text.slice(0, 8000) : '(see the attached photo/document image)'}`;

  let imagePayload = undefined;
  if (docBlob) {
    try {
      const base64Data = await fileToBase64(docBlob);
      imagePayload = {
        mime: docBlob.type || 'image/jpeg',
        data: base64Data
      };
    } catch (e) {
      console.warn('[Doc] Failed reading file base64:', e);
    }
  }

  try {
    const data = await callAiJson({
      system: buildSystemPrompt(),
      messages: [{ role: 'user', content: prompt }],
      image: imagePayload,
      tier: 'default',
      signal
    });
    renderDocResult(data, false);
  } catch (err) {
    if (err.name === 'AbortError' || err.code === 'cancelled') {
      out.innerHTML = '';
      return;
    }
    if (err.code === 'demo_mode' || err.code === 'key_missing') {
      setStat('demo');
      renderDocResult(docDemoResult(), true);
      return;
    }
    out.innerHTML = '';
    const errCard = el('div', 'rc warn');
    errCard.appendChild(el('p', '', getAiErrorMessage(err.code)));
    out.appendChild(errCard);
  } finally {
    docAbortController = null;
  }
}
