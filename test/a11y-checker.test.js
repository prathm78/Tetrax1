import test from 'node:test';
import assert from 'node:assert/strict';
import { DOMParser } from 'linkedom';
import { parseColor, contrastRatio, checkHTML, autoFix } from '../public/js/a11y-checker.js';

test('parseColor handles hex3, hex6, rgb, and named colors', () => {
  assert.deepEqual(parseColor('#fff'), [255, 255, 255]);
  assert.deepEqual(parseColor('#000000'), [0, 0, 0]);
  assert.deepEqual(parseColor('rgb(10, 20, 30)'), [10, 20, 30]);
  assert.deepEqual(parseColor('white'), [255, 255, 255]);
  assert.deepEqual(parseColor('black'), [0, 0, 0]);
});

test('contrastRatio computes accurate WCAG ratios', () => {
  const white = [255, 255, 255];
  const black = [0, 0, 0];
  const ratio = contrastRatio(black, white);
  assert.ok(ratio >= 20.9 && ratio <= 21.1, `Black on white should be ~21:1, got ${ratio}`);

  const same = contrastRatio(white, white);
  assert.equal(same.toFixed(1), '1.0');
});

test('checkHTML detects missing lang, title, and image alt', () => {
  const badHtml = `<html><head></head><body><img src="pic.jpg"></body></html>`;
  const result = checkHTML(badHtml, new DOMParser());

  assert.ok(result.score < 100, `Score should be penalized, got ${result.score}`);
  const titles = result.issues.map((i) => i.title);

  assert.ok(titles.some((t) => t.includes('language is not set')), 'Should flag missing lang');
  assert.ok(titles.some((t) => t.includes('no title')), 'Should flag missing title');
  assert.ok(titles.some((t) => t.includes('Image has no alt text')), 'Should flag missing alt text');
});

test('autoFix repairs missing lang, title, image alt, and viewport zoom', () => {
  const badHtml = `<html><head><meta name="viewport" content="user-scalable=no"></head><body><h1>My Title</h1><img src="pic.jpg"></body></html>`;
  const parser = new DOMParser();
  const fixed = autoFix(badHtml, parser);

  // Re-check fixed HTML
  const reCheck = checkHTML(fixed, parser);
  assert.ok(reCheck.score >= 90, `Fixed HTML should score at least 90, got ${reCheck.score}`);
  assert.ok(fixed.includes('lang="en"'), 'Fixed HTML should include lang="en"');
  assert.ok(fixed.includes('<title>'), 'Fixed HTML should include title');
  assert.ok(fixed.includes('alt="'), 'Fixed HTML should include alt on image');
  assert.ok(fixed.includes('width=device-width, initial-scale=1'), 'Fixed viewport should allow scaling');
});
