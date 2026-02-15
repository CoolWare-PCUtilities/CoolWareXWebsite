import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const netlifyTomlPath = path.join(repoRoot, 'netlify.toml');
let failures = 0;

function info(message) {
  console.log(`doctor: ${message}`);
}

function fail(message) {
  failures += 1;
  console.error(`doctor: ERROR: ${message}`);
}

if (!fs.existsSync(netlifyTomlPath)) {
  fail('netlify.toml not found in repository root.');
  process.exit(1);
}

const toml = fs.readFileSync(netlifyTomlPath, 'utf8');

function getBuildValue(key, fallback = null) {
  const buildBlock = toml.match(/\[build\]([\s\S]*?)(?:\n\[|$)/);
  if (!buildBlock) return fallback;
  const valueMatch = buildBlock[1].match(new RegExp(`^\\s*${key}\\s*=\\s*"([^"]+)"`, 'm'));
  return valueMatch ? valueMatch[1] : fallback;
}

const publishDir = getBuildValue('publish', '.');
const functionsDir = getBuildValue('functions', 'netlify/functions');

const publishPath = path.resolve(repoRoot, publishDir);
const functionsPath = path.resolve(repoRoot, functionsDir);

if (!fs.existsSync(publishPath) || !fs.statSync(publishPath).isDirectory()) {
  fail(`publish directory does not exist: ${publishDir}`);
} else {
  info(`publish directory found: ${publishDir}`);
}

const indexPath = path.join(publishPath, 'index.html');
if (!fs.existsSync(indexPath)) {
  fail(`index.html missing from publish directory: ${path.join(publishDir, 'index.html')}`);
} else {
  info(`index.html found: ${path.join(publishDir, 'index.html')}`);
}

if (!fs.existsSync(functionsPath) || !fs.statSync(functionsPath).isDirectory()) {
  fail(`functions directory does not exist: ${functionsDir}`);
} else {
  info(`functions directory found: ${functionsDir}`);
}

const redirects = [...toml.matchAll(/\[\[redirects\]\]([\s\S]*?)(?=\n\[\[redirects\]\]|\n\[|$)/g)].map((m) => m[1]);
for (const block of redirects) {
  const from = (block.match(/^\s*from\s*=\s*"([^"]+)"/m) || [])[1] || '';
  const to = (block.match(/^\s*to\s*=\s*"([^"]+)"/m) || [])[1] || '';

  const isCatchAllFrom = from === '/*';
  const pointsToKnownDomain = /coolwarex\.com/.test(to);

  if (isCatchAllFrom && pointsToKnownDomain) {
    fail(`catch-all redirect can hijack deploy-preview domains: from="${from}" to="${to}"`);
  }
}
if (redirects.length > 0) {
  info('redirect rules parsed successfully.');
}

const mappedPaths = [
  { from: '/success', to: '/success.html' },
  { from: '/cancel', to: '/cancel.html' },
  { from: '/thanks', to: '/thanks/index.html' }
];

for (const rule of mappedPaths) {
  const existsInToml = redirects.some((block) => {
    const from = (block.match(/^\s*from\s*=\s*"([^"]+)"/m) || [])[1] || '';
    const to = (block.match(/^\s*to\s*=\s*"([^"]+)"/m) || [])[1] || '';
    return from === rule.from && to === rule.to;
  });

  if (!existsInToml) {
    fail(`missing expected redirect mapping: ${rule.from} -> ${rule.to}`);
    continue;
  }

  const targetPath = path.resolve(repoRoot, `.${rule.to}`);
  if (!fs.existsSync(targetPath)) {
    fail(`redirect target does not exist for ${rule.from}: ${rule.to}`);
  } else {
    info(`redirect target exists: ${rule.from} -> ${rule.to}`);
  }
}

if (failures > 0) {
  fail(`doctor checks failed (${failures} issue${failures === 1 ? '' : 's'}).`);
  process.exit(1);
}

info('all checks passed.');
