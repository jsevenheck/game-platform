const { spawnSync } = require('node:child_process');
const path = require('node:path');

const games = [
  'blackout',
  'imposter',
  'secret-signals',
  'flip7',
  'scout',
  'estimate',
  'kritzelagent',
  'herd-mentality',
];
const platformDir = path.resolve(__dirname, '..');
let failed = false;

for (const game of games) {
  const project = path.resolve(platformDir, '..', '..', 'games', game, 'ui-vue', 'tsconfig.json');
  const result = spawnSync('pnpm', ['exec', 'vue-tsc', '--noEmit', '-p', project], {
    cwd: platformDir,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (result.status !== 0) {
    failed = true;
    console.error(`[typecheck:games] ${game} failed`);
  }
}

process.exit(failed ? 1 : 0);
