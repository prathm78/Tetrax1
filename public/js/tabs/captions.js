// Live Captions Tab Controller
import { $, el, copyText, saveFile, toast } from '../ui.js';
import { createRecognizer, isSpeechRecognitionSupported, micErrorMessage } from '../speech.js';

let capRecognizer = null;
let capFinalText = '';
let capSampleTimer = null;

export function initCaptionsTab() {
  const capBox = $('#capBox');
  const capGoBtn = $('#capGo');
  const capSampleBtn = $('#capSample');
  const capClearBtn = $('#capClear');
  const capCopyBtn = $('#capCopy');
  const capSaveBtn = $('#capSave');
  const capNote = $('#capNote');

  function renderCaptions(interim = '') {
    capBox.textContent = capFinalText;
    if (interim) {
      const interimSpan = el('span', 'im', interim);
      capBox.appendChild(interimSpan);
    }
    capBox.scrollTop = 1e9;
  }

  capGoBtn.addEventListener('click', () => {
    const btnLabel = capGoBtn.querySelector('span');

    if (capRecognizer) {
      capRecognizer._keepRunning = false;
      capRecognizer.stop();
      capRecognizer = null;
      if (btnLabel) btnLabel.textContent = 'Start captions';
      return;
    }

    if (!isSpeechRecognitionSupported()) {
      if (capNote) {
        capNote.textContent = 'Speech recognition is not supported in this browser. Try Chrome or Edge, or press “Play sample captions”.';
      }
      toast('Speech recognition not supported in this browser.');
      return;
    }

    clearInterval(capSampleTimer);
    if (capNote) capNote.textContent = 'Listening to microphone… Speak clearly.';

    capRecognizer = createRecognizer({
      continuous: true,
      onText: (finalChunk, interimChunk) => {
        if (finalChunk) {
          capFinalText += (capFinalText ? ' ' : '') + finalChunk.trim();
        }
        renderCaptions(interimChunk);
      },
      onError: (errCode) => {
        if (capNote) {
          capNote.textContent = micErrorMessage(errCode) + ' You can still press “Play sample captions”.';
        }
      },
      onEnd: () => {
        if (capRecognizer && capRecognizer._keepRunning) {
          try {
            capRecognizer.start();
            return;
          } catch (_) {}
        }
        capRecognizer = null;
        if (btnLabel) btnLabel.textContent = 'Start captions';
      }
    });

    capRecognizer._keepRunning = true;
    try {
      capRecognizer.start();
      if (btnLabel) btnLabel.textContent = 'Stop captions';
    } catch (err) {
      capRecognizer = null;
      if (capNote) capNote.textContent = 'Could not start microphone.';
    }
  });

  capSampleBtn.addEventListener('click', () => {
    if (capRecognizer) {
      capRecognizer._keepRunning = false;
      capRecognizer.stop();
      capRecognizer = null;
      const btnLabel = capGoBtn.querySelector('span');
      if (btnLabel) btnLabel.textContent = 'Start captions';
    }

    clearInterval(capSampleTimer);
    capFinalText = '';
    renderCaptions('');

    const sampleWords = ('Good morning, everyone. Today we are learning how plants produce food through photosynthesis. Please open your books to page twenty-four. आज हम सीखेंगे कि पौधे सूर्य के प्रकाश से अपना भोजन कैसे बनाते हैं। सर्वांना नमस्कार, आज आपण विज्ञानाचा नवीन पाठ शिकणार आहोत.').split(' ');
    let wordIndex = 0;

    capSampleTimer = setInterval(() => {
      if (wordIndex >= sampleWords.length) {
        clearInterval(capSampleTimer);
        return;
      }
      capFinalText += (capFinalText ? ' ' : '') + sampleWords[wordIndex++];
      renderCaptions('');
    }, 240);

    if (capNote) capNote.textContent = 'Playing a sample speech stream so you can see how captions appear in real-time.';
  });

  capClearBtn.addEventListener('click', () => {
    clearInterval(capSampleTimer);
    capFinalText = '';
    renderCaptions('');
  });

  capCopyBtn.addEventListener('click', () => {
    if (!capFinalText) {
      toast('No captions to copy yet');
      return;
    }
    copyText(capFinalText);
  });

  capSaveBtn.addEventListener('click', () => {
    if (!capFinalText) {
      toast('No captions to save yet');
      return;
    }
    saveFile('captions.txt', capFinalText, 'text/plain;charset=utf-8');
  });
}
