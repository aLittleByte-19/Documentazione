import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import './prepare-assets.mjs';

const development = process.argv.includes('--development');
const watch = process.argv.includes('--watch');
const cliPath = fileURLToPath(new URL('../node_modules/@angular/cli/bin/ng.js', import.meta.url));
const argumentsList = [
  cliPath,
  'build',
  '--configuration',
  development ? 'development' : 'production',
  '--progress=false',
];

if (watch) {
  argumentsList.push('--watch');
}

const build = spawn(process.execPath, argumentsList, {
  stdio: 'inherit',
  env: {
    ...process.env,
    CI: 'true',
    NG_BUILD_PARALLEL_TS: 'false',
  },
});

build.once('error', (error) => {
  console.error(error);
  process.exitCode = 1;
});

build.once('exit', (code, signal) => {
  if (signal) {
    console.error(`Build Angular interrotto dal segnale ${signal}.`);
  }
  process.exitCode = code ?? 1;
});
