// Ask Anything Tab Controller
import { state } from '../state.js';
import { LANGS, T } from '../i18n.js';
import { $, el, btn, copyText, toast } from '../ui.js';
import { speak, createRecognizer, isSpeechRecognitionSupported, micErrorMessage } from '../speech.js';
import { buildSystemPrompt, callAiStream, getAiErrorMessage, setStat } from '../ai.js';

let turns = [];
let askAbortController = null;
let isBusy = false;
let speechRecognizer = null;

const STARTERS = [
  'What does "overdue" mean on my bill?',
  'How do I apply for a ration card?',
  'Explain diabetes in simple words',
  'How can I check if a message is a scam?'
];

const DEMO_RESPONSES = {
  en: 'This is a sample answer, because live AI is in Demo mode.\n\nIn the full app, you get a clear answer in your language at the reading level you chose.\n\n1. Pick your language on the left.\n2. Choose Simple or Very simple.\n3. Press Read aloud under any answer.\n\nAdd your GEMINI_API_KEY in .env and restart to activate live AI.',
  hi: 'यह एक नमूना उत्तर है, क्योंकि लाइव AI डेमो मोड में है।\n\nपूरी ऐप में आपको अपनी चुनी हुई भाषा और स्तर में सीधा जवाब मिलता है जिसे आप सुन भी सकते हैं।\n\n1. बाईं तरफ अपनी भाषा चुनें।\n2. सरल या बहुत सरल स्तर चुनें।\n3. किसी भी उत्तर के नीचे "बोलकर सुनें" दबाएँ।\n\nलाइव AI चालू करने के लिए .env में GEMINI_API_KEY जोड़ें और रीस्टार्ट करें।',
  mr: 'हे एक नमुना उत्तर आहे, कारण लाइव्ह AI डेमो मोडमध्ये आहे.\n\nसंपूर्ण अॅपमध्ये तुम्हाला तुमच्या निवडलेल्या भाषेत आणि पातळीत सोपे उत्तर मिळते आणि तुम्ही ते ऐकू शकता.\n\n1. डावीकडे तुमची भाषा निवडा.\n2. साधे किंवा खूप साधे निवडा.\n3. उत्तराखाली "वाचून दाखवा" दाबा.\n\nलाइव्ह AI सक्रिय करण्यासाठी .env मध्ये GEMINI_API_KEY जोडा आणि रीस्टार्ट करा.'
};

export function initAskTab() {
  const startersEl = $('#starters');
  if (startersEl) {
    startersEl.innerHTML = '';
    STARTERS.forEach((q) => {
      const chip = el('button', 'chip', q);
      chip.type = 'button';
      chip.addEventListener('click', () => {
        $('#askIn').value = q;
        askSend();
      });
      startersEl.appendChild(chip);
    });
  }

  $('#askGo').addEventListener('click', askSend);
  $('#askStop').addEventListener('click', () => {
    if (askAbortController) askAbortController.abort();
  });

  $('#askIn').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      askSend();
    }
  });

  setupMicButton();
}

function setupMicButton() {
  const micBtn = $('#askMic');
  if (!micBtn) return;

  micBtn.addEventListener('click', () => {
    if (speechRecognizer) {
      speechRecognizer.stop();
      return;
    }

    if (!isSpeechRecognitionSupported()) {
      toast('Speech input is not supported in this browser. Try Chrome or Edge.');
      return;
    }

    let baseText = $('#askIn').value;
    speechRecognizer = createRecognizer({
      continuous: false,
      onText: (finalText, interimText) => {
        $('#askIn').value = (baseText ? baseText + ' ' : '') + finalText + interimText;
        if (finalText) baseText = $('#askIn').value;
      },
      onError: (errCode) => {
        toast(micErrorMessage(errCode));
      },
      onEnd: () => {
        speechRecognizer = null;
        micBtn.classList.remove('on');
        micBtn.setAttribute('aria-pressed', 'false');
        micBtn.querySelector('span').textContent = (T[state.lang] || T.en).speak;
        $('#askHint').textContent = '';
      }
    });

    try {
      speechRecognizer.start();
      micBtn.classList.add('on');
      micBtn.setAttribute('aria-pressed', 'true');
      micBtn.querySelector('span').textContent = 'Listening…';
      $('#askHint').textContent = `Speak now in ${LANGS[state.lang]?.n || 'English'}.`;
    } catch (_) {
      speechRecognizer = null;
    }
  });
}

function addMessage(roleClass, text) {
  const log = $('#log');
  const msgEl = el('div', `msg ${roleClass}`, text);
  log.appendChild(msgEl);
  log.scrollTop = 1e9;
  return msgEl;
}

function attachToolbar(msgEl, text) {
  const tb = el('div', 'tb');

  const rdBtn = btn('Read aloud', 'i-vol');
  rdBtn.addEventListener('click', () => speak(text, rdBtn));

  const simplerBtn = btn('Make it simpler', 'i-wand');
  simplerBtn.addEventListener('click', () => {
    $('#askIn').value = 'Explain that again in simpler words.';
    askSend();
  });

  const copyBtn = btn('Copy', 'i-copy');
  copyBtn.addEventListener('click', () => copyText(text));

  tb.appendChild(rdBtn);
  tb.appendChild(simplerBtn);
  tb.appendChild(copyBtn);
  msgEl.appendChild(tb);

  if (state.auto) {
    speak(text, rdBtn);
  }
}

export async function askSend() {
  if (isBusy) return;

  const inputEl = $('#askIn');
  const question = inputEl.value.trim();
  if (!question) {
    toast('Type or speak a question first');
    return;
  }

  const emptyEl = $('#askEmpty');
  if (emptyEl) emptyEl.hidden = true;
  inputEl.value = '';

  addMessage('u', question);

  const assistantMsgEl = addMessage('a', '');
  const thinkingEl = el('span', 'think');
  thinkingEl.appendChild(el('span', 'spin'));
  thinkingEl.appendChild(el('span', '', 'Thinking…'));
  assistantMsgEl.appendChild(thinkingEl);

  isBusy = true;
  $('#askGo').disabled = true;
  $('#askStop').hidden = false;

  turns.push({ role: 'user', content: question });
  if (turns.length > 10) turns = turns.slice(-10);
  while (turns.length && turns[0].role !== 'user') turns.shift();

  askAbortController = new AbortController();

  try {
    const systemPrompt = buildSystemPrompt();
    const result = await callAiStream({
      system: systemPrompt,
      messages: turns,
      tier: 'quick',
      signal: askAbortController.signal,
      onChunk: (textSoFar) => {
        assistantMsgEl.textContent = textSoFar;
        $('#log').scrollTop = 1e9;
      }
    });

    assistantMsgEl.textContent = result.text;
    turns.push({ role: 'assistant', content: result.text });
    attachToolbar(assistantMsgEl, result.text);
  } catch (err) {
    if (err.name === 'AbortError' || err.code === 'cancelled') {
      assistantMsgEl.textContent = 'Stopped.';
      turns.pop();
    } else if (err.code === 'demo_mode' || err.code === 'key_missing') {
      setStat('demo');
      const demoReply = DEMO_RESPONSES[state.lang] || DEMO_RESPONSES.en;
      assistantMsgEl.textContent = demoReply;
      turns.pop();
      attachToolbar(assistantMsgEl, demoReply);
    } else {
      assistantMsgEl.textContent = getAiErrorMessage(err.code);
      turns.pop();
    }
  } finally {
    isBusy = false;
    $('#askGo').disabled = false;
    $('#askStop').hidden = true;
    askAbortController = null;
  }
}
