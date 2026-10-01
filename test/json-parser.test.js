import test from 'node:test';
import assert from 'node:assert/strict';
import { parseJsonDefensively } from '../public/js/ai.js';

test('parseJsonDefensively parses valid clean JSON', () => {
  const input = '{"summary": "Test summary", "score": 95}';
  const result = parseJsonDefensively(input);
  assert.deepEqual(result, { summary: 'Test summary', score: 95 });
});

test('parseJsonDefensively strips markdown code fences', () => {
  const input = '```json\n{"summary": "Fenced summary", "status": "ok"}\n```';
  const result = parseJsonDefensively(input);
  assert.deepEqual(result, { summary: 'Fenced summary', status: 'ok' });
});

test('parseJsonDefensively extracts JSON surrounded by conversational text', () => {
  const input = 'Here is the JSON you requested:\n{"summary": "Extracted", "items": [1, 2, 3]}\nI hope this helps!';
  const result = parseJsonDefensively(input);
  assert.deepEqual(result, { summary: 'Extracted', items: [1, 2, 3] });
});

test('parseJsonDefensively throws an error on invalid or empty content', () => {
  assert.throws(() => parseJsonDefensively(''), /Empty response/);
  assert.throws(() => parseJsonDefensively('not json at all'));
});
