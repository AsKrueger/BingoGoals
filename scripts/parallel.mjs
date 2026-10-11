// Ejecuta varios scripts de npm a la vez y termina todos cuando uno acaba.
// Uso: node scripts/parallel.mjs "<script> [args]" "<script> [args]" ...
import { spawn } from 'node:child_process';

const commands = process.argv.slice(2);

if (commands.length === 0) {
  console.error('Uso: node scripts/parallel.mjs "<script> [args]" ...');
  process.exit(1);
}

const children = commands.map((command) =>
  spawn(`npm run ${command}`, { stdio: 'inherit', shell: true }),
);

function stopAll() {
  for (const child of children) {
    child.kill();
  }
}

for (const child of children) {
  child.on('exit', (code) => {
    stopAll();
    process.exitCode ||= code ?? 0;
  });
}

process.on('SIGINT', stopAll);
process.on('SIGTERM', stopAll);
