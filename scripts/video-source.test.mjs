import test from 'node:test';
import assert from 'node:assert/strict';
import { parseVideoSource } from './video-source.mjs';

test('normalizes video providers and removes tracking/autoplay parameters', () => {
  for (const input of ['https://youtu.be/dQw4w9WgXcQ', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&autoplay=1', 'https://youtube.com/shorts/dQw4w9WgXcQ']) {
    assert.equal(parseVideoSource(input).embedUrl, 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
    assert.equal(parseVideoSource(input).requiresConsent, true);
  }
  assert.equal(parseVideoSource('https://vimeo.com/123456').embedUrl, 'https://player.vimeo.com/video/123456?dnt=1');
});

test('rejects unsafe schemes, credentials, lookalike domains and malformed IDs', () => {
  for (const input of [null, {}, '', 'javascript:alert(1)', 'http://youtu.be/dQw4w9WgXcQ', 'https://youtube.com.evil.test/watch?v=dQw4w9WgXcQ', 'https://user:pass@youtu.be/dQw4w9WgXcQ', 'https://youtu.be:8443/dQw4w9WgXcQ', 'https://youtu.be/invalid', 'https://vimeo.com/123/456', '<iframe src="https://example.com"></iframe>', 'https://127.0.0.1/video.mp4']) assert.equal(parseVideoSource(input), null);
});
