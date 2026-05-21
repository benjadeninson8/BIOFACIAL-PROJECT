import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';
import { MongoClient } from 'mongodb';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, 'db.json');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: '10mb' })); // Allow larger payloads for descriptors

// MongoDB Connection Setup
const MONGODB_URI = process.env.MONGODB_URI;
let dbClient = null;
let usersCollection = null;

if (MONGODB_URI) {
  console.log('[BioFacial] Detectada variable MONGODB_URI. Conectando a MongoDB Atlas...');
  MongoClient.connect(MONGODB_URI)
    .then(client => {
      dbClient = client;
      const dbName = MONGODB_URI.split('/').pop()?.split('?')[0] || 'biofacial';
      usersCollection = client.db(dbName).collection('users');
      console.log(`[BioFacial] Conectado exitosamente a MongoDB, Base de Datos: ${dbName}`);
    })
    .catch(err => {
      console.error('[BioFacial] Error al conectar a MongoDB:', err);
    });
} else {
  console.log('[BioFacial] No se detectó MONGODB_URI. Usando base de datos local db.json');
}

// Helper to read local database (Fallback)
function readDb() {
  try {
    if (!fs.existsSync(DB_PATH)) {
      fs.writeFileSync(DB_PATH, JSON.stringify([]));
      return [];
    }
    const data = fs.readFileSync(DB_PATH, 'utf-8');
    return JSON.parse(data || '[]');
  } catch (error) {
    console.error('Error reading database file:', error);
    return [];
  }
}

// Helper to write local database (Fallback)
function writeDb(data) {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error writing to database file:', error);
  }
}

// Abstract DB Helpers supporting both MongoDB and local db.json
async function getUsersList() {
  if (usersCollection) {
    return await usersCollection.find({}).toArray();
  }
  return readDb();
}

async function saveUser(user) {
  if (usersCollection) {
    await usersCollection.replaceOne(
      { $or: [{ id: user.id }, { cedula: user.cedula }] },
      user,
      { upsert: true }
    );
  } else {
    const users = readDb();
    const existingIndex = users.findIndex(u => u.cedula === user.cedula || u.id === user.id);
    if (existingIndex !== -1) {
      users[existingIndex] = user;
    } else {
      users.push(user);
    }
    writeDb(users);
  }
}

async function deleteUser(id) {
  if (usersCollection) {
    const result = await usersCollection.deleteOne({ id });
    return result.deletedCount > 0;
  } else {
    let users = readDb();
    const initialLength = users.length;
    users = users.filter(u => u.id !== id);
    if (users.length === initialLength) return false;
    writeDb(users);
    return true;
  }
}

async function clearDatabase() {
  if (usersCollection) {
    await usersCollection.deleteMany({});
  } else {
    writeDb([]);
  }
}

// Helper to compute Euclidean Distance
function getEuclideanDistance(a, b) {
  if (!a || !b || a.length !== b.length) return Infinity;
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

// Get local IP of the machine hosting the backend
app.get('/api/ip', (req, res) => {
  const nets = os.networkInterfaces();
  let localIp = 'localhost';
  
  const keys = Object.keys(nets);
  const wifiKey = keys.find(k => k.toLowerCase().includes('wi-fi') || k.toLowerCase().includes('wireless') || k.toLowerCase().includes('inalambrica') || k.toLowerCase().includes('wi fi'));
  
  if (wifiKey) {
    const net = nets[wifiKey].find(n => n.family === 'IPv4' && !n.internal);
    if (net) localIp = net.address;
  }
  
  if (localIp === 'localhost') {
    for (const name of keys) {
      const net = nets[name].find(n => n.family === 'IPv4' && !n.internal && !n.address.startsWith('169.254'));
      if (net) {
        localIp = net.address;
        break;
      }
    }
  }
  
  res.json({ ip: localIp });
});

// Get all users (useful for debugging)
app.get('/api/users', async (req, res) => {
  try {
    const users = await getUsersList();
    // Map to exclude descriptor for cleaner listing if requested, or return all
    const cleanUsers = users.map(({ descriptor, ...rest }) => rest);
    res.json({ success: true, count: users.length, users: cleanUsers });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ success: false, message: 'Error al obtener usuarios.' });
  }
});

// Register a new user with face descriptor
app.post('/api/users/register', async (req, res) => {
  const { id, nombres, apellidos, cedula, descriptor } = req.body;

  if (!id || !nombres || !apellidos || !cedula || !descriptor) {
    return res.status(400).json({
      success: false,
      message: 'Faltan campos requeridos: id, nombres, apellidos, cedula, descriptor.'
    });
  }

  if (!Array.isArray(descriptor) || descriptor.length !== 128) {
    return res.status(400).json({
      success: false,
      message: 'El descriptor facial debe ser un arreglo de 128 números.'
    });
  }

  try {
    const newUser = { id, nombres, apellidos, cedula, descriptor, registeredAt: new Date().toISOString() };
    await saveUser(newUser);
    console.log(`[BioFacial] Usuario registrado/actualizado: ${nombres} ${apellidos} (${cedula})`);
    res.status(201).json({ success: true, message: 'Usuario registrado exitosamente.', user: { id, nombres, apellidos, cedula } });
  } catch (error) {
    console.error('Error registering user:', error);
    res.status(500).json({ success: false, message: 'Error al registrar el usuario.' });
  }
});

// Verify/match face descriptor
app.post('/api/users/verify', async (req, res) => {
  const { descriptor, threshold = 0.6 } = req.body;

  if (!descriptor || !Array.isArray(descriptor) || descriptor.length !== 128) {
    return res.status(400).json({
      success: false,
      message: 'Se requiere un descriptor facial válido de 128 números.'
    });
  }

  try {
    const users = await getUsersList();
    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No hay usuarios registrados en el sistema.'
      });
    }

    let bestMatch = null;
    let minDistance = Infinity;

    // Compare input descriptor against all registered users
    for (const user of users) {
      const dist = getEuclideanDistance(descriptor, user.descriptor);
      if (dist < minDistance) {
        minDistance = dist;
        bestMatch = user;
      }
    }

    console.log(`[BioFacial] Comparación - Distancia mínima encontrada: ${minDistance.toFixed(4)} contra ${bestMatch ? bestMatch.nombres : 'ninguno'}`);

    // Threshold of 0.6 is typical for face recognition with face-api.js descriptor
    if (minDistance < threshold && bestMatch) {
      const { descriptor, ...userWithoutDescriptor } = bestMatch;
      return res.json({
        success: true,
        match: true,
        distance: minDistance,
        user: userWithoutDescriptor
      });
    }

    res.status(404).json({
      success: false,
      match: false,
      distance: minDistance,
      message: 'Rostro no coincide con ningún usuario registrado.'
    });
  } catch (error) {
    console.error('Error verifying face:', error);
    res.status(500).json({ success: false, message: 'Error al verificar el rostro.' });
  }
});

// Delete user by ID
app.delete('/api/users/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const deleted = await deleteUser(id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado.' });
    }
    console.log(`[BioFacial] Usuario eliminado: ${id}`);
    res.json({ success: true, message: 'Usuario eliminado correctamente.' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ success: false, message: 'Error al eliminar el usuario.' });
  }
});

// Clear database
app.post('/api/clear', async (req, res) => {
  try {
    await clearDatabase();
    console.log(`[BioFacial] Base de datos limpia.`);
    res.json({ success: true, message: 'Base de datos biométrica restablecida.' });
  } catch (error) {
    console.error('Error clearing database:', error);
    res.status(500).json({ success: false, message: 'Error al limpiar la base de datos.' });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`==================================================`);
  console.log(`  BioFacial Backend (HTTP) escuchando en puerto ${PORT}`);
  console.log(`  Endpoints:`);
  console.log(`    - GET  /api/users`);
  console.log(`    - POST /api/users/register`);
  console.log(`    - POST /api/users/verify`);
  console.log(`==================================================`);
});
