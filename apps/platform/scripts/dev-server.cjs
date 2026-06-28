const { existsSync } = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

const envFilePath = path.resolve(__dirname, '..', '..', '..', '.env');
const nodeArgs = [];

if (existsSync(envFilePath)) {
  nodeArgs.push(`--env-file=${envFilePath}`);
}

nodeArgs.push('--import', 'tsx', '--watch', 'server/index.ts', ...process.argv.slice(2));

const child = spawn(process.execPath, nodeArgs, {
  cwd: path.resolve(__dirname, '..'),
  stdio: 'inherit',
  env: process.env,
});

let isExiting = false;

child.on('exit', (code, signal) => {
  isExiting = true;

  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});

child.on('error', (error) => {
  console.error(error);
  process.exit(1);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    if (!isExiting) {
      child.kill(signal);
    }
  });
}
