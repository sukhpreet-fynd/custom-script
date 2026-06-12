import { cpSync, existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

function run(command, args, options = {}) {
  execFileSync(command, args, {
    stdio: 'inherit',
    ...options,
  });
}

function output(command, args) {
  return execFileSync(command, args, { encoding: 'utf8' }).trim();
}

const remote = output('git', ['remote', 'get-url', 'origin']);
const tempDir = mkdtempSync(join(tmpdir(), 'kaily-pages-'));

run('npm', ['run', 'build']);

run('git', ['clone', '--branch', 'gh-pages', '--single-branch', remote, tempDir]);

for (const entry of readdirSync(tempDir)) {
  if (entry === '.git') continue;
  rmSync(join(tempDir, entry), { recursive: true, force: true });
}

cpSync('dist', tempDir, { recursive: true });
writeFileSync(join(tempDir, '.nojekyll'), '');

run('git', ['add', '-A'], { cwd: tempDir });

try {
  run('git', ['diff', '--cached', '--quiet'], { cwd: tempDir });
  console.log('No GitHub Pages changes to deploy.');
} catch {
  run('git', ['commit', '-m', 'Deploy Kaily chatbot UI'], { cwd: tempDir });
  run('git', ['push', 'origin', 'gh-pages'], { cwd: tempDir });
}

if (existsSync(tempDir)) {
  rmSync(tempDir, { recursive: true, force: true });
}

console.log('GitHub Pages deployment complete.');
