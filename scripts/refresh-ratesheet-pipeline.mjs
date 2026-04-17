#!/usr/bin/env node
import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const shouldPush = process.argv.includes('--push');

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: 'pipe',
    ...options,
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed with code ${result.status}\n${result.stdout || ''}${result.stderr || ''}`.trim());
  }
  return result.stdout.trim();
}

function hasDiff() {
  const status = run('git', ['status', '--porcelain', 'src/lib/rates', 'package.json', 'package-lock.json']);
  return status.trim().length > 0;
}

function main() {
  run('node', ['scripts/refresh-ratesheet-data.mjs']);
  run('npm', ['run', 'build']);

  if (!hasDiff()) {
    console.log(JSON.stringify({ changed: false, pushed: false }, null, 2));
    return;
  }

  run('git', ['add', 'src/lib/rates', 'package.json', 'package-lock.json']);
  run('git', ['commit', '-m', 'Refresh staged ratesheet pricing data']);

  if (shouldPush) {
    run('git', ['push', 'origin', 'main']);
  }

  console.log(JSON.stringify({ changed: true, pushed: shouldPush }, null, 2));
}

main();
