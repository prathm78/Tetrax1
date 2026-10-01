import 'dotenv/config';

const rawKey = process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.trim() : '';
const isPlaceholder = !rawKey || rawKey === 'PASTE_YOUR_KEY_HERE' || rawKey === 'YOUR_KEY_HERE';

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  geminiApiKey: isPlaceholder ? '' : rawKey,
  isKeyConfigured: !isPlaceholder,
  modelQuick: process.env.MODEL_QUICK || 'gemini-2.5-flash',
  modelDefault: process.env.MODEL_DEFAULT || 'gemini-2.5-flash'
};
