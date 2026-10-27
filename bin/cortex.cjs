#!/usr/bin/env node

const path = require('path');
const { spawn } = require('child_process');

const cliScript = path.resolve(__dirname, '../src/server/cli/cortex-cli.ts');
const args = process.argv.slice(2);

let tsxCli;
try {
  tsxCli = require.resolve('tsx/cli');
} catch (e) {
  tsxCli = path.resolve(__dirname, '../node_modules/tsx/dist/cli.mjs');
}

const child = spawn(process.execPath, [tsxCli, cliScript, ...args], {
  stdio: 'inherit',
  env: process.env,
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
  } else {
    process.exit(code !== null ? code : 0);
  }
});

child.on('error', (err) => {
  console.error('Failed to launch Cortex CLI:', err);
  process.exit(1);
});
