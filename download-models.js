import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FILES = [
  'tiny_face_detector_model-weights_manifest.json',
  'tiny_face_detector_model-shard1',
  'face_landmark_68_model-weights_manifest.json',
  'face_landmark_68_model-shard1',
  'face_recognition_model-weights_manifest.json',
  'face_recognition_model-shard1',
  'face_recognition_model-shard2'
];

const BASE_URL = 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/';

const destDirs = [
  path.join(__dirname, 'BankUnerg', 'public', 'models'),
  path.join(__dirname, 'BodeUnerg', 'public', 'models')
];

// Ensure directories exist
destDirs.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`Failed to download: ${res.statusCode}`));
        return;
      }
      const fileStream = fs.createWriteStream(dest);
      res.pipe(fileStream);
      fileStream.on('finish', () => {
        fileStream.close();
        resolve();
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

console.log('Descargando modelos de face-api.js para funcionamiento 100% OFFLINE...');

(async () => {
  for (const file of FILES) {
    const url = `${BASE_URL}${file}`;
    console.log(`Descargando ${file}...`);
    try {
      // Download to BankUnerg first
      const destBank = path.join(destDirs[0], file);
      await downloadFile(url, destBank);
      
      // Copy to BodeUnerg
      const destBode = path.join(destDirs[1], file);
      fs.copyFileSync(destBank, destBode);
      console.log(`Guardado en ambos destinos: ${file}`);
    } catch (err) {
      console.error(`Error descargando ${file}:`, err.message);
    }
  }
  console.log('¡Descarga completada con éxito!');
})();
