import { storage } from '@forge/api';

// Lista de clientes conocidos por defecto. Se deja explícita para normalizar datos heredados.
export const CLIENTS = [
  "Dirección General de Rentas",
  "Municipalidad de Salta",
  "Municipios del Interior",
  "Gob Tech"
];

// Tipos de registro permitidos. El campo "Requerimiento" es el relevante para los nuevos campos.
export const TYPES = ["Nota", "Requerimiento"];

// Límite seguro: 200KB por chunk para evitar exceder el límite de Forge Storage en una sola entrada.
export const MAX_CHUNK_SIZE = 200000;

// Divide la lista completa de usuarios en porciones que no excedan MAX_CHUNK_SIZE.
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

// Guarda la colección completa usando chunking. También limpia chunks antiguos que dejen de ser necesarios.
export async function saveUsersChunked(users) {
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

// Recupera todos los usuarios, migrando datos legacy si aún estaban guardados sin chunking.
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

// Normaliza entradas viejas y nuevas para asegurar que todas las propiedades estén presentes.
function normalizeEntries(entries) {
  return entries.map((entry) => {
    if (entry.name || entry.phone) {
      return {
        tipo: TYPES[0],
        cliente: CLIENTS[0],
        usuario: entry.name || '',
        telefono: entry.phone || '',
        departamento: entry.departamento || ''
      };
    }

    return {
      tipo: entry.tipo || TYPES[0],
      cliente: entry.cliente || CLIENTS[0],
      usuario: entry.usuario || '',
      telefono: entry.telefono || '',
      departamento: entry.departamento || ''
    };
  });
}

// Punto único para obtener toda la base normalizada.
export async function getAllUsers() {
  const raw = await getAllUsersRaw();
  const normalized = normalizeEntries(raw);

  if (raw.length > 0 && raw.some((record) => record.name || record.phone)) {
    await saveUsersChunked(normalized);
  }

  return normalized;
}
