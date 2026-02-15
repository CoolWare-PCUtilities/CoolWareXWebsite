import { spawnSync } from 'node:child_process';

function fail(message, code = 1) {
  console.error(`deploy-preview: ${message}`);
  process.exit(code);
}

function run(cmd, args, options = {}) {
  const result = spawnSync(cmd, args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
    ...options
  });

  if (result.error) {
    fail(`failed to run ${cmd}: ${result.error.message}`);
  }

  return result;
}

const verify = run(process.execPath, ['scripts/verify-publish.mjs']);
if (verify.status !== 0) {
  process.stderr.write(verify.stderr || '');
  process.stdout.write(verify.stdout || '');
  fail('publish validation failed.');
}

const requiredEnv = ['NETLIFY_AUTH_TOKEN', 'NETLIFY_SITE_ID'];
const missing = requiredEnv.filter((name) => !String(process.env[name] || '').trim());
if (missing.length > 0) {
  fail(`missing required environment variables: ${missing.join(', ')}`);
}

const deploy = run('npx', [
  'netlify',
  'deploy',
  '--dir',
  '.',
  '--functions',
  'netlify/functions',
  '--site',
  process.env.NETLIFY_SITE_ID,
  '--auth',
  process.env.NETLIFY_AUTH_TOKEN,
  '--message',
  'Manual preview deploy',
  '--json'
]);

if (deploy.status !== 0) {
  process.stderr.write(deploy.stderr || '');
  process.stdout.write(deploy.stdout || '');
  fail('netlify deploy failed.', deploy.status || 1);
}

let parsed;
try {
  parsed = JSON.parse(deploy.stdout);
} catch (error) {
  process.stderr.write(deploy.stderr || '');
  process.stdout.write(deploy.stdout || '');
  fail(`unable to parse deploy JSON output: ${error.message}`);
}

const previewUrl = parsed.deploy_ssl_url || parsed.ssl_url || parsed.deploy_url || parsed.url;
if (!previewUrl) {
  fail('deploy completed but preview URL was not found in CLI output.');
}

console.log(previewUrl);
