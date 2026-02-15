#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

function walk(dir, out) {
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    if (item.name === 'node_modules' || item.name === 'vendor' || item.name.startsWith('.git')) continue;
    const full = path.join(dir, item.name);
    if (item.isDirectory()) walk(full, out);
    else if (item.isFile() && full.endsWith('.js')) out.push(full);
  }
}

const targets = process.argv.slice(2);
const files = [];
for (const target of targets) {
  const full = path.resolve(target);
  if (!fs.existsSync(full)) continue;
  const stat = fs.statSync(full);
  if (stat.isDirectory()) walk(full, files);
  if (stat.isFile() && full.endsWith('.js')) files.push(full);
}

let failed = false;
for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], { stdio: 'inherit' });
  if (result.status !== 0) failed = true;
}

process.exit(failed ? 1 : 0);
