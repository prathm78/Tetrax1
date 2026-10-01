# SAMAVESH AI: MEGA PROMPT (Replit Agent / Google Antigravity)

> **Before you paste:** upload `index.html` and `server.js` (from the `samavesh` folder) into the project as `reference/index.html` and `reference/server.js`. The agent must use them as the visual and behavioural source of truth.
>
> **API key:** do NOT put it in the prompt.
> - Replit: Tools > Secrets > add `GEMINI_API_KEY`.
> - Antigravity: create a `.env` file with `GEMINI_API_KEY=...` and add `.env` to `.gitignore`.

---

## PASTE EVERYTHING BELOW THIS LINE

You are a senior full-stack engineer and accessibility specialist. Build a production-grade website called **Samavesh AI** with the tagline **"AI that works the way you do."** It is an AI assistant built so that everyone can use AI: people with disabilities, people with low literacy, and people who do not speak English.

A reference implementation exists at `reference/index.html` (single-file frontend) and `reference/server.js` (tiny backend). **Rebuild it as a proper, clean, maintainable, deployable project with the SAME look, SAME features, SAME copy and SAME behaviour.** Open the reference first and match it pixel-for-pixel in layout, colours, typography, spacing and content. Improve code quality, structure, security and performance, but do not redesign it.

## 1. Tech stack

- Backend: Node.js 20+, Express, `helmet`, `express-rate-limit`, `compression`, `dotenv`, `zod` for request validation.
- Frontend: keep it framework-free (vanilla HTML, CSS, ES modules) served by Express from `/public`, split into clean files (see structure). No build step required. No React.
- AI provider: **Google Gemini API** via plain `fetch` to `https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent`, header `x-goog-api-key`. No SDK needed.
- Models from env: `MODEL_QUICK` (default `gemini-2.5-flash`) and `MODEL_DEFAULT` (default `gemini-2.5-flash`). If a model name returns 404, log a clear message telling me to update the env var.
- Secrets only from `process.env.GEMINI_API_KEY`. The key must NEVER appear in frontend code, logs, error responses or git.
- Must run on Replit (`PORT` from env, bind `0.0.0.0`) and locally with `npm start`.

## 2. Project structure

```
/
  server.js                 (entry: app setup only)
  src/
    config.js               (env + validation, fail fast if key missing)
    routes/ai.js            (POST /api/ai, GET /api/health)
    services/gemini.js      (all Gemini calls, streaming + non-streaming)
    middleware/security.js  (helmet, CORS, rate limit, body limits)
  public/
    index.html
    css/ (tokens.css, base.css, components.css, themes.css)
    js/  (main.js, state.js, i18n.js, ai.js, speech.js,
          tabs/ask.js, tabs/document.js, tabs/photo.js,
          tabs/captions.js, tabs/webcheck.js, a11y-checker.js, ui.js)
  .env.example
  .gitignore
  README.md
```

## 3. Backend requirements

**`GET /api/health`** returns `{ ok: true, provider: "gemini" }` only if the key exists, else `{ ok: false }`.

**`POST /api/ai`** body (validate with zod):
```
{ system?: string (max 6000), messages: [{role:"user"|"assistant", content:string (max 20000)}] (1-12 items),
  image?: {mime: "image/jpeg"|"image/png"|"image/webp", data: base64 string (max ~15MB)},
  tier?: "quick"|"default", json?: boolean, stream?: boolean }
```
- Map `assistant` to Gemini role `model`. Put `system` in `systemInstruction`. Attach the image as `inlineData` before the text of the last user message.
- If `json: true`, set `generationConfig.responseMimeType = "application/json"`.
- Support **streaming** when `stream: true` using `streamGenerateContent?alt=sse` and forward as Server-Sent Events (`data: {"text": "..."}` chunks, final `data: [DONE]`). Without stream, return `{ text }`.
- Error mapping: Gemini 429 -> 429 `{error:"rate_limited"}`; safety block -> 422 `{error:"refused"}`; other -> 502 `{error:"ai_failed"}`. Never leak upstream bodies to the client; log them server-side only.
- Security: helmet with a CSP that allows only self + Google Fonts (`fonts.googleapis.com`, `fonts.gstatic.com`), `express-rate-limit` (e.g. 30 requests/min per IP on `/api/ai`), JSON body limit 20mb, trust proxy for Replit, request timeout 60s, graceful shutdown, `/api` responses `Cache-Control: no-store`.

## 4. Frontend: pages and features (must all work)

### 4.1 Global layout
- Skip-to-content link, sticky dark top bar (`#050914`, blurred) with logo + "Samavesh" wordmark, nav links (Ask, Documents, Photos, Captions, Web check, Why, How it works), flexible spacer, and an **EN / हिंदी / मराठी** language quick-switch (more languages in settings).
- Hero (dark, dotted radial grid background): H1 "AI that works the way you do.", supporting copy, primary gold CTA, and a live **AI status pill** (`role="status"`): "Checking AI connection…" -> "AI connected / Answers are generated live." or "Demo mode: showing sample answers / AI is not available in this view. All tools still work with built-in samples."
- A **"Make it work for you" settings panel** (collapsible `<details>`, open by default), then a tool area with tabs overlapping the hero bottom.
- Sections below: **Why people use Samavesh** (situation cards the user can click to try), **What is different** (accessible comparison table: How you ask / Language / How long and hard the answer is / How you get the answer / Everyday paperwork / Builders), **How it works** (3 steps: Set it up for you; Speak, type or show; Get it your way), and a footer.

### 4.2 Settings (persist in localStorage with try/catch, "saved on this device only")
1. **My language**: English, Hindi (हिंदी), Marathi (मराठी), Tamil (தமிழ்), Telugu (తెలుగు), Bengali (বাংলা), Gujarati (ગુજરાતી), Kannada (ಕನ್ನಡ). Speech locale codes: en-IN, hi-IN, mr-IN, ta-IN, te-IN, bn-IN, gu-IN, kn-IN. All UI strings (`data-i` keys) must be translated for every language through an `i18n.js` dictionary; fall back to English for missing keys. Set `<html lang>` on change.
2. **Reading level**: Normal / Simple / Very simple.
3. **Read answers aloud automatically** toggle.
4. **Voice speed**: Slow / Normal / Fast.
5. **Text size** slider 100% to 200% (CSS var `--fs` scales `html` font-size).
6. **Theme**: Auto / Light / Dark / Yellow on black (high contrast).
7. **Colour vision**: Normal / Protanopia / Deuteranopia / Tritanopia / Greyscale (SVG colour-matrix filters on the page).
8. **Dyslexia-friendly text**: Lexend font, letter-spacing .035em, line-height 1.9, word-spacing .12em.
9. **Reduce motion** (also respect `prefers-reduced-motion`).
10. **Reset settings** button.

### 4.3 Tool tabs (ARIA tabs pattern: arrow keys, Home/End, roving tabindex)

**Ask anything**: chat log (`role="log"`, `aria-live="polite"`), textarea, **Speak** mic button (Web Speech API recognition in the chosen locale, interim results shown), Send (Ctrl/Cmd+Enter also sends), **Stop** button (AbortController). Keep the last 10 turns. Stream the answer word-by-word. Each answer has a toolbar: **Read aloud** (speechSynthesis in the chosen locale and speed, with stop), **Copy**, **Make it simpler** (re-asks one level simpler). Show a "Thinking…" spinner. Empty state with example questions. On failure show a friendly error and keep the user's text.

**Understand a letter or form**: paste text OR upload a photo/PDF image of the document (JPEG/PNG/WebP, show preview, remove button). Button "Explain this". Backend returns JSON; render as cards: **Summary**, **What it says** (list), **What you need to do** (ordered list), **Deadlines**, **Hard words** (definition list), and a highlighted **Be careful** box if `caution` is non-empty. Include a read-aloud bar for the summary + todo + deadlines.

**Describe a photo**: upload/drag-drop an image (with preview) or "Use a sample photo". Returns JSON `description`, `text` (readable text in photo), `alt` (max 125 chars, with copy button), `note` (safety note). Read-aloud bar.

**Live captions**: Web Speech recognition, continuous, auto-restart on end, final text plus grey interim text, large readable caption box, controls Start/Stop, Clear, Copy, and a "Play sample captions" demo that types out sample text. Clear message if the browser has no speech recognition ("Try Chrome or Edge") and for mic permission errors.

**Check a website for barriers**: input for a pasted HTML snippet (with an "Use example" button) OR a URL (the server fetches it: implement `POST /api/fetch-page` with SSRF protection: only http/https, block private/loopback/link-local IPs after DNS resolve, 5s timeout, 2MB cap). Run a **local WCAG 2.2 AA checker** (no AI needed) in `a11y-checker.js` covering: missing `lang`, missing `<title>`, images without alt, form inputs without labels, buttons/links without accessible names, heading order problems, `user-scalable=no`/`maximum-scale` zoom block, missing landmarks, low-contrast inline colours (compute ratio, fail < 4.5:1), positive tabindex, duplicate ids. Show an animated **score ring (0-100)**, issues grouped by severity with "why it matters" and "how to fix", then a **"Fix with AI"** button that sends the HTML (first 20,000 chars) to the AI and returns the full corrected HTML in a code box with **Copy** and **Download .html**. If AI is unavailable, fall back to a deterministic `autoFix()` function and label it "Fixed automatically".

### 4.4 AI prompts: use these EXACT behaviours

System prompt builder `sys()` (inject language name and reading level):
```
You are Samavesh, an AI assistant built so that everyone can use AI, including people with disabilities, people with low literacy, and people who do not speak English.
Rules:
- Reply in {LANGUAGE}.
- Reading level: {LEVEL}
- Explain any hard word the first time you use it.
- Plain text only. No markdown symbols, no emoji, no tables. For steps, put each on a new line starting with 1., 2., 3.
- Be warm, direct and accurate. If you are not sure, say so.
- For medical, legal or money questions, give clear general information and add one short line to check with a qualified person.
- Keep answers under 150 words unless asked for more.
```
Levels: `Normal: clear and concise.` / `Simple: about a grade 6 reading level. Short sentences. Everyday words.` / `Very simple: about a grade 3 reading level. Very short sentences. One idea per sentence. No hard words.`

Document JSON keys: `summary` (2 sentences max), `says` (3-5 short points), `todo` (ordered actions), `deadlines` (date + consequence), `words` (`[{word, meaning}]`), `caution` (one line or empty string). Text in the user's language at the chosen reading level. Document text capped at 8000 chars.

Photo JSON keys: `description` (2-4 sentences: who/what, where, colours, what is happening), `text`, `alt` (<=125 chars), `note`.

Always parse JSON defensively (strip code fences, extract first `{` to last `}`), validate with a schema, and retry once on invalid JSON.

### 4.5 Demo mode
If `/api/health` is not ok or a call fails with a "dead" error, switch the status pill to **Demo mode** and show realistic built-in sample results (electricity bill letter example, fruit-stall photo example) clearly labelled "This is a sample result". Never show a blank or broken screen.

## 5. Design system (copy from reference)

- Fonts: Schibsted Grotesk (headings), Atkinson Hyperlegible (body), Noto Sans Devanagari (Indian scripts fallback), Lexend (dyslexia mode), JetBrains Mono (code). Always provide system-font fallbacks.
- CSS custom properties in `tokens.css`: paper `#F6F8FB`, surface `#FFFFFF`, sunken `#EDF1F7`, line `#D9E1EC`, ink `#0B1226`, muted `#46536A`, gold `#FFB020`, green `#0B7A6D`, red `#C9263B`, dark navy scale `#050914 / #0A1122 / #10192F / #1B2744`. Define dark mode through `@media (prefers-color-scheme: dark)` guarded with `:root:not([data-theme="light"])` AND `:root[data-theme="dark"]`; Yellow-on-black theme `[data-theme="yellow"]` (#000 background, #FFE600 text and borders).
- Buttons min-height 48px (44px small), 10px radius, 1.5px ink border, gold primary. Focus ring: 3px ink outline + 6px gold halo, never removed.
- Fully responsive down to 320px wide; no horizontal scroll; wide tables scroll inside their own container; respect safe-area insets (`env(safe-area-inset-*)`) and set `viewport-fit=cover`.
- Subtle motion only; everything animated must stop with Reduce motion.

## 6. Accessibility (non-negotiable, WCAG 2.2 AA minimum)
Semantic landmarks, one H1, logical headings, visible focus, full keyboard operation, touch targets >= 44px, colour contrast >= 4.5:1 in every theme, `aria-live` for status, errors and results, `aria-pressed` on toggle buttons, labelled inputs, alt text on all images, icons `aria-hidden`, no information by colour alone, works at 200% zoom and with screen readers (test with the structure, announce results when ready). Add an `/accessibility` statement section in the footer.

## 7. SEO, performance, PWA
Meta title/description, Open Graph + Twitter tags, favicon (emoji or SVG), `theme-color`, canonical, JSON-LD `WebApplication`. Lazy-load below-the-fold images, preconnect to Google Fonts with `font-display: swap`, gzip via compression, long-cache for static assets, `manifest.webmanifest` and a simple service worker that caches the app shell (never cache `/api`). Lighthouse targets: Performance 90+, Accessibility 100, Best Practices 100, SEO 100.

## 8. Quality bar
- Clean, commented, modular ES modules; no globals; no inline event handlers; no `eval`; escape all user/AI text with `textContent` (never inject AI output as HTML, except inside the code box via `textContent`).
- Handle every failure state: offline, rate limited, timeout, empty reply, mic denied, unsupported browser, oversize image (>15MB) with a clear friendly message in the user's language.
- `README.md` with: what it is, setup, env vars, how to add the key in Replit Secrets, how to deploy (Replit Deployments), and troubleshooting. `.env.example` containing `GEMINI_API_KEY=`, `MODEL_QUICK=`, `MODEL_DEFAULT=`, `PORT=3000`.
- Add a basic test script (`npm test`) covering the a11y checker and the JSON-parsing helper.

## 9. Acceptance checklist (verify each before saying "done")
1. `npm start` serves the site; status pill shows **AI connected** when `GEMINI_API_KEY` is set and **Demo mode** when it is not.
2. Ask tab streams a real Gemini answer in the selected language and reading level; Stop works; Read aloud works.
3. Document tab works with pasted text and with an uploaded image; renders all sections.
4. Photo tab returns description, text, alt text, note.
5. Captions tab works in Chrome, with graceful fallback elsewhere.
6. Web check tab scores the example page, lists issues, and "Fix with AI" returns corrected HTML with Copy and Download.
7. All 8 languages switch the UI; every setting persists after reload; Reset works.
8. All 4 themes and 5 colour-vision modes work; Dyslexia mode and Reduce motion work.
9. Keyboard-only walkthrough of every feature succeeds; no contrast failures; works at 320px and 200% zoom.
10. The API key does not appear anywhere in `/public`, network responses, or git history.

Work step by step: first scaffold the structure, then backend, then the design system and layout, then each tab, then i18n, accessibility and PWA, and finally run the checklist and fix anything that fails. Show me the live preview when finished and tell me exactly which Secret to add.

## END OF PROMPT
