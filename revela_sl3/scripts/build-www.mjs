// Copia la app web a www/ (la carpeta que Capacitor empaqueta en la APK).
import { cpSync, rmSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'www');
rmSync(out, { recursive: true, force: true });
mkdirSync(out);
for (const f of ['index.html', 'manifest.webmanifest', 'css', 'js', 'icons']) {
  cpSync(join(root, f), join(out, f), { recursive: true });
}
console.log('www/ listo');
