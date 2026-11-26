import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';

const [pageUrl, expectedIndex, expectedManifest] = process.argv.slice(2);
assert.ok(pageUrl && /^[a-f0-9]{64}$/.test(expectedIndex) && /^[a-f0-9]{64}$/.test(expectedManifest),
  'Expected the Pages URL and the SHA-256 digests of index.html and manifest.json');
const base = new URL(pageUrl.endsWith('/') ? pageUrl : pageUrl + '/');
const pngSignature = '89504e470d0a1a0a';

async function download(path, attempt) {
  const url = new URL(path, base);
  url.searchParams.set('verify', `${expectedIndex.slice(0, 12)}-${attempt}`);
  const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
  assert.ok(response.ok, `${path || '/'} returned HTTP ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

function verifySha(data, expected, label) {
  const digest = createHash('sha256').update(data).digest('hex');
  assert.ok(digest === expected, `${label} does not match this build`);
}

async function verify(attempt) {
  const [html, manifest] = await Promise.all([
    download('', attempt),
    download('assets/sprites/manifest.json', attempt),
  ]);
  verifySha(html, expectedIndex, 'Public HTML');
  verifySha(manifest, expectedManifest, 'Public sprite manifest');
  const [sprite, audio] = await Promise.all([
    download('assets/sprites/characters/tariq/tariq_idle_down.png', attempt),
    download('assets/sounds/wave-start.wav', attempt),
  ]);
  assert.equal(sprite.subarray(0, 8).toString('hex'), pngSignature, 'Expected a PNG sprite');
  assert.equal(audio.subarray(0, 4).toString('ascii'), 'RIFF', 'Expected a WAV sound');
  assert.equal(audio.subarray(8, 12).toString('ascii'), 'WAVE', 'Expected a WAV sound');
}

for (let attempt = 1; ; attempt++) {
  try {
    await verify(attempt);
    console.log('Public HTML and manifest match the build. Sprite and audio are available.');
    break;
  } catch (error) {
    if (attempt === 8) throw error;
    console.log(`Attempt ${attempt}: ${error.message}. Retrying after CDN propagation.`);
    await delay(5000);
  }
}
