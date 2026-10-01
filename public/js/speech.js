// Speech Synthesis and Recognition Module
import { state } from './state.js';
import { LANGS } from './i18n.js';
import { toast } from './ui.js';

let currentSpeakerBtn = null;

export function stopSpeak() {
  if ('speechSynthesis' in window) {
    speechSynthesis.cancel();
  }
  if (currentSpeakerBtn) {
    updateSpeakerBtn(currentSpeakerBtn, false);
    currentSpeakerBtn = null;
  }
}

function updateSpeakerBtn(btn, isPlaying) {
  const span = btn.querySelector('span');
  if (span) span.textContent = isPlaying ? 'Stop' : 'Read aloud';
  const use = btn.querySelector('use');
  if (use) use.setAttribute('href', isPlaying ? '#i-stop' : '#i-vol');
}

export function speak(text, btnEl = null) {
  if (!('speechSynthesis' in window)) {
    toast('Reading aloud is not supported in this browser.');
    return;
  }

  // Toggle off if currently playing on this button
  if (currentSpeakerBtn === btnEl && btnEl !== null) {
    stopSpeak();
    return;
  }

  stopSpeak();

  if (!text || !text.trim()) return;

  const utterance = new SpeechSynthesisUtterance(text);
  const langConfig = LANGS[state.lang] || LANGS.en;
  utterance.lang = langConfig.sp;

  // Rate: 0: 0.8 (Slow), 1: 1.0 (Normal), 2: 1.25 (Fast)
  const rates = [0.8, 1.0, 1.25];
  utterance.rate = rates[state.sp] !== undefined ? rates[state.sp] : 1.0;

  const voices = speechSynthesis.getVoices();
  if (voices.length > 0) {
    const langPrefix = utterance.lang.slice(0, 2).toLowerCase();
    const match = voices.find(v => v.lang.toLowerCase().startsWith(langPrefix));
    if (match) {
      utterance.voice = match;
    } else {
      console.warn(`[Speech] No voice matching prefix ${langPrefix}. Using system default.`);
    }
  }

  utterance.onend = utterance.onerror = () => {
    if (currentSpeakerBtn === btnEl && btnEl !== null) {
      updateSpeakerBtn(btnEl, false);
      currentSpeakerBtn = null;
    }
  };

  if (btnEl) {
    currentSpeakerBtn = btnEl;
    updateSpeakerBtn(btnEl, true);
  }

  speechSynthesis.speak(utterance);
}

// Speech Recognition helper
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

export function isSpeechRecognitionSupported() {
  return !!SpeechRecognition;
}

export function createRecognizer({ continuous = false, onText, onError, onEnd }) {
  if (!SpeechRecognition) return null;

  const recognizer = new SpeechRecognition();
  const langConfig = LANGS[state.lang] || LANGS.en;
  recognizer.lang = langConfig.sp;
  recognizer.interimResults = true;
  recognizer.continuous = !!continuous;

  recognizer.onresult = (event) => {
    let finalTranscript = '';
    let interimTranscript = '';

    for (let i = event.resultIndex; i < event.results.length; i++) {
      const res = event.results[i];
      const text = res[0].transcript;
      if (res.isFinal) {
        finalTranscript += text;
      } else {
        interimTranscript += text;
      }
    }

    if (onText) onText(finalTranscript, interimTranscript);
  };

  recognizer.onerror = (event) => {
    if (onError) onError(event.error);
  };

  recognizer.onend = () => {
    if (onEnd) onEnd();
  };

  return recognizer;
}

export function micErrorMessage(code) {
  if (code === 'not-allowed' || code === 'service-not-allowed') {
    return 'The microphone is blocked. Please allow microphone access in your browser settings.';
  }
  if (code === 'no-speech') {
    return 'No speech was detected. Please try speaking again.';
  }
  return `Speech input error (${code}).`;
}
