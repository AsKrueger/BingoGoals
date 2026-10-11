import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import type { Plugin } from 'vite';

const OUTPUT = 'sw.js';

function listFiles(directory: string, root = directory): string[] {
  return readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const path = join(directory, entry.name);
      return entry.isDirectory()
        ? listFiles(path, root)
        : [relative(root, path).replaceAll('\\', '/')];
    })
    .sort();
}

/**
 * Genera dist/sw.js al terminar la compilación, a partir de pwa/sw.js.
 *
 * La lista de archivos sale de lo que hay realmente en dist, y la versión es
 * un resumen de su contenido: si cambia cualquier archivo, cambia el service
 * worker y el navegador detecta que hay una versión nueva.
 */
export function serviceWorker(): Plugin {
  let root = '';
  let outDir = '';

  return {
    name: 'bingogoals-service-worker',
    apply: 'build',
    configResolved(config) {
      root = config.root;
      outDir = resolve(config.root, config.build.outDir);
    },
    closeBundle() {
      const template = readFileSync(resolve(root, 'pwa', OUTPUT), 'utf8');
      const files = listFiles(outDir).filter((file) => file !== OUTPUT);

      const hash = createHash('sha256').update(template);
      for (const file of files) {
        hash.update(file).update(readFileSync(join(outDir, file)));
      }
      const version = hash.digest('hex').slice(0, 12);

      writeFileSync(
        join(outDir, OUTPUT),
        template
          .replace('__SW_VERSION__', version)
          .replace('__SW_FILES__', JSON.stringify(files)),
      );
    },
  };
}
