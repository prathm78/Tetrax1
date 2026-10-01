// Website Accessibility Checker Tab Controller
import { $, el, btn, copyText, saveFile, toast } from '../ui.js';
import { checkHTML, autoFix } from '../a11y-checker.js';
import { aiState, setStat, getAiErrorMessage } from '../ai.js';

const EX_HTML = `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, user-scalable=no">
</head>
<body>
  <h1>City Services</h1>
  <h3>Pay your bill</h3>
  <img src="bill.png">
  <input placeholder="Account number">
  <a href="/pay">click here</a>
  <button style="color:#999999;background:#aaaaaa"></button>
  <p style="color:#aaaaaa;background:#ffffff">Late fee applies after 5 October.</p>
</body>
</html>`;

let lastCheckedHtml = '';
let lastCheckedScore = 0;
let webAbortController = null;

export function initWebcheckTab() {
  const webIn = $('#webIn');
  const webEx = $('#webEx');
  const webGo = $('#webGo');
  const webUrlInput = $('#webUrl');
  const webFetchBtn = $('#webFetch');

  if (webEx) {
    webEx.addEventListener('click', () => {
      if (webIn) webIn.value = EX_HTML;
      toast('Example HTML snippet loaded');
    });
  }

  if (webFetchBtn && webUrlInput) {
    webFetchBtn.addEventListener('click', async () => {
      const url = webUrlInput.value.trim();
      if (!url) {
        toast('Please enter a website URL');
        return;
      }
      try {
        new URL(url);
      } catch (_) {
        toast('Please enter a valid URL including http:// or https://');
        return;
      }

      webFetchBtn.disabled = true;
      webFetchBtn.textContent = 'Fetching…';

      try {
        const res = await fetch('/api/fetch-page', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url })
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.message || data.error || 'Fetch failed');
        }
        const data = await res.json();
        if (webIn) webIn.value = data.html;
        toast('Page HTML fetched successfully! Click "Check page" to audit.');
      } catch (err) {
        toast(`Could not fetch URL: ${err.message}`);
      } finally {
        webFetchBtn.disabled = false;
        webFetchBtn.textContent = 'Fetch Page';
      }
    });
  }

  if (webGo) {
    webGo.addEventListener('click', () => {
      const html = (webIn?.value || '').trim();
      if (!html) {
        toast('Paste HTML code or fetch a URL first');
        return;
      }
      runAudit(html);
    });
  }
}

function runAudit(html) {
  const out = $('#webOut');
  out.innerHTML = '';
  lastCheckedHtml = html;

  const result = checkHTML(html);
  lastCheckedScore = result.score;

  renderScoreRing(out, 'Accessibility Audit Results', result);

  const actionRow = el('div', 'crow');
  actionRow.style.marginTop = '18px';

  const isLiveAi = aiState === 'on';
  const fixBtn = btn(isLiveAi ? 'Fix with AI' : 'Fix automatically', 'i-wand', 'gold');
  actionRow.appendChild(fixBtn);
  out.appendChild(actionRow);

  const fixContainer = el('div', 'res');
  out.appendChild(fixContainer);

  fixBtn.addEventListener('click', () => {
    executeFix(fixContainer, isLiveAi);
  });
}

function renderScoreRing(container, headingText, res) {
  const card = el('div', 'rc');
  card.appendChild(el('h3', '', headingText));

  const ringWrapper = el('div', 'ringw');
  const ringEl = el('div', 'ring');
  ringEl.innerHTML = `
    <svg viewBox="0 0 120 120" aria-hidden="true">
      <circle class="a" cx="60" cy="60" r="52"/>
      <circle class="b" cx="60" cy="60" r="52" stroke-dasharray="326.7" stroke-dashoffset="326.7"/>
    </svg>
    <b>${res.score}</b>
  `;
  ringEl.setAttribute('role', 'img');
  ringEl.setAttribute('aria-label', `Accessibility score: ${res.score} out of 100`);
  ringWrapper.appendChild(ringEl);

  const verdict = el('div');
  const ratingH4 = el(
    'h4',
    '',
    res.score >= 90
      ? 'Passes standard automated checks'
      : res.score >= 60
      ? 'Needs some accessibility fixes'
      : 'Severe accessibility barriers found'
  );
  ratingH4.style.fontSize = '1.3rem';
  verdict.appendChild(ratingH4);

  const issueCountP = el(
    'p',
    'hint',
    res.issues.length ? `${res.issues.length} issue${res.issues.length > 1 ? 's' : ''} detected` : 'No automated barriers detected!'
  );
  verdict.appendChild(issueCountP);
  ringWrapper.appendChild(verdict);
  card.appendChild(ringWrapper);

  // Animate ring circle progress
  setTimeout(() => {
    const circle = ringEl.querySelector('.b');
    if (circle) {
      const offset = (326.7 * (1 - res.score / 100)).toFixed(1);
      circle.setAttribute('stroke-dashoffset', offset);
    }
  }, 60);

  // Issues detail list
  const sevLabels = { c: 'Critical', s: 'Serious', m: 'Moderate' };
  res.issues.forEach((iss) => {
    const row = el('div', 'iss');
    const badge = el('span', `tg ${iss.sev}`, sevLabels[iss.sev]);
    row.appendChild(badge);

    const desc = el('div');
    desc.appendChild(el('div', '', iss.title));
    if (iss.why) {
      const whyEl = el('p', 'hint', `Why: ${iss.why}`);
      whyEl.style.marginTop = '4px';
      desc.appendChild(whyEl);
    }
    if (iss.fix) {
      const fixEl = el('p', 'hint', `How to fix: ${iss.fix}`);
      fixEl.style.marginTop = '2px';
      desc.appendChild(fixEl);
    }
    desc.appendChild(el('code', '', iss.ref));
    row.appendChild(desc);
    card.appendChild(row);
  });

  container.appendChild(card);
}

async function executeFix(container, useAi) {
  container.innerHTML = '';

  if (!useAi || aiState === 'demo') {
    const fixedCode = autoFix(lastCheckedHtml);
    renderFixedView(container, fixedCode, true);
    return;
  }

  if (webAbortController) webAbortController.abort();
  webAbortController = new AbortController();

  const thinkCard = el('div', 'rc');
  const th = el('span', 'think');
  th.appendChild(el('span', 'spin'));
  th.appendChild(el('span', '', 'Generating corrected accessible HTML with AI…'));
  thinkCard.appendChild(th);
  container.appendChild(thinkCard);

  const prompt = `Fix every accessibility problem (WCAG 2.2 AA) in this HTML. Keep the same visual layout, design, and content. Add a lang attribute, a title, meaningful alt text, labels for inputs, accessible names for buttons and links, readable colour contrast (at least 4.5:1), landmarks (<main>), and allow zooming. Reply with ONLY the complete corrected HTML document. No explanation, no markdown backticks, no code fence.

HTML to fix:
${lastCheckedHtml.slice(0, 20000)}`;

  try {
    const res = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: webAbortController.signal,
      body: JSON.stringify({
        system: 'You are an expert accessibility engineer. Fix WCAG 2.2 AA issues in the provided HTML. Output ONLY raw HTML.',
        messages: [{ role: 'user', content: prompt }],
        tier: 'default',
        stream: false
      })
    });

    if (!res.ok) {
      throw new Error('AI request failed');
    }

    const data = await res.json();
    let fixedHtml = (data.text || '').trim();
    fixedHtml = fixedHtml.replace(/^```(?:html)?\s*/i, '').replace(/```\s*$/, '').trim();

    container.innerHTML = '';
    renderFixedView(container, fixedHtml, false);
  } catch (err) {
    container.innerHTML = '';
    if (err.name === 'AbortError') return;

    console.warn('[WebCheck] AI fix failed, falling back to autoFix:', err);
    setStat('demo');
    const fixedCode = autoFix(lastCheckedHtml);
    renderFixedView(container, fixedCode, true);
  } finally {
    webAbortController = null;
  }
}

function renderFixedView(container, fixedHtml, isDeterministic) {
  const reAudit = checkHTML(fixedHtml);

  if (isDeterministic) {
    const notice = el('div', 'rc warn');
    notice.appendChild(el('p', '', 'Fixed automatically using deterministic rules. (Connect GEMINI_API_KEY for full AI code synthesis)'));
    container.appendChild(notice);
  }

  renderScoreRing(container, 'Score After Fixes (Re-evaluated)', reAudit);

  const codeCard = el('div', 'rc');
  codeCard.appendChild(el('h3', '', 'Corrected Accessible HTML'));
  const pre = el('pre', 'code');
  pre.textContent = fixedHtml;
  pre.tabIndex = 0;
  pre.setAttribute('aria-label', 'Corrected accessible HTML code');
  codeCard.appendChild(pre);

  const toolbar = el('div', 'rtb');
  toolbar.style.marginTop = '12px';

  const copyCodeBtn = btn('Copy code', 'i-copy');
  copyCodeBtn.addEventListener('click', () => copyText(fixedHtml));

  const downloadBtn = btn('Download .html', 'i-down');
  downloadBtn.addEventListener('click', () => saveFile('accessible-page.html', fixedHtml, 'text/html;charset=utf-8'));

  toolbar.appendChild(copyCodeBtn);
  toolbar.appendChild(downloadBtn);
  codeCard.appendChild(toolbar);

  if (reAudit.score > lastCheckedScore) {
    codeCard.appendChild(el('p', 'note', `Score successfully improved from ${lastCheckedScore} to ${reAudit.score}!`));
  }

  container.appendChild(codeCard);
}
