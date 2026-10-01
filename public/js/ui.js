// DOM & UI Utility Functions

export function $(selector, context = document) {
  return context.querySelector(selector);
}

export function $$(selector, context = document) {
  return Array.from(context.querySelectorAll(selector));
}

let toastTimer = null;
export function toast(message) {
  const toastEl = $('#toast');
  if (!toastEl) return;
  toastEl.textContent = message;
  toastEl.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastEl.classList.remove('on');
  }, 3000);
}

export function el(tag, className = '', textContent) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (textContent !== undefined) node.textContent = textContent;
  return node;
}

export function ico(id) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'i');
  svg.setAttribute('aria-hidden', 'true');
  const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
  use.setAttribute('href', '#' + id);
  svg.appendChild(use);
  return svg;
}

export function btn(label, icon, className = '') {
  const button = el('button', 'btn sm ' + className);
  button.type = 'button';
  if (icon) button.appendChild(ico(icon));
  button.appendChild(el('span', '', label));
  return button;
}

export async function copyText(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      toast('Copied to clipboard');
      return true;
    } catch (_) {}
  }
  // Fallback
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    toast('Copied to clipboard');
    return true;
  } catch (err) {
    toast('Copy is not supported. Please select the text manually.');
    return false;
  }
}

export function saveFile(filename, content, mime = 'text/plain;charset=utf-8') {
  try {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast(`Saved ${filename}`);
  } catch (err) {
    console.error('[SaveFile] Error saving:', err);
    toast('Could not download file. You can copy the content instead.');
  }
}
