// Ejecuta varios scripts de npm a la vez. Cuando uno termina, o al pulsar
// Ctrl+C, detiene todos los demás con todos sus procesos hijos.
// Uso: node scripts/parallel.mjs "<script> [args]" "<script> [args]" ...
import { spawn, spawnSync } from 'node:child_process';

const commands = process.argv.slice(2);

if (commands.length === 0) {
  console.error('Uso: node scripts/parallel.mjs "<script> [args]" ...');
  process.exit(1);
}

const isWindows = process.platform === 'win32';

const children = commands.map((command) =>
  spawn(`npm run ${command}`, {
    stdio: 'inherit',
    shell: true,
    // Fuera de Windows cada script va en su propio grupo de procesos, para
    // poder detenerlo entero.
    detached: !isWindows,
  }),
);

/**
 * Detiene un script con todo lo que haya lanzado. `child.kill()` no basta:
 * solo terminaría el intérprete de órdenes y dejaría huérfanos a npm y a los
 * servidores que cuelgan de él.
 */
function stopTree(child) {
  if (child.exitCode !== null || child.signalCode !== null) {
    return;
  }
  if (isWindows) {
    spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], {
      stdio: 'ignore',
    });
    return;
  }
  try {
    process.kill(-child.pid, 'SIGTERM');
  } catch {
    // El grupo ya había terminado.
  }
}

let isStopping = false;

function stopAll() {
  if (isStopping) {
    return;
  }
  isStopping = true;
  for (const child of children) {
    stopTree(child);
  }
}

for (const child of children) {
  child.on('exit', (code) => {
    // Si se está deteniendo todo a propósito, la salida es correcta.
    process.exitCode ||= isStopping ? 0 : (code ?? 0);
    stopAll();
  });
}

for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.on(signal, stopAll);
}
