import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import selfsigned from 'selfsigned';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const KEY_PATH = path.join(__dirname, 'key.pem');
const CERT_PATH = path.join(__dirname, 'cert.pem');

try {
  if (!fs.existsSync(KEY_PATH) || !fs.existsSync(CERT_PATH)) {
    console.log('[BioFacial] Generando certificados SSL autofirmados para red local...');
    const attrs = [{ name: 'commonName', value: 'localhost' }];
    const pems = await selfsigned.generate(attrs, { days: 3650 });
    fs.writeFileSync(KEY_PATH, pems.private);
    fs.writeFileSync(CERT_PATH, pems.cert);
    console.log('[BioFacial] Certificados SSL creados exitosamente.');
  } else {
    console.log('[BioFacial] Certificados SSL existentes detectados.');
  }
} catch (err) {
  console.error('[BioFacial] Error al generar los certificados SSL:', err);
}
