// ===== webtrigger.js =====
import api, { storage, route } from '@forge/api';

const MAX_CHUNK_SIZE = 200000;
const TYPES = ["Nota", "Requerimiento"];
const CLIENTS = [
  "Dirección General de Rentas",
  "Municipalidad de Salta",
  "Municipios del Interior",
  "Gob Tech"
];

async function getAllUsersRaw() {
  const metadata = await storage.get('users_metadata');
  
  if (!metadata || !metadata.chunkCount) {
    const oldData = await storage.get('users');
    if (oldData && oldData.length > 0) {
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
  return normalizeEntries(raw);
}

export const webtriggerHandler = async (event) => {
  try {
    const raw = event.body;
    const payload = JSON.parse(raw);

    const { issueKey, fieldValue } = payload;
    const usuario = fieldValue;

    const users = await getAllUsers();

    // Búsqueda case-insensitive (sin importar mayúsculas)
    const record = users.find(u => 
      u.usuario.toLowerCase().trim() === usuario.toLowerCase().trim()
    );

    if (!record) {
      console.log("❌ Usuario NO encontrado en BD");
      return { statusCode: 404, body: "Usuario no encontrado en base de datos" };
    }

    const updateBody = {
      fields: {
        customfield_11380: record.telefono,
        customfield_11378: record.departamento
      }
    };
    
    await api.asApp().requestJira(
      route`/rest/api/3/issue/${issueKey}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updateBody),
      }
    );

    return {
      statusCode: 200,
      body: "Campos actualizados correctamente"
    };

  } catch (err) {
    console.error("❌ ERROR GENERAL:", err);
    return {
      statusCode: 500,
      body: "Error procesando el WebTrigger"
    };
  }
};