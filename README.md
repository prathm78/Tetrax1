# Samavesh AI: AI that works the way you do

> **समावेश** means inclusion. Samavesh AI is an accessible, multilingual AI assistant built so that everyone can use AI: people with disabilities, people with low literacy, and people who do not speak English.

---

## Features

- **Ask Anything**: Talk, type, or ask questions in English and 7 Indian languages (Hindi, Marathi, Tamil, Telugu, Bengali, Gujarati, Kannada) with word-by-word streaming answers and Web Speech synthesis reading aloud.
- **Understand Letters & Forms**: Paste complex official notices or bills, or upload photo/PDF scans, and receive structured breakdowns: In short summary, What it says, Action items, Deadlines, Hard words explained, and Risk cautions.
- **Describe Photos**: Upload or take pictures to get high-accuracy descriptions, OCR text recognition, and WCAG-compliant `alt` text (max 125 chars) ready to copy.
- **Live Captions**: Real-time microphone speech-to-text with large, readable type, continuous transcription, and sample playback demo.
- **Website Barrier Check**: Audit any HTML snippet or live URL against WCAG 2.2 Level AA rules with an animated visual score ring and automated AI repair.
- **Universal Accessibility Settings**:
  - 8 Languages with localized UI and speech locale codes (`en-IN`, `hi-IN`, `mr-IN`, `ta-IN`, etc.)
  - 3 Reading levels (Normal, Simple, Very simple)
  - 3 Voice speeds (Slow, Normal, Fast)
  - Text size scaling (100% to 200%)
  - 4 Themes: Auto, Light, Dark, and high-contrast Yellow-on-Black
  - 5 Color vision simulation modes: Normal, Protanopia, Deuteranopia, Tritanopia, and Greyscale
  - Dyslexia-friendly Lexend typography and customized word spacing
  - Reduce motion respect

---

## Quick Start (Local Setup)

### 1. Prerequisites
- Node.js 20+ installed
- A Google Gemini API key from [Google AI Studio](https://aistudio.google.com/)

### 2. Installation
```bash
git clone <your-repo>
cd Tetraxhack
npm install
```

### 3. Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

Open `.env` and set your key:
```ini
GEMINI_API_KEY=your_actual_gemini_api_key_here
MODEL_QUICK=gemini-2.5-flash
MODEL_DEFAULT=gemini-2.5-flash
PORT=3000
```

> **Security Note:** Never commit your `.env` file or paste your API key into git or chat. The server securely proxies all AI requests and keeps keys strictly on the backend.

### 4. Running the Server
```bash
npm start
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

- If `GEMINI_API_KEY` is configured: the AI Status pill shows **AI connected** (live answers).
- If `GEMINI_API_KEY` is empty or placeholder: the app runs in **Demo mode** with built-in samples.

### 5. Running Tests
```bash
npm test
```
Executes the automated WCAG 2.2 AA audit suite and resilient JSON parser tests.

---

## Deployment on Replit

1. Import this repository into a new Node.js Repl.
2. In the Replit sidebar, navigate to **Tools > Secrets**.
3. Add a new Secret:
   - Key: `GEMINI_API_KEY`
   - Value: `your_gemini_api_key`
4. Replit automatically detects `PORT` from the environment and binds to `0.0.0.0`.
5. Click **Run** or deploy using **Replit Deployments** (Autoscale or Reserved VM).

---

## Architecture & Security

- **Server-Side AI Gateway**: Plain `fetch` to Google Gemini API with Server-Sent Events (`streamGenerateContent?alt=sse`).
- **SSRF Protection**: `/api/fetch-page` resolves hostnames and strictly blocks loopback (`127.0.0.1`), private RFC1918 (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`), and link-local addresses, enforced with a 5s timeout and 2MB payload cap.
- **Security Headers**: Helmet with custom Content Security Policy (CSP) permitting Google Fonts and self-hosted assets, 30 req/min rate limiter on `/api/ai`, and `no-store` API caching.

---

## Keyboard Shortcuts

- <kbd>Alt</kbd> + <kbd>1</kbd>: Switch to **Ask**
- <kbd>Alt</kbd> + <kbd>2</kbd>: Switch to **Documents**
- <kbd>Alt</kbd> + <kbd>3</kbd>: Switch to **Photos**
- <kbd>Alt</kbd> + <kbd>4</kbd>: Switch to **Captions**
- <kbd>Alt</kbd> + <kbd>5</kbd>: Switch to **Website Check**
- <kbd>Ctrl</kbd> + <kbd>Enter</kbd> (or <kbd>Cmd</kbd> + <kbd>Enter</kbd>): Send question in Ask tab
