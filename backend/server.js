import express from 'express';
import cors from 'cors';
import { MongoClient } from 'mongodb';

// Ensure MONGODB_URI is provided
const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('\n==================================================');
  console.error('  [BioFacial] ERROR CRÍTICO: MONGODB_URI no está definida.');
  console.error('  Esta aplicación ahora funciona exclusivamente en la nube.');
  console.error('  Por favor, configura la variable MONGODB_URI.');
  console.error('==================================================\n');
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: '10mb' })); // Allow larger payloads for descriptors

// Logger middleware to track incoming requests in real-time
app.use((req, res, next) => {
  console.log(`[BioFacial] [${new Date().toLocaleTimeString()}] ${req.method} ${req.url}`);
  next();
});

// MongoDB Connection Setup
console.log('[BioFacial] Conectando a MongoDB Atlas...');
let dbClient = null;
let usersCollection = null;

try {
  dbClient = await MongoClient.connect(MONGODB_URI);
  const dbName = MONGODB_URI.split('/').pop()?.split('?')[0] || 'biofacial';
  usersCollection = dbClient.db(dbName).collection('users');
  console.log(`[BioFacial] Conectado exitosamente a MongoDB, Base de Datos: ${dbName}`);
} catch (err) {
  console.error('[BioFacial] Error fatal al conectar a MongoDB Atlas:', err);
  process.exit(1);
}

// Database Helpers interacting with MongoDB Atlas (using an in-memory cache to speed up verification)
let usersCache = null;
let lastCacheFetch = 0;
const CACHE_TTL = 10000; // 10 seconds Cache TTL

async function getUsersList() {
  if (!usersCollection) throw new Error('Base de datos no inicializada.');
  const now = Date.now();
  if (!usersCache || (now - lastCacheFetch) > CACHE_TTL) {
    console.log('[BioFacial] [Cache Miss] Cargando lista de usuarios desde MongoDB Atlas...');
    usersCache = await usersCollection.find({}).toArray();
    lastCacheFetch = now;
  } else {
    console.log('[BioFacial] [Cache Hit] Sirviendo lista de usuarios desde caché en memoria.');
  }
  return usersCache;
}

async function saveUser(user) {
  if (!usersCollection) throw new Error('Base de datos no inicializada.');
  await usersCollection.replaceOne(
    { $or: [{ id: user.id }, { cedula: user.cedula }] },
    user,
    { upsert: true }
  );
  // Invalidate cache immediately
  usersCache = null;
  lastCacheFetch = 0;
}

async function deleteUser(id) {
  if (!usersCollection) throw new Error('Base de datos no inicializada.');
  const result = await usersCollection.deleteOne({ id });
  // Invalidate cache immediately
  usersCache = null;
  lastCacheFetch = 0;
  return result.deletedCount > 0;
}

async function clearDatabase() {
  if (!usersCollection) throw new Error('Base de datos no inicializada.');
  await usersCollection.deleteMany({});
  // Invalidate cache immediately
  usersCache = null;
  lastCacheFetch = 0;
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

// Get all users (useful for debugging)
app.get('/api/users', async (req, res) => {
  try {
    const users = await getUsersList();
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

    for (const user of users) {
      const dist = getEuclideanDistance(descriptor, user.descriptor);
      if (dist < minDistance) {
        minDistance = dist;
        bestMatch = user;
      }
    }

    console.log(`[BioFacial] Comparación - Distancia mínima: ${minDistance.toFixed(4)} contra ${bestMatch ? bestMatch.nombres : 'ninguno'}`);

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
  console.log(`  BioFacial Backend (Nube - MongoDB Atlas)`);
  console.log(`  Escuchando en el puerto: ${PORT}`);
  console.log(`  Endpoints activos:`);
  console.log(`    - GET  /api/users`);
  console.log(`    - POST /api/users/register`);
  console.log(`    - POST /api/users/verify`);
  console.log(`==================================================`);
});
