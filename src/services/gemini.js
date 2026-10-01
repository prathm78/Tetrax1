import { config } from '../config.js';

const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

/**
 * Builds the Gemini payload from incoming request parameters
 */
function buildGeminiPayload({ system, messages, image, json }) {
  const contents = [];

  // Convert messages to Gemini format: role 'assistant' -> 'model'
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    const role = msg.role === 'assistant' ? 'model' : 'user';
    const parts = [];

    // If there is an image and this is the last user message, attach image before text
    const isLastUser = (i === messages.length - 1 || (i === messages.length - 2 && messages[messages.length - 1].role === 'assistant')) && msg.role === 'user';
    if (isLastUser && image && image.data && image.mime) {
      parts.push({
        inlineData: {
          mimeType: image.mime,
          data: image.data
        }
      });
    }

    if (msg.content) {
      parts.push({ text: msg.content });
    }

    if (parts.length > 0) {
      contents.push({ role, parts });
    }
  }

  const payload = { contents };

  if (system && system.trim()) {
    payload.systemInstruction = {
      parts: [{ text: system.trim() }]
    };
  }

  const generationConfig = {};
  if (json) {
    generationConfig.responseMimeType = 'application/json';
  }
  if (Object.keys(generationConfig).length > 0) {
    payload.generationConfig = generationConfig;
  }

  return payload;
}

/**
 * Executes a Gemini API request (streaming or non-streaming)
 */
export async function callGemini({ system, messages, image, tier = 'default', json = false, stream = false, res = null }) {
  if (!config.isKeyConfigured) {
    const err = new Error('Gemini API key is not configured.');
    err.status = 503;
    err.code = 'key_missing';
    throw err;
  }

  const model = tier === 'quick' ? config.modelQuick : config.modelDefault;
  const payload = buildGeminiPayload({ system, messages, image, json });

  const endpoint = stream
    ? `${GEMINI_BASE_URL}/${model}:streamGenerateContent?alt=sse`
    : `${GEMINI_BASE_URL}/${model}:generateContent`;

  let response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': config.geminiApiKey
      },
      body: JSON.stringify(payload)
    });
  } catch (netErr) {
    console.error('[Gemini Service] Network error calling Gemini:', netErr.message);
    const err = new Error('Failed to reach Gemini API.');
    err.status = 502;
    err.code = 'ai_failed';
    throw err;
  }

  if (!response.ok) {
    const status = response.status;
    let errBody = '';
    try {
      errBody = await response.text();
    } catch (_) {}

    console.error(`[Gemini Service] Upstream error HTTP ${status}:`, errBody);

    if (status === 404) {
      console.warn(`[Gemini Service] Model "${model}" returned 404 Not Found. Please update MODEL_QUICK / MODEL_DEFAULT in your .env file.`);
    }

    const err = new Error('Gemini request failed.');
    if (status === 429) {
      err.status = 429;
      err.code = 'rate_limited';
    } else if (status === 400 && (errBody.includes('SAFETY') || errBody.includes('BLOCKED'))) {
      err.status = 422;
      err.code = 'refused';
    } else {
      err.status = 502;
      err.code = 'ai_failed';
    }
    throw err;
  }

  // Handle streaming SSE
  if (stream && res) {
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop(); // keep last incomplete line

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          const jsonStr = trimmed.slice(5).trim();
          if (!jsonStr) continue;

          try {
            const parsed = JSON.parse(jsonStr);
            const candidate = parsed.candidates?.[0];
            if (candidate?.finishReason === 'SAFETY') {
              console.warn('[Gemini Service] Candidate blocked by safety');
            }
            const chunkText = candidate?.content?.parts?.map(p => p.text || '').join('') || '';
            if (chunkText) {
              res.write(`data: ${JSON.stringify({ text: chunkText })}\n\n`);
            }
          } catch (pErr) {
            console.warn('[Gemini Service] SSE JSON parse warning:', pErr.message);
          }
        }
      }

      // Handle any remaining buffer
      if (buffer.trim().startsWith('data:')) {
        const jsonStr = buffer.trim().slice(5).trim();
        if (jsonStr) {
          try {
            const parsed = JSON.parse(jsonStr);
            const chunkText = parsed.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '';
            if (chunkText) {
              res.write(`data: ${JSON.stringify({ text: chunkText })}\n\n`);
            }
          } catch (_) {}
        }
      }

      res.write('data: [DONE]\n\n');
      res.end();
      return;
    } catch (streamErr) {
      console.error('[Gemini Service] Error during SSE pipe:', streamErr.message);
      if (!res.headersSent) {
        res.status(502).json({ error: 'ai_failed' });
      } else {
        res.end();
      }
      return;
    }
  }

  // Handle non-streaming response
  try {
    const data = await response.json();
    const candidate = data.candidates?.[0];
    if (candidate?.finishReason === 'SAFETY') {
      const err = new Error('Content refused by safety filter.');
      err.status = 422;
      err.code = 'refused';
      throw err;
    }
    const text = candidate?.content?.parts?.map(p => p.text || '').join('') || '';
    return { text };
  } catch (err) {
    if (err.code) throw err;
    console.error('[Gemini Service] Error parsing upstream JSON:', err.message);
    const parseErr = new Error('Invalid JSON from Gemini.');
    parseErr.status = 502;
    parseErr.code = 'ai_failed';
    throw parseErr;
  }
}
