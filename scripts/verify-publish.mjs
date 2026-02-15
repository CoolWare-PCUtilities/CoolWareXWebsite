import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const netlifyTomlPath = path.join(repoRoot, 'netlify.toml');

function fail(message) {
  console.error(`verify-publish: ${message}`);
  process.exit(1);
}

if (!fs.existsSync(netlifyTomlPath)) {
  fail('netlify.toml was not found in the repository root.');
}

const toml = fs.readFileSync(netlifyTomlPath, 'utf8');

function getBuildValue(key) {
  const buildBlockMatch = toml.match(/\[build\]([\s\S]*?)(?:\n\[|$)/);
  if (!buildBlockMatch) return null;
  const block = buildBlockMatch[1];
  const valueMatch = block.match(new RegExp(`^\\s*${key}\\s*=\\s*"([^"]+)"`, 'm'));
  return valueMatch ? valueMatch[1] : null;
}

const publishDir = getBuildValue('publish') || '.';
const publishAbs = path.resolve(repoRoot, publishDir);

if (!fs.existsSync(publishAbs) || !fs.statSync(publishAbs).isDirectory()) {
  fail(`publish directory does not exist or is not a directory: ${publishDir}`);
}

const requiredInPublish = ['index.html'];
for (const file of requiredInPublish) {
  const filePath = path.join(publishAbs, file);
  if (!fs.existsSync(filePath)) {
    fail(`required publish file is missing: ${path.join(publishDir, file)}`);
  }
}

const publish404 = path.join(publishAbs, '404.html');
if (!fs.existsSync(publish404)) {
  const redirectsPath = path.join(publishAbs, '_redirects');
  let hasFallback = false;

  if (fs.existsSync(redirectsPath)) {
    const redirectsText = fs.readFileSync(redirectsPath, 'utf8');
    hasFallback = redirectsText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .some((line) => /^\/\*\s+\/(index\.html)?\s+200(?:\s|$)/.test(line));
  }

  if (!hasFallback) {
    fail(`missing 404 fallback: expected ${path.join(publishDir, '404.html')} or a /* -> /index.html 200 rule in ${path.join(publishDir, '_redirects')}`);
  }
}

const keyPages = ['support/index.html', 'products/index.html', 'legal/index.html'];
for (const relPath of keyPages) {
  const repoPath = path.join(repoRoot, relPath);
  if (!fs.existsSync(repoPath)) continue;

  const publishPath = path.join(publishAbs, relPath);
  if (!fs.existsSync(publishPath)) {
    fail(`key page exists in repo but is missing from publish output: ${path.join(publishDir, relPath)}`);
  }
}

console.log(`verify-publish: OK (publish dir: ${publishDir})`);
