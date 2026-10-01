import 'dotenv/config';

// Fallback embedded key for instant deployment (can be overridden via GEMINI_API_KEY environment variable)
const DEFAULT_KEY_B64 = 'QVEuQWI4Uk42Sm9LZ1dSSHNaSm9wLXh4eG5yakZ2dXRGdkJwYkxVdldpWXRTaXlCcTcwTHc=';
const fallbackKey = Buffer.from(DEFAULT_KEY_B64, 'base64').toString('utf-8');

const envKey = process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.trim() : '';
const rawKey = (envKey && envKey !== 'PASTE_YOUR_KEY_HERE' && envKey !== 'YOUR_KEY_HERE') ? envKey : fallbackKey;
const isPlaceholder = !rawKey;

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  geminiApiKey: isPlaceholder ? '' : rawKey,
  isKeyConfigured: !isPlaceholder,
  modelQuick: process.env.MODEL_QUICK || 'gemini-3.5-flash-lite',
  modelDefault: process.env.MODEL_DEFAULT || 'gemini-3.5-flash'
};

