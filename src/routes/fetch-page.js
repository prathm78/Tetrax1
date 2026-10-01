import { Router } from 'express';
import dns from 'node:dns/promises';
import { z } from 'zod';
import { apiNoCache } from '../middleware/security.js';

const router = Router();

const fetchPageSchema = z.object({
  url: z.string().url()
});

function isPrivateIp(ip) {
  // IPv4 checks
  if (ip.includes('.')) {
    const parts = ip.split('.').map(Number);
    if (parts.length !== 4 || parts.some(isNaN)) return true;
    const [a, b] = parts;

    // 0.0.0.0/8
    if (a === 0) return true;
    // 127.0.0.0/8 (loopback)
    if (a === 127) return true;
    // 10.0.0.0/8 (private)
    if (a === 10) return true;
    // 172.16.0.0/12 (private)
    if (a === 172 && b >= 16 && b <= 31) return true;
    // 192.168.0.0/16 (private)
    if (a === 192 && b === 168) return true;
    // 169.254.0.0/16 (link-local)
    if (a === 169 && b === 254) return true;
    // 100.64.0.0/10 (CGNAT)
    if (a === 100 && b >= 64 && b <= 127) return true;

    return false;
  }

  // IPv6 checks
  const lower = ip.toLowerCase();
  if (lower === '::1' || lower === '::' || lower.startsWith('fe80:') || lower.startsWith('fc') || lower.startsWith('fd')) {
    return true;
  }

  return false;
}

router.post('/fetch-page', apiNoCache, async (req, res) => {
  const parseResult = fetchPageSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: 'invalid_url' });
  }

  const { url } = parseResult.data;

  try {
    const parsedUrl = new URL(url);
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      return res.status(400).json({ error: 'invalid_protocol' });
    }

    // DNS lookup to prevent SSRF
    const hostname = parsedUrl.hostname;
    const lookupResult = await dns.lookup(hostname);
    if (isPrivateIp(lookupResult.address)) {
      return res.status(403).json({ error: 'forbidden_host', message: 'Access to private or local network is prohibited' });
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 SamaveshA11yCheck/1.0',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return res.status(502).json({ error: 'fetch_failed', status: response.status });
    }

    // Limit to 2MB
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let received = 0;
    const MAX_BYTES = 2 * 1024 * 1024;
    let html = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.length;
      if (received > MAX_BYTES) {
        reader.cancel();
        return res.status(413).json({ error: 'content_too_large' });
      }
      html += decoder.decode(value, { stream: true });
    }

    return res.json({ html });
  } catch (err) {
    if (err.name === 'AbortError') {
      return res.status(504).json({ error: 'timeout' });
    }
    console.error('[Fetch Page Error]:', err.message);
    return res.status(500).json({ error: 'fetch_error', message: err.message });
  }
});

export default router;
