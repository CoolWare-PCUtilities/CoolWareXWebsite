const { execSync } = require('node:child_process');

const command = 'git ls-files "*.js"';
const files = execSync(command, { encoding: 'utf8' })
  .split(/\r?\n/)
  .map((item) => item.trim())
  .filter(Boolean)
  .filter((item) => !item.startsWith('node_modules/'));

for (const file of files) {
  execSync(`node --check "${file}"`, { stdio: 'inherit' });
}

console.log(`Linted ${files.length} JavaScript files.`);
