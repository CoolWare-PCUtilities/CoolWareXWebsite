#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const args = process.argv.slice(2);
const checkMode = args.includes('--check');
const writeMode = args.includes('--write');

const exts = new Set(['.js', '.json', '.html', '.css', '.md', '.toml']);
const files = [];

function walk(dir) {
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    if (item.name === 'node_modules' || item.name === 'vendor' || item.name.startsWith('.git')) continue;
    const full = path.join(dir, item.name);
    if (item.isDirectory()) walk(full);
    else if (item.isFile() && exts.has(path.extname(item.name))) files.push(full);
  }
}

walk(process.cwd());
let failed = false;
for (const file of files) {
  const source = fs.readFileSync(file, 'utf8');
  const formatted = source.replace(/\r\n/g, '\n');
  if (writeMode && formatted !== source) fs.writeFileSync(file, formatted);
  if (checkMode && formatted !== source) {
    failed = true;
    console.error(`Needs formatting: ${path.relative(process.cwd(), file)}`);
  }
}

process.exit(failed ? 1 : 0);
