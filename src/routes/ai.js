import { Router } from 'express';
import { z } from 'zod';
import { config } from '../config.js';
import { callGemini } from '../services/gemini.js';
import { aiRateLimiter, apiNoCache } from '../middleware/security.js';

const router = Router();

// Validation schema for /api/ai
const aiRequestSchema = z.object({
  system: z.string().max(6000).optional(),
  messages: z.array(
    z.object({
      role: z.enum(['user', 'assistant']),
      content: z.string().max(20000)
    })
  ).min(1).max(12),
  image: z.object({
    mime: z.enum(['image/jpeg', 'image/png', 'image/webp']),
    data: z.string().max(20 * 1024 * 1024) // approx 15-20MB base64
  }).optional(),
  tier: z.enum(['quick', 'default']).optional().default('default'),
  json: z.boolean().optional().default(false),
  stream: z.boolean().optional().default(false)
});

// GET /api/health
router.get('/health', apiNoCache, (req, res) => {
  if (config.isKeyConfigured) {
    return res.json({ ok: true, provider: 'gemini' });
  }
  return res.json({ ok: false });
});

// POST /api/ai
router.post('/ai', apiNoCache, aiRateLimiter, async (req, res) => {
  if (!config.isKeyConfigured) {
    return res.status(503).json({ error: 'key_missing' });
  }

  const parseResult = aiRequestSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      error: 'invalid_request',
      details: parseResult.error.errors.map(e => e.message)
    });
  }

  const { system, messages, image, tier, json, stream } = parseResult.data;

  try {
    if (stream) {
      await callGemini({ system, messages, image, tier, json, stream: true, res });
    } else {
      const result = await callGemini({ system, messages, image, tier, json, stream: false });
      return res.json(result);
    }
  } catch (err) {
    console.error('[AI Route Error]:', err.message);
    if (!res.headersSent) {
      const status = err.status || 502;
      const code = err.code || 'ai_failed';
      return res.status(status).json({ error: code });
    }
  }
});

export default router;
