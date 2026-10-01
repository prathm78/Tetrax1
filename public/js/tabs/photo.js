// Describe a Photo Tab Controller
import { state } from '../state.js';
import { LANGS } from '../i18n.js';
import { $, el, btn, copyText, toast } from '../ui.js';
import { speak } from '../speech.js';
import { buildSystemPrompt, callAiJson, getAiErrorMessage, setStat } from '../ai.js';

let photoBlob = null;
let photoAbortController = null;

export function initPhotoTab() {
  const fileInput = $('#phFile');
  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      toast('Photo is too large. Please select an image under 15MB.');
      fileInput.value = '';
      return;
    }

    photoBlob = file;
    previewPhoto(file, 'Selected photo preview');
  });

  $('#phEx').addEventListener('click', async () => {
    try {
      const blob = await generateSamplePhotoBlob();
      photoBlob = blob;
      previewPhoto(blob, 'Sample photo: roadside fruit stall with price tag');
      toast('Sample fruit stall photo loaded');
    } catch (err) {
      console.error('[Photo] Sample generation failed:', err);
    }
  });

  // Drag and drop onto #phDrop
  const dropZone = $('#phDrop');
  if (dropZone) {
    ['dragenter', 'dragover'].forEach((eventName) => {
      dropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        dropZone.style.borderColor = 'var(--ink)';
      });
    });

    ['dragleave', 'drop'].forEach((eventName) => {
      dropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        dropZone.style.borderColor = 'var(--line)';
      });
    });

    dropZone.addEventListener('drop', (e) => {
      const dt = e.dataTransfer;
      const file = dt?.files?.[0];
      if (file && file.type.startsWith('image/')) {
        photoBlob = file;
        previewPhoto(file, 'Dropped photo preview');
      }
    });
  }

  $('#phGo').addEventListener('click', handlePhotoSubmit);
}

function previewPhoto(blob, altText) {
  const dropBox = $('#phDrop');
  dropBox.innerHTML = '';
  const img = document.createElement('img');
  img.alt = altText;
  img.src = URL.createObjectURL(blob);
  dropBox.appendChild(img);
}

function generateSamplePhotoBlob() {
  return new Promise((resolve) => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="520" viewBox="0 0 800 520">
      <rect width="800" height="520" fill="#EDF1F7"/>
      <rect y="360" width="800" height="160" fill="#C9D3E3"/>
      <path d="M110 120h480l50 80H60z" fill="#FFB020"/>
      <rect x="130" y="200" width="12" height="170" fill="#0B1226"/>
      <rect x="560" y="200" width="12" height="170" fill="#0B1226"/>
      <rect x="150" y="250" width="400" height="110" rx="8" fill="#ffffff" stroke="#0B1226" stroke-width="4"/>
      <circle cx="215" cy="305" r="26" fill="#F59E0B"/>
      <circle cx="285" cy="308" r="26" fill="#16A34A"/>
      <circle cx="355" cy="305" r="26" fill="#DC2626"/>
      <circle cx="425" cy="308" r="26" fill="#F59E0B"/>
      <rect x="470" y="262" width="66" height="44" rx="4" fill="#F6F8FB" stroke="#0B1226" stroke-width="3"/>
      <text x="503" y="291" font-family="sans-serif" font-size="18" font-weight="700" text-anchor="middle" fill="#0B1226">Rs 40</text>
      <circle cx="690" cy="215" r="34" fill="#0B1226"/>
      <path d="M640 400V300a50 50 0 0 1 100 0v100z" fill="#0B1226"/>
    </svg>`;

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 800;
      canvas.height = 520;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      canvas.toBlob((blob) => resolve(blob), 'image/png');
    };
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  });
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

function photoDemoResult() {
  return {
    description: 'A roadside fruit stall under a yellow canopy. Oranges, green limes, and red apples sit arranged on a white display table next to a small price sign. A vendor stands quietly on the right side.',
    text: 'Rs 40',
    alt: 'Fruit stall with oranges, limes, apples, and a vendor next to a Rs 40 sign.',
    note: 'Demo mode: this is a built-in sample description.'
  };
}

function renderPhotoResult(data, isDemo = false) {
  const out = $('#phOut');
  out.innerHTML = '';

  if (isDemo) {
    const demoCard = el('div', 'rc warn');
    demoCard.appendChild(el('p', '', 'Demo mode: this is a sample description of the fruit stall. Add your GEMINI_API_KEY in .env and restart to describe live photos.'));
    out.appendChild(demoCard);
  }

  // Description
  const descCard = el('div', 'rc big');
  descCard.appendChild(el('h3', '', 'Description'));
  descCard.appendChild(el('p', '', data.description || ''));
  out.appendChild(descCard);

  // Text in photo
  const textCard = el('div', 'rc');
  textCard.appendChild(el('h3', '', 'Text in the photo'));
  textCard.appendChild(el('p', '', data.text && data.text.trim() ? data.text : 'No readable text found in the image.'));
  out.appendChild(textCard);

  // Alt text
  const altCard = el('div', 'rc');
  altCard.appendChild(el('h3', '', 'Alt text for a website (max 125 characters)'));
  altCard.appendChild(el('p', '', data.alt || ''));
  const copyAltBtn = btn('Copy alt text', 'i-copy');
  copyAltBtn.style.marginTop = '10px';
  copyAltBtn.addEventListener('click', () => copyText(data.alt || ''));
  altCard.appendChild(copyAltBtn);
  out.appendChild(altCard);

  // Note
  if (data.note && (!isDemo || data.note !== 'Demo mode: this is a built-in sample description.')) {
    const noteCard = el('div', 'rc');
    noteCard.appendChild(el('h3', '', 'Worth knowing'));
    noteCard.appendChild(el('p', '', data.note));
    out.appendChild(noteCard);
  }

  // Toolbar
  const textToRead = [
    data.description || '',
    data.text ? `Text in the photo: ${data.text}` : ''
  ].filter(Boolean).join('. ');

  const tb = el('div', 'rtb');
  const readBtn = btn('Read aloud', 'i-vol');
  readBtn.addEventListener('click', () => speak(textToRead, readBtn));
  const copyAllBtn = btn('Copy all', 'i-copy');
  copyAllBtn.addEventListener('click', () => copyText(textToRead));

  tb.appendChild(readBtn);
  tb.appendChild(copyAllBtn);
  out.appendChild(tb);

  if (state.auto) {
    speak(textToRead, readBtn);
  }
}

async function handlePhotoSubmit() {
  if (!photoBlob) {
    toast('Choose a photo or use the sample first');
    return;
  }

  const out = $('#phOut');
  out.innerHTML = '';

  if (photoAbortController) photoAbortController.abort();
  photoAbortController = new AbortController();
  const signal = photoAbortController.signal;

  const thinkCard = el('div', 'rc');
  const th = el('span', 'think');
  th.appendChild(el('span', 'spin'));
  th.appendChild(el('span', '', 'Looking at your photo…'));
  thinkCard.appendChild(th);
  const stopBtn = btn('Stop', 'i-stop');
  stopBtn.style.marginLeft = '14px';
  stopBtn.addEventListener('click', () => photoAbortController.abort());
  thinkCard.appendChild(stopBtn);
  out.appendChild(thinkCard);

  const langConfig = LANGS[state.lang] || LANGS.en;
  const prompt = `${buildSystemPrompt()}

Task: Describe the attached photo for a person who cannot see it. Reply with ONLY a JSON object, all text in ${langConfig.n}:
{
  "description": "clear description in 2-4 sentences: who or what, where, colours, and what is happening",
  "text": "any readable text in the photo, exactly as written, or empty string",
  "alt": "alt text of at most 125 characters",
  "note": "one short line only if something important or unsafe is visible, else empty string"
}`;

  try {
    const base64Data = await fileToBase64(photoBlob);
    const data = await callAiJson({
      system: buildSystemPrompt(),
      messages: [{ role: 'user', content: prompt }],
      image: {
        mime: photoBlob.type || 'image/jpeg',
        data: base64Data
      },
      tier: 'default',
      signal
    });
    renderPhotoResult(data, false);
  } catch (err) {
    if (err.name === 'AbortError' || err.code === 'cancelled') {
      out.innerHTML = '';
      return;
    }
    if (err.code === 'demo_mode' || err.code === 'key_missing') {
      setStat('demo');
      renderPhotoResult(photoDemoResult(), true);
      return;
    }
    out.innerHTML = '';
    const errCard = el('div', 'rc warn');
    errCard.appendChild(el('p', '', getAiErrorMessage(err.code)));
    out.appendChild(errCard);
  } finally {
    photoAbortController = null;
  }
}
