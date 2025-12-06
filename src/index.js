import api, { storage, route } from '@forge/api';
import Resolver from '@forge/resolver';

const resolver = new Resolver();

const CLIENTS = [
  "Dirección General de Rentas",
  "Municipalidad de Salta",
  "Municipios del Interior",
  "Gob Tech"
];

const TYPES = ["Nota", "Requerimiento"];

// Límite seguro: 200KB por chunk
const MAX_CHUNK_SIZE = 200000;

// ===== FUNCIONES DE STORAGE COMPARTIDAS =====

function chunkUsers(users) {
  const chunks = [];
  let currentChunk = [];
  let currentSize = 0;

  for (const user of users) {
    const userSize = JSON.stringify(user).length;
    
    if (currentSize + userSize > MAX_CHUNK_SIZE && currentChunk.length > 0) {
      chunks.push(currentChunk);
      currentChunk = [user];
      currentSize = userSize;
    } else {
      currentChunk.push(user);
      currentSize += userSize;
    }
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }

  return chunks;
}

async function saveUsersChunked(users) {
  const chunks = chunkUsers(users);
  
  await storage.set('users_metadata', { chunkCount: chunks.length });
  
  for (let i = 0; i < chunks.length; i++) {
    await storage.set(`users_chunk_${i}`, chunks[i]);
  }

  const oldMetadata = await storage.get('users_metadata');
  if (oldMetadata && oldMetadata.chunkCount > chunks.length) {
    for (let i = chunks.length; i < oldMetadata.chunkCount; i++) {
      await storage.delete(`users_chunk_${i}`);
    }
  }
}

async function getAllUsersRaw() {
  const metadata = await storage.get('users_metadata');
  
  if (!metadata || !metadata.chunkCount) {
    const oldData = await storage.get('users');
    if (oldData && oldData.length > 0) {
      await saveUsersChunked(oldData);
      await storage.delete('users');
      return oldData;
    }
    return [];
  }

  const allUsers = [];
  for (let i = 0; i < metadata.chunkCount; i++) {
    const chunk = await storage.get(`users_chunk_${i}`);
    if (chunk) {
      allUsers.push(...chunk);
    }
  }

  return allUsers;
}

function normalizeEntries(entries) {
  return entries.map(e => {
    if (e.name || e.phone) {
      return {
        tipo: TYPES[0],
        cliente: CLIENTS[0],
        usuario: e.name || '',
        telefono: e.phone || '',
        departamento: e.departamento || ''
      };
    }

    return {
      tipo: e.tipo || TYPES[0],
      cliente: e.cliente || CLIENTS[0],
      usuario: e.usuario || '',
      telefono: e.telefono || '',
      departamento: e.departamento || ''
    };
  });
}

async function getAllUsers() {
  const raw = await getAllUsersRaw();
  const normalized = normalizeEntries(raw);
  
  if (raw.length > 0 && raw.some(r => r.name || r.phone)) {
    await saveUsersChunked(normalized);
  }
  
  return normalized;
}

// ===== RESOLVERS =====

resolver.define('getUsers', async () => {
  return await getAllUsers();
});

resolver.define('saveUser', async (req) => {
  const { tipo, cliente, usuario, telefono, departamento } = req.payload;
  let users = await getAllUsers();
  
  const exists = users.find(u => 
    u.tipo === tipo && u.cliente === cliente && u.usuario === usuario
  );
  
  if (!exists) {
    users.push({ tipo, cliente, usuario, telefono, departamento });
  } else {
    users = users.map(u => {
      if (u.tipo === tipo && u.cliente === cliente && u.usuario === usuario) {
        return { tipo, cliente, usuario, telefono, departamento };
      }
      return u;
    });
  }

  await saveUsersChunked(users);
  return { success: true };
});

resolver.define('updateUser', async (req) => {
  const { originalTipo, originalCliente, originalUsuario, tipo, cliente, usuario, telefono, departamento } = req.payload;
  let users = await getAllUsers();

  const index = users.findIndex(u =>
    u.tipo === originalTipo && u.cliente === originalCliente && u.usuario === originalUsuario
  );

  if (index !== -1) {
    users[index] = { tipo, cliente, usuario, telefono, departamento };
    await saveUsersChunked(users);
    return { success: true };
  }
  
  return { success: false, error: 'Usuario no encontrado' };
});

resolver.define('deleteUser', async (req) => {
  const { tipo, cliente, usuario } = req.payload;
  let users = await getAllUsers();
  const newUsers = users.filter(u => 
    !(u.tipo === tipo && u.cliente === cliente && u.usuario === usuario)
  );
  
  await saveUsersChunked(newUsers);
  return { success: true };
});

resolver.define('bulkSaveUsers', async (req) => {
  const { newUsers } = req.payload;
  let currentUsers = await getAllUsers();
  const combined = [...currentUsers, ...newUsers];

  const map = new Map();
  combined.forEach(u => {
    const key = `${u.tipo}|||${u.cliente}|||${u.usuario}`;
    map.set(key, {
      tipo: u.tipo || TYPES[0],
      cliente: u.cliente || CLIENTS[0],
      usuario: u.usuario || '',
      telefono: u.telefono || '',
      departamento: u.departamento || ''
    });
  });

  const uniqueUsers = Array.from(map.values());
  await saveUsersChunked(uniqueUsers);

  return { success: true, count: uniqueUsers.length };
});

export const handler = resolver.getDefinitions();