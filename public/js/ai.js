// AI Client and Demo Mode Fallbacks Module
import { state } from './state.js';
import { LANGS } from './i18n.js';
import { $ } from './ui.js';

export let aiState = 'check'; // 'check' | 'on' | 'demo'

export function setStat(kind, customSub = null) {
  aiState = kind;
  const s = $('#aiStat');
  if (!s) return;
  s.className = 'stat ' + (kind === 'on' ? 'on' : (kind === 'demo' ? 'demo' : ''));

  const txt = $('#aiTxt');
  const sub = $('#aiSub');

  if (kind === 'on') {
    if (txt) txt.textContent = 'AI connected';
    if (sub) sub.textContent = 'Answers are generated live.';
  } else if (kind === 'demo') {
    if (txt) txt.textContent = 'Demo mode: showing sample answers';
    if (sub) sub.textContent = customSub || 'Add your GEMINI_API_KEY in .env and restart to activate live AI. All tools work with samples.';
  } else {
    if (txt) txt.textContent = 'Checking AI connection…';
    if (sub) sub.textContent = '';
  }
}

export async function checkAiHealth() {
  try {
    const res = await fetch('/api/health');
    if (!res.ok) throw new Error('Health check failed');
    const data = await res.json();
    if (data.ok && data.provider === 'gemini') {
      setStat('on');
    } else {
      setStat('demo', 'Add your GEMINI_API_KEY in .env and restart.');
    }
  } catch (err) {
    console.warn('[AI] Health check error:', err);
    setStat('demo');
  }
}

export function buildSystemPrompt() {
  const levels = [
    'Normal: clear and concise.',
    'Simple: about a grade 6 reading level. Short sentences. Everyday words.',
    'Very simple: about a grade 3 reading level. Very short sentences. One idea per sentence. No hard words.'
  ];
  const langConfig = LANGS[state.lang] || LANGS.en;
  const levelText = levels[state.lv] || levels[0];

  return `You are Samavesh, an AI assistant built so that everyone can use AI, including people with disabilities, people with low literacy, and people who do not speak English.
Rules:
- Reply in ${langConfig.n}.
- Reading level: ${levelText}
- Explain any hard word the first time you use it.
- Plain text only. No markdown symbols, no emoji, no tables. For steps, put each on a new line starting with 1., 2., 3.
- Be warm, direct and accurate. If you are not sure, say so.
- For medical, legal or money questions, give clear general information and add one short line to check with a qualified person.
- Keep answers under 150 words unless asked for more.`;
}

export function parseJsonDefensively(text) {
  if (!text || typeof text !== 'string') {
    throw new Error('Empty response for JSON parsing');
  }

  // Strip code fences if present
  let clean = text.trim();
  clean = clean.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();

  // Find first '{' and last '}'
  const start = clean.indexOf('{');
  const end = clean.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) {
    clean = clean.slice(start, end + 1);
  }

  return JSON.parse(clean);
}

export async function callAiStream({ system, messages, image, tier = 'quick', signal, onChunk }) {
  if (aiState === 'demo') {
    const err = new Error('demo_mode');
    err.code = 'demo_mode';
    throw err;
  }

  const res = await fetch('/api/ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify({
      system,
      messages,
      image,
      tier,
      stream: true
    })
  });

  if (!res.ok) {
    let errCode = 'ai_failed';
    try {
      const errData = await res.json();
      errCode = errData.error || errCode;
    } catch (_) {}
    const err = new Error(errCode);
    err.code = errCode;
    throw err;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let accumulatedText = '';
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop();

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const dataStr = trimmed.slice(5).trim();
      if (dataStr === '[DONE]') {
        return { text: accumulatedText };
      }
      try {
        const parsed = JSON.parse(dataStr);
        if (parsed.text) {
          accumulatedText += parsed.text;
          if (onChunk) onChunk(accumulatedText);
        }
      } catch (_) {}
    }
  }

  return { text: accumulatedText };
}

export async function callAiJson({ system, messages, image, tier = 'default', signal }) {
  if (aiState === 'demo') {
    const err = new Error('demo_mode');
    err.code = 'demo_mode';
    throw err;
  }

  const res = await fetch('/api/ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify({
      system,
      messages,
      image,
      tier,
      json: true,
      stream: false
    })
  });

  if (!res.ok) {
    let errCode = 'ai_failed';
    try {
      const errData = await res.json();
      errCode = errData.error || errCode;
    } catch (_) {}
    const err = new Error(errCode);
    err.code = errCode;
    throw err;
  }

  const data = await res.json();
  return parseJsonDefensively(data.text);
}

export function getAiErrorMessage(code) {
  if (code === 'rate_limited') {
    return 'Too many requests were sent. Please wait a moment and try again.';
  }
  if (code === 'refused') {
    return 'The AI could not fulfill this request due to safety policies. Try rewording your question.';
  }
  if (code === 'key_missing' || code === 'demo_mode') {
    return 'Live AI is not configured. Showing sample answer in Demo mode.';
  }
  if (code === 'timeout') {
    return 'The request timed out. Check your internet connection and try again.';
  }
  return 'Something went wrong while connecting to the AI. Please try again.';
}
