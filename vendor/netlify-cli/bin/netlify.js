#!/usr/bin/env node

const { spawn } = require('node:child_process');

const command = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const child = spawn(command, ['--yes', 'netlify-cli@17.37.1', ...process.argv.slice(2)], {
  stdio: 'inherit',
  shell: false
});

child.on('exit', (code) => process.exit(code ?? 1));
child.on('error', (error) => {
  console.error(`Failed to run Netlify CLI: ${error.message}`);
  process.exit(1);
});
