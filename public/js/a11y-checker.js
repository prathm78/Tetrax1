// WCAG 2.2 AA Automated Accessibility Checker & Auto-Fixer Module

export function parseColor(s) {
  if (!s) return null;
  s = s.trim().toLowerCase();
  const NAMES = {
    white: '#ffffff', black: '#000000', gray: '#808080', grey: '#808080',
    red: '#ff0000', blue: '#0000ff', green: '#008000', yellow: '#ffff00',
    silver: '#c0c0c0', navy: '#000080', teal: '#008080', purple: '#800080'
  };
  if (NAMES[s]) s = NAMES[s];

  let m = s.match(/^#([0-9a-f]{3})$/);
  if (m) {
    const h = m[1];
    return [parseInt(h[0] + h[0], 16), parseInt(h[1] + h[1], 16), parseInt(h[2] + h[2], 16)];
  }

  m = s.match(/^#([0-9a-f]{6})$/);
  if (m) {
    return [parseInt(m[1].slice(0, 2), 16), parseInt(m[1].slice(2, 4), 16), parseInt(m[1].slice(4, 6), 16)];
  }

  m = s.match(/^rgb\(\s*(\d+)[ ,]+(\d+)[ ,]+(\d+)/);
  if (m) {
    return [+m[1], +m[2], +m[3]];
  }

  return null;
}

export function relativeLuminance(rgb) {
  const a = rgb.map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
}

export function contrastRatio(rgb1, rgb2) {
  const l1 = relativeLuminance(rgb1);
  const l2 = relativeLuminance(rgb2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function getStyleProp(styleStr, prop) {
  const m = (styleStr || '').match(new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+)`, 'i'));
  return m ? m[1].trim() : null;
}

/**
 * Checks an HTML document string against WCAG 2.2 AA rules
 */
export function checkHTML(html, domParserInstance = null) {
  const Parser = domParserInstance || (typeof DOMParser !== 'undefined' ? new DOMParser() : null);
  if (!Parser) {
    throw new Error('DOMParser is not available.');
  }

  const doc = Parser.parseFromString(html, 'text/html');
  const issues = [];

  function addIssue(sev, title, ref, why = '', fix = '') {
    issues.push({ sev, title, ref, why, fix });
  }

  // 1. Missing lang
  const root = doc.documentElement;
  if (!root.getAttribute('lang') || !root.getAttribute('lang').trim()) {
    addIssue(
      's',
      'The page language is not set',
      'WCAG 3.1.1',
      'Screen readers cannot pick the correct pronunciation or voice without language tagging.',
      'Add lang="en" (or your language code) to the <html> tag.'
    );
  }

  // 2. Missing title
  if (!doc.title || !doc.title.trim()) {
    addIssue(
      'm',
      'The page has no title',
      'WCAG 2.4.2',
      'Users navigating tabs or screen readers cannot identify the page purpose.',
      'Add a descriptive <title> tag inside <head>.'
    );
  }

  // 3. Zooming disabled (viewport meta)
  const vp = doc.querySelector('meta[name="viewport"]');
  if (vp) {
    const content = vp.getAttribute('content') || '';
    if (/user-scalable\s*=\s*(no|0)|maximum-scale\s*=\s*1(\.0)?\b/i.test(content)) {
      addIssue(
        's',
        'Zooming is disabled, which blocks low-vision users',
        'WCAG 1.4.4',
        'Users with partial sight must be able to zoom pages up to 200% on touch screens.',
        'Remove user-scalable=no and maximum-scale=1 from the meta viewport tag.'
      );
    }
  }

  // 4. Missing landmark elements (<main>, <header>, or <nav>)
  if (!doc.querySelector('main, [role="main"]')) {
    addIssue(
      'm',
      'No <main> landmark found',
      'WCAG 1.3.1',
      'Keyboard and screen reader users cannot quickly jump to the primary content.',
      'Wrap the primary content in a <main> element.'
    );
  }

  // 5. Images without alt
  const images = Array.from(doc.querySelectorAll('img'));
  images.forEach((img) => {
    if (!img.hasAttribute('alt')) {
      const src = img.getAttribute('src') || '(no source)';
      addIssue(
        'c',
        `Image has no alt text: ${src}`,
        'WCAG 1.1.1',
        'Blind and low-vision users cannot understand what the image represents.',
        'Add an alt="" attribute with a short description, or alt="" if purely decorative.'
      );
    }
  });

  // 6. Form inputs without labels
  const inputs = Array.from(doc.querySelectorAll('input, select, textarea'));
  inputs.forEach((input) => {
    const type = (input.getAttribute('type') || '').toLowerCase();
    if (type === 'hidden' || type === 'submit' || type === 'button' || type === 'reset') return;

    const id = input.id;
    const hasLabel =
      input.getAttribute('aria-label') ||
      input.getAttribute('aria-labelledby') ||
      input.getAttribute('title') ||
      (id && doc.querySelector(`label[for="${id}"]`)) ||
      input.closest('label');

    if (!hasLabel) {
      const ph = input.getAttribute('placeholder');
      addIssue(
        'c',
        `Form field has no label${ph ? ` (only a placeholder: "${ph}")` : ''}`,
        'WCAG 3.3.2',
        'Placeholders disappear when typing and are often unannounced by screen readers.',
        'Add an explicit <label for="..."> or an aria-label attribute.'
      );
    }
  });

  // 7. Buttons & Links without accessible names, or ambiguous links
  const interactives = Array.from(doc.querySelectorAll('button, a[href]'));
  interactives.forEach((el) => {
    const text = (el.textContent || '').trim();
    const hasName =
      el.getAttribute('aria-label') ||
      el.getAttribute('aria-labelledby') ||
      el.getAttribute('title') ||
      el.querySelector('img[alt]:not([alt=""])');

    if (!text && !hasName) {
      const isLink = el.tagName === 'A';
      addIssue(
        'c',
        `${isLink ? 'Link' : 'Button'} has no accessible name`,
        'WCAG 4.1.2',
        'Screen readers announce an empty button or link, giving no cue on what it does.',
        'Add descriptive text inside the element or provide aria-label.'
      );
    } else if (/^(click here|here|read more|more|link)$/i.test(text)) {
      addIssue(
        'm',
        `Link text "${text}" does not say where it goes out of context`,
        'WCAG 2.4.4',
        'Screen reader users browsing links out of context cannot tell where "click here" leads.',
        'Replace with specific destination text, e.g. "Pay your electricity bill".'
      );
    }
  });

  // 8. Heading hierarchy jumps
  let lastLevel = 0;
  const headings = Array.from(doc.querySelectorAll('h1, h2, h3, h4, h5, h6'));
  headings.forEach((h) => {
    const level = parseInt(h.tagName[1], 10);
    if (lastLevel > 0 && level > lastLevel + 1) {
      addIssue(
        'm',
        `Heading level jumps from <h${lastLevel}> to <h${level}>`,
        'WCAG 1.3.1',
        'Skipping heading levels confuses navigation for users who browse by document outline.',
        `Change <h${level}> to <h${lastLevel + 1}> or add intermediate headings.`
      );
    }
    lastLevel = level;
  });

  // 9. Positive tabindex
  const indexed = Array.from(doc.querySelectorAll('[tabindex]'));
  indexed.forEach((el) => {
    const tabIdx = parseInt(el.getAttribute('tabindex') || '0', 10);
    if (tabIdx > 0) {
      addIssue(
        'm',
        'Positive tabindex breaks natural keyboard tab order',
        'WCAG 2.4.3',
        'Positive tabindex disrupts the logical reading order for keyboard users.',
        'Use tabindex="0" to make an element focusable, or tabindex="-1" to remove it.'
      );
    }
  });

  // 10. Duplicate IDs
  const idElements = Array.from(doc.querySelectorAll('[id]'));
  const seenIds = new Set();
  const dupIds = new Set();
  idElements.forEach((el) => {
    const id = el.id.trim();
    if (id) {
      if (seenIds.has(id)) {
        dupIds.add(id);
      } else {
        seenIds.add(id);
      }
    }
  });
  dupIds.forEach((dupId) => {
    addIssue(
      's',
      `Duplicate ID "${dupId}" found in document`,
      'WCAG 4.1.1',
      'Duplicate IDs cause form labels and aria-describedby references to fail unpredictably.',
      `Ensure id="${dupId}" is unique throughout the page.`
    );
  });

  // 11. Low contrast inline styles
  const styled = Array.from(doc.querySelectorAll('[style]'));
  styled.forEach((el) => {
    const st = el.getAttribute('style');
    const fg = parseColor(getStyleProp(st, 'color'));
    const bg = parseColor(getStyleProp(st, 'background-color') || getStyleProp(st, 'background'));
    if (fg && bg) {
      const r = contrastRatio(fg, bg);
      if (r < 4.5) {
        addIssue(
          's',
          `Low text contrast (${r.toFixed(1)}:1, needs at least 4.5:1)`,
          'WCAG 1.4.3',
          'Users with low vision or in bright lighting cannot read low-contrast text.',
          'Darken the text color or lighten the background color to achieve 4.5:1 ratio.'
        );
      }
    }
  });

  // Penalties: Critical: 14, Serious: 8, Moderate: 4
  const penalties = { c: 14, s: 8, m: 4 };
  let score = 100;
  issues.forEach((i) => {
    score -= penalties[i.sev] || 4;
  });

  return {
    issues,
    score: Math.max(0, Math.min(100, score))
  };
}

/**
 * Deterministically fixes WCAG 2.2 AA problems in HTML
 */
export function autoFix(html, domParserInstance = null) {
  const Parser = domParserInstance || (typeof DOMParser !== 'undefined' ? new DOMParser() : null);
  if (!Parser) {
    throw new Error('DOMParser is not available.');
  }

  const doc = Parser.parseFromString(html, 'text/html');

  // Fix lang
  if (!doc.documentElement.getAttribute('lang')) {
    doc.documentElement.setAttribute('lang', 'en');
  }

  // Fix title
  if (!doc.title || !doc.title.trim()) {
    let t = doc.querySelector('title');
    if (!t) {
      t = doc.createElement('title');
      doc.head.appendChild(t);
    }
    const h1 = doc.querySelector('h1');
    t.textContent = h1 ? h1.textContent.trim() : 'Accessible Web Page';
  }

  // Fix viewport
  let vp = doc.querySelector('meta[name="viewport"]');
  if (!vp) {
    vp = doc.createElement('meta');
    vp.setAttribute('name', 'viewport');
    doc.head.appendChild(vp);
  }
  vp.setAttribute('content', 'width=device-width, initial-scale=1');

  // Fix missing landmarks
  if (!doc.querySelector('main')) {
    const body = doc.body;
    const main = doc.createElement('main');
    while (body.firstChild) {
      main.appendChild(body.firstChild);
    }
    body.appendChild(main);
  }

  // Fix image alt
  Array.from(doc.querySelectorAll('img')).forEach((img) => {
    if (!img.hasAttribute('alt')) {
      const src = (img.getAttribute('src') || '').split('/').pop() || 'illustration';
      img.setAttribute('alt', `Image: ${src}`);
    }
  });

  // Fix inputs without label
  Array.from(doc.querySelectorAll('input, select, textarea')).forEach((input) => {
    const type = (input.getAttribute('type') || '').toLowerCase();
    if (type === 'hidden' || type === 'submit' || type === 'button') return;

    const id = input.id;
    const hasLabel =
      input.getAttribute('aria-label') ||
      input.getAttribute('aria-labelledby') ||
      (id && doc.querySelector(`label[for="${id}"]`)) ||
      input.closest('label');

    if (!hasLabel) {
      const ph = input.getAttribute('placeholder');
      input.setAttribute('aria-label', ph || 'Input field');
    }
  });

  // Fix buttons & links
  Array.from(doc.querySelectorAll('button, a[href]')).forEach((el) => {
    const text = (el.textContent || '').trim();
    if (!text && !el.getAttribute('aria-label')) {
      el.setAttribute('aria-label', el.tagName === 'A' ? 'Navigation link' : 'Action button');
    }
    if (/^(click here|here)$/i.test(text)) {
      el.textContent = 'Go to destination page';
    }
  });

  // Fix positive tabindex
  Array.from(doc.querySelectorAll('[tabindex]')).forEach((el) => {
    if (parseInt(el.getAttribute('tabindex') || '0', 10) > 0) {
      el.setAttribute('tabindex', '0');
    }
  });

  // Fix low-contrast inline colors
  Array.from(doc.querySelectorAll('[style]')).forEach((el) => {
    let st = el.getAttribute('style') || '';
    const fg = parseColor(getStyleProp(st, 'color'));
    const bg = parseColor(getStyleProp(st, 'background-color') || getStyleProp(st, 'background'));
    if (fg && bg && contrastRatio(fg, bg) < 4.5) {
      st = st.replace(/(^|;)\s*color\s*:[^;]+/i, '$1color: #111111');
      st = st.replace(/(^|;)\s*background-color\s*:[^;]+/i, '$1background-color: #ffffff');
      el.setAttribute('style', st);
    }
  });

  return '<!DOCTYPE html>\n' + doc.documentElement.outerHTML;
}
